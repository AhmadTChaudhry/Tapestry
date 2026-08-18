import { beforeEach, describe, expect, it } from 'vitest'
import { createDraft } from './model'
import {
  __resetDatabase,
  deleteDraft,
  getAsset,
  getDraft,
  getLatestDraft,
  saveAsset,
  saveDraft,
} from './draftRepository'

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
})
