import { describe, expect, it } from 'vitest'
import { createDraft, editorReducer, validateDraft } from './model'

const asset = { id: 'asset-1', width: 1200, height: 800, mimeType: 'image/jpeg' }

describe('editor draft', () => {
  it('creates a crop-mode draft with deterministic defaults', () => {
    const draft = createDraft(asset, 'Fox')
    expect(draft).toMatchObject({
      schemaVersion: 1,
      name: 'Fox',
      assetId: 'asset-1',
      fitMode: 'crop',
      transform: { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipX: false, flipY: false },
      grid: { columns: 24, rows: 20, dimensionsLocked: true, gauge: 'true', workingMethod: 'round' },
      activeStage: 'frame',
    })
  })

  it('clamps dimensions and normalizes rotations', () => {
    let draft = createDraft(asset, 'Fox')
    draft = editorReducer(draft, { type: 'grid/set-columns', value: 4 })
    draft = editorReducer(draft, { type: 'transform/rotate', degrees: 450 })
    expect(draft.grid.columns).toBe(8)
    expect(draft.transform.rotation).toBe(90)
  })

  it('derives rows when dimensions are locked', () => {
    let draft = createDraft(asset, 'Fox')
    draft = editorReducer(draft, { type: 'grid/set-columns', value: 48 })
    expect(draft.grid).toMatchObject({ columns: 48, rows: 39, dimensionsLocked: true })
  })

  it('derives rows when a locked grid patch changes columns', () => {
    let draft = createDraft(asset, 'Fox')
    draft = editorReducer(draft, { type: 'grid/patch', patch: { columns: 48 } })
    expect(draft.grid).toMatchObject({ columns: 48, rows: 39, dimensionsLocked: true })
  })

  it('derives rows consistently when a locked grid patch changes gauge', () => {
    let draft = createDraft(asset, 'Fox')
    draft = editorReducer(draft, { type: 'grid/patch', patch: { columns: 48, gauge: 'square' } })
    expect(draft.grid).toMatchObject({ columns: 48, rows: 32, dimensionsLocked: true, gauge: 'square' })
  })

  it('ignores malformed numeric reducer inputs', () => {
    const draft = createDraft(asset, 'Fox')

    expect(editorReducer(draft, { type: 'grid/set-columns', value: 'bad' })).toBe(draft)
    expect(editorReducer(draft, { type: 'grid/set-rows', value: Number.NaN })).toBe(draft)
    expect(editorReducer(draft, { type: 'transform/rotate', degrees: Number.POSITIVE_INFINITY })).toBe(draft)
    expect(editorReducer(draft, { type: 'grid/patch', patch: { columns: Number.NaN } })).toBe(draft)
  })

  it('rejects malformed persisted values', () => {
    expect(validateDraft({ schemaVersion: 1 })).toEqual({ ok: false, reason: 'invalid-draft' })
  })

  it('rejects persisted drafts with NaN grid dimensions', () => {
    const draft = createDraft(asset, 'Fox')
    expect(validateDraft({ ...draft, grid: { ...draft.grid, columns: Number.NaN } })).toEqual({
      ok: false,
      reason: 'invalid-draft',
    })
  })

  it('rejects persisted drafts with missing source height', () => {
    const draft = createDraft(asset, 'Fox')
    expect(validateDraft({ ...draft, source: { width: asset.width, mimeType: asset.mimeType } })).toEqual({
      ok: false,
      reason: 'invalid-draft',
    })
  })

  it('rejects persisted drafts with missing timestamps', () => {
    const draft = createDraft(asset, 'Fox')

    expect(validateDraft({ ...draft, createdAt: undefined })).toEqual({ ok: false, reason: 'invalid-draft' })
    expect(validateDraft({ ...draft, updatedAt: undefined })).toEqual({ ok: false, reason: 'invalid-draft' })
  })

  it('rejects persisted drafts with unparseable timestamps', () => {
    const draft = createDraft(asset, 'Fox')

    expect(validateDraft({ ...draft, createdAt: 'not-a-timestamp' })).toEqual({ ok: false, reason: 'invalid-draft' })
    expect(validateDraft({ ...draft, updatedAt: 'not-a-timestamp' })).toEqual({ ok: false, reason: 'invalid-draft' })
  })

  it('rejects persisted drafts with non-positive source dimensions or out-of-bounds grid dimensions', () => {
    const draft = createDraft(asset, 'Fox')
    const malformedDrafts = [
      { ...draft, source: { ...draft.source, width: 0 } },
      { ...draft, source: { ...draft.source, height: Number.POSITIVE_INFINITY } },
      { ...draft, grid: { ...draft.grid, columns: 7 } },
      { ...draft, grid: { ...draft.grid, rows: 401 } },
    ]

    for (const malformedDraft of malformedDrafts) {
      expect(validateDraft(malformedDraft)).toEqual({ ok: false, reason: 'invalid-draft' })
    }
  })
})
