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

  it('rejects malformed persisted values', () => {
    expect(validateDraft({ schemaVersion: 1 })).toEqual({ ok: false, reason: 'invalid-draft' })
  })
})
