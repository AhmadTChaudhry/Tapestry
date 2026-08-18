import { beforeEach, describe, expect, it } from 'vitest'
import { createDraft } from './model'
import {
  __resetDatabase,
  __transact,
  deleteDraft,
  getAsset,
  getDraft,
  getLatestDraft,
  saveAsset,
  saveDraft,
} from './draftRepository'

const DB_NAME = 'tapestry-crochet-editor'

function openExternalDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function putDraftDirectly(draft) {
  const db = await openExternalDatabase()

  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('drafts', 'readwrite')
      transaction.objectStore('drafts').put(draft)
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

beforeEach(async () => {
  await __resetDatabase()
})

describe('draft repository', () => {
  it('stores a blob separately from the draft', async () => {
    const file = new File(['pixels'], 'fox.png', { type: 'image/png' })
    const asset = await saveAsset(file, { width: 640, height: 480 })
    await saveDraft(createDraft(asset, 'Fox'))

    expect(await getAsset(asset.id)).toMatchObject({
      width: 640,
      height: 480,
      mimeType: 'image/png',
    })
    expect((await getLatestDraft()).name).toBe('Fox')
  })

  it('retrieves a saved draft by id', async () => {
    const asset = await saveAsset(new Blob(['pixels'], { type: 'image/png' }), { width: 640, height: 480 })
    const draft = createDraft(asset, 'Fox')

    await saveDraft(draft)

    expect(await getDraft(draft.id)).toEqual(draft)
  })

  it('returns the most recently updated draft', async () => {
    const asset = await saveAsset(new Blob(['pixels'], { type: 'image/png' }), { width: 640, height: 480 })
    const earlier = { ...createDraft(asset, 'Earlier'), updatedAt: '2026-01-01T00:00:00.000Z' }
    const latest = { ...createDraft(asset, 'Latest'), updatedAt: '2026-01-02T00:00:00.000Z' }

    await saveDraft(earlier)
    await saveDraft(latest)

    expect(await getLatestDraft()).toEqual(latest)
  })

  it('deletes a draft', async () => {
    const asset = await saveAsset(new Blob(['pixels'], { type: 'image/png' }), { width: 640, height: 480 })
    const draft = createDraft(asset, 'Fox')
    await saveDraft(draft)

    await deleteDraft(draft.id)

    expect(await getDraft(draft.id)).toBeUndefined()
  })

  it('rejects invalid drafts', async () => {
    await expect(saveDraft({ schemaVersion: 1 })).rejects.toThrow('invalid-draft')
  })

  it('rejects drafts with invalid timestamps', async () => {
    const asset = await saveAsset(new Blob(['pixels'], { type: 'image/png' }), { width: 640, height: 480 })
    const draft = { ...createDraft(asset, 'Fox'), updatedAt: 'not-a-timestamp' }

    await expect(saveDraft(draft)).rejects.toThrow('invalid-draft')
  })

  it('orders valid drafts ahead of malformed legacy timestamps', async () => {
    const asset = await saveAsset(new Blob(['pixels'], { type: 'image/png' }), { width: 640, height: 480 })
    const latest = { ...createDraft(asset, 'Latest'), updatedAt: '2026-01-02T00:00:00.000Z' }
    const malformed = { ...createDraft(asset, 'Legacy'), updatedAt: 'not-a-timestamp' }

    await putDraftDirectly(malformed)
    await saveDraft(latest)

    await expect(getLatestDraft()).resolves.toEqual(latest)
  })

  it('resolves transactions only after completion', async () => {
    let completed = false

    await __transact('assets', 'readwrite', (store, transaction) => {
      transaction.addEventListener('complete', () => {
        completed = true
      })
      const first = store.put({ id: 'asset-durable', blob: new Blob(), width: 1, height: 1, mimeType: 'image/png' })
      store.put({ id: 'asset-later', blob: new Blob(), width: 1, height: 1, mimeType: 'image/png' })
      return first
    })

    expect(completed).toBe(true)
  })

  it('rejects when a transaction aborts after its first request succeeds', async () => {
    await expect(__transact('assets', 'readwrite', (store) => {
      const first = store.put({ id: 'asset-duplicate', blob: new Blob(), width: 1, height: 1, mimeType: 'image/png' })
      store.add({ id: 'asset-duplicate', blob: new Blob(), width: 1, height: 1, mimeType: 'image/png' })
      return first
    })).rejects.toThrow()
  })

  it('rejects reset when an external IndexedDB connection blocks deletion', async () => {
    await saveAsset(new Blob(['pixels'], { type: 'image/png' }), { width: 640, height: 480 })
    const external = await openExternalDatabase()

    try {
      await expect(__resetDatabase()).rejects.toThrow('database deletion blocked')
    } finally {
      external.close()
    }
  })
})
