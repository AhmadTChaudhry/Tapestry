import { describe, expect, it, vi } from 'vitest'
import { drawDraftToCanvas, sourceRectForDraft } from './geometry'

const base = {
  source: { width: 1200, height: 800 },
  grid: { columns: 24, rows: 24, gauge: 'square' },
  transform: { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipX: false, flipY: false },
}

describe('sourceRectForDraft', () => {
  it('center-crops a landscape image to a square output', () => {
    expect(sourceRectForDraft({ ...base, fitMode: 'crop' })).toEqual({ sx: 200, sy: 0, sw: 800, sh: 800 })
  })

  it('uses the entire source in stretch mode', () => {
    expect(sourceRectForDraft({ ...base, fitMode: 'stretch' })).toEqual({ sx: 0, sy: 0, sw: 1200, sh: 800 })
  })

  it('zooms and offsets the crop within the source bounds', () => {
    const draft = {
      ...base,
      fitMode: 'crop',
      transform: { ...base.transform, scale: 2, offsetX: 1, offsetY: -1 },
    }

    expect(sourceRectForDraft(draft)).toEqual({ sx: 800, sy: 0, sw: 400, sh: 400 })
  })
})

describe('drawDraftToCanvas', () => {
  it('uses the actual canvas dimensions and draft transforms', () => {
    const ctx = {
      canvas: { width: 96, height: 72 },
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
    }
    const draft = {
      ...base,
      fitMode: 'crop',
      transform: { ...base.transform, rotation: 90, flipX: true },
    }

    drawDraftToCanvas(ctx, { width: 1200, height: 800 }, draft)

    expect(ctx.translate).toHaveBeenCalledWith(48, 36)
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2)
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1)
    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.anything(), 200, 0, 800, 800, -48, -36, 96, 72,
    )
  })
})
