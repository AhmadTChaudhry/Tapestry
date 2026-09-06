import { describe, expect, it, vi } from 'vitest'
import { drawDraftToCanvas, drawPlanForDraft, drawStitchPreview, sourceRectForDraft } from './geometry'

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

  it('falls back to the minimum scale for non-finite, non-positive, and sub-one values', () => {
    const expected = sourceRectForDraft({ ...base, fitMode: 'crop' })

    for (const scale of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1, 0.5]) {
      expect(sourceRectForDraft({
        ...base,
        fitMode: 'crop',
        transform: { ...base.transform, scale },
      })).toEqual(expected)
    }
  })

  it('clamps extreme and non-finite offsets to a contained source rectangle', () => {
    const extremeRect = sourceRectForDraft({
      ...base,
      fitMode: 'crop',
      transform: { ...base.transform, scale: 2, offsetX: 99, offsetY: -99 },
    })
    const nonFiniteRect = sourceRectForDraft({
      ...base,
      fitMode: 'crop',
      transform: { ...base.transform, scale: 2, offsetX: Number.POSITIVE_INFINITY, offsetY: Number.NaN },
    })

    expect(extremeRect).toEqual({ sx: 800, sy: 0, sw: 400, sh: 400 })
    expect(nonFiniteRect).toEqual({ sx: 400, sy: 200, sw: 400, sh: 400 })
    expect(Object.values(extremeRect).every(Number.isFinite)).toBe(true)
    expect(Object.values(nonFiniteRect).every(Number.isFinite)).toBe(true)
  })

  it('uses the 11:9 Aran gauge in a non-square grid', () => {
    const rect = sourceRectForDraft({
      ...base,
      fitMode: 'crop',
      grid: { columns: 36, rows: 24, gauge: 'true' },
    })

    expect(rect.sx).toBe(0)
    expect(rect.sy).toBeCloseTo(800 / 11)
    expect(rect.sw).toBe(1200)
    expect(rect.sh).toBeCloseTo(7200 / 11)
  })

  it.each([90, 270])('uses the inverse crop aspect before a %i degree quarter-turn', (rotation) => {
    const rect = sourceRectForDraft({
      ...base,
      fitMode: 'crop',
      grid: { columns: 36, rows: 24, gauge: 'true' },
      transform: { ...base.transform, rotation },
    })

    expect(rect.sx).toBeCloseTo(4200 / 11)
    expect(rect.sy).toBe(0)
    expect(rect.sw).toBeCloseTo(4800 / 11)
    expect(rect.sh).toBe(800)
  })
})

describe('drawDraftToCanvas', () => {
  it('uses the actual canvas dimensions and draft transforms', () => {
    const ctx = {
      canvas: { width: 96, height: 72 },
      clearRect: vi.fn(),
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

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 96, 72)
    expect(ctx.translate).toHaveBeenCalledWith(48, 36)
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2)
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1)
    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.anything(), 200, 0, 800, 800, -36, -48, 72, 96,
    )
  })

  it.each([90, 270])('swaps reviewed destination dimensions for a %i degree preview quarter-turn', (rotation) => {
    const plan = drawPlanForDraft({
      ...base,
      fitMode: 'crop',
      grid: { columns: 36, rows: 24, gauge: 'true' },
      transform: { ...base.transform, rotation },
    }, { width: 396, height: 216 })

    expect(plan.rotation).toBe(rotation)
    expect(plan.destination).toEqual({ x: -108, y: -198, width: 216, height: 396 })
    expect(plan.outputBounds).toEqual({ width: 396, height: 216 })
  })
})

describe('drawStitchPreview', () => {
  it('flattens each stitch to one colour by compositing through a one-pixel-per-stitch buffer with smoothing disabled', () => {
    const buffer = { width: 0, height: 0 }
    const bufferCtx = {
      canvas: buffer,
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    }
    buffer.getContext = () => bufferCtx
    const ctx = {
      canvas: { width: 264, height: 216 },
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      imageSmoothingEnabled: true,
    }
    const draft = { ...base, fitMode: 'crop', grid: { ...base.grid, columns: 24, rows: 24 } }
    const image = { width: 1200, height: 800 }

    drawStitchPreview(ctx, image, draft, buffer)

    // the buffer is sized to exactly one pixel per stitch, so the browser's
    // own downscale filter (exercised inside drawDraftToCanvas) averages
    // every stitch down to a single flat colour
    expect(buffer.width).toBe(24)
    expect(buffer.height).toBe(24)
    expect(bufferCtx.drawImage).toHaveBeenCalledOnce()

    // and that flat result is blown back up onto the real canvas with
    // smoothing off, so no two colours blend across a stitch's edges
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 264, 216)
    expect(ctx.imageSmoothingEnabled).toBe(false)
    expect(ctx.drawImage).toHaveBeenCalledWith(buffer, 0, 0, 264, 216)
  })

  it('creates its own buffer when the caller does not supply one to reuse', () => {
    const bufferCtx = { save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn() }
    const fakeCreated = { width: 0, height: 0, getContext: () => { fakeCreated.getContextCtx = bufferCtx; bufferCtx.canvas = fakeCreated; return bufferCtx } }
    const createSpy = vi.spyOn(document, 'createElement').mockReturnValue(fakeCreated)
    const ctx = { canvas: { width: 24, height: 24 }, clearRect: vi.fn(), drawImage: vi.fn() }

    drawStitchPreview(ctx, { width: 1200, height: 800 }, { ...base, fitMode: 'crop' })

    expect(createSpy).toHaveBeenCalledWith('canvas')
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeCreated, 0, 0, 24, 24)
    createSpy.mockRestore()
  })
})
