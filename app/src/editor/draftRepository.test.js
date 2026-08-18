import { beforeEach, describe, expect, it } from 'vitest'
import { createDraft } from './model'
import * as draftRepository from './draftRepository'
import {
  __resetDatabase,
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

function replaceMethod(target, key, replacement, restores) {
  const descriptor = Object.getOwnPropertyDescriptor(target, key)
  Object.defineProperty(target, key, { configurable: true, writable: true, value: replacement })
  restores.push(() => {
    if (descriptor) Object.defineProperty(target, key, descriptor)
    else delete target[key]
  })
}

beforeEach(async () => {
  await __resetDatabase()
})

describe('draft repository', () => {
  it('does not expose transaction internals as part of its public API', () => {
    expect(draftRepository).not.toHaveProperty('__transact')
  })

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

  it('fulfills saveAsset only after its transaction completes', async () => {
    const originalOpen = indexedDB.open
    const restores = []
    let resolveAfterRequest
    let assetStoreInstrumented = false
    const afterRequest = new Promise((resolve) => {
      resolveAfterRequest = resolve
    })

    replaceMethod(indexedDB, 'open', function (...args) {
      const openRequest = originalOpen.apply(this, args)
      openRequest.addEventListener('success', () => {
        const database = openRequest.result
        const originalTransaction = database.transaction
        replaceMethod(database, 'transaction', function (...transactionArgs) {
          const transaction = originalTransaction.apply(this, transactionArgs)
          const originalObjectStore = transaction.objectStore
          replaceMethod(transaction, 'objectStore', function (...storeArgs) {
            const store = originalObjectStore.apply(this, storeArgs)
            if (assetStoreInstrumented || storeArgs[0] !== 'assets') return store

            assetStoreInstrumented = true
            const originalPut = store.put
            replaceMethod(store, 'put', function (...putArgs) {
              const request = originalPut.apply(this, putArgs)
              let onSuccess
              const descriptor = Object.getOwnPropertyDescriptor(request, 'onsuccess')
              Object.defineProperty(request, 'onsuccess', {
                configurable: true,
                get: () => onSuccess,
                set: (handler) => {
                  onSuccess = (event) => {
                    handler.call(request, event)
                    store.get(putArgs[0].id)
                    queueMicrotask(() => queueMicrotask(resolveAfterRequest))
                  }
                },
              })
              restores.push(() => {
                if (descriptor) Object.defineProperty(request, 'onsuccess', descriptor)
                else delete request.onsuccess
              })
              return request
            }, restores)
            return store
          }, restores)
          return transaction
        }, restores)
      })
      return openRequest
    }, restores)

    try {
      let fulfilled = false
      const saved = saveAsset(new Blob(['pixels'], { type: 'image/png' }), { width: 640, height: 480 })
        .then((asset) => {
          fulfilled = true
          return asset
        })

      await afterRequest
      expect(fulfilled).toBe(false)
      await expect(saved).resolves.toMatchObject({ width: 640, height: 480 })
    } finally {
      restores.reverse().forEach((restore) => restore())
    }
  })

  it('rejects saveAsset when a later request aborts its transaction', async () => {
    const originalOpen = indexedDB.open
    const restores = []
    let assetStoreInstrumented = false

    replaceMethod(indexedDB, 'open', function (...args) {
      const openRequest = originalOpen.apply(this, args)
      openRequest.addEventListener('success', () => {
        const database = openRequest.result
        const originalTransaction = database.transaction
        replaceMethod(database, 'transaction', function (...transactionArgs) {
          const transaction = originalTransaction.apply(this, transactionArgs)
          const originalObjectStore = transaction.objectStore
          replaceMethod(transaction, 'objectStore', function (...storeArgs) {
            const store = originalObjectStore.apply(this, storeArgs)
            if (assetStoreInstrumented || storeArgs[0] !== 'assets') return store

            assetStoreInstrumented = true
            const originalPut = store.put
            replaceMethod(store, 'put', function (...putArgs) {
              const request = originalPut.apply(this, putArgs)
              store.add({ ...putArgs[0] })
              return request
            }, restores)
            return store
          }, restores)
          return transaction
        }, restores)
      })
      return openRequest
    }, restores)

    try {
      await expect(saveAsset(new Blob(['pixels'], { type: 'image/png' }), { width: 640, height: 480 }))
        .rejects.toThrow()
    } finally {
      restores.reverse().forEach((restore) => restore())
    }
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
