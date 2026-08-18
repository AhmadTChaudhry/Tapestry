import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { quantizeToGrid } from './quantize'

describe('quantizeToGrid options', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      canvas: { width: 2, height: 3 },
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      getImageData: (_x, _y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4).fill(120) }),
    })
  })

  afterEach(() => vi.restoreAllMocks())

  it('uses an explicit row count', () => {
    const result = quantizeToGrid({ width: 20, height: 20 }, 2, 2, { rows: 3 })

    expect(result.grid).toHaveLength(3)
    expect(result.grid.every((row) => row.length === 2)).toBe(true)
  })

  it('keeps the default direct-draw sampling behavior when options are omitted', () => {
    const result = quantizeToGrid({ width: 20, height: 20 }, 2, 2)

    const ctx = HTMLCanvasElement.prototype.getContext.mock.results[0].value
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2, 8)
    expect(result.rows).toBe(8)
  })

  it('keeps the bottom source row first in the returned grid', () => {
    HTMLCanvasElement.prototype.getContext.mockReturnValueOnce({
      canvas: { width: 2, height: 2 },
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      getImageData: () => ({
        data: Uint8ClampedArray.from([
          0, 0, 0, 255, 0, 0, 0, 255,
          255, 255, 255, 255, 255, 255, 255, 255,
        ]),
      }),
    })

    const result = quantizeToGrid({ width: 2, height: 2 }, 2, 2, { rows: 2 })

    expect(result.grid).toEqual([[1, 1], [0, 0]])
  })

  it('draws through the draft geometry when one is supplied', () => {
    const result = quantizeToGrid({ width: 1200, height: 800 }, 2, 3, {
      rows: 3,
      draft: {
        source: { width: 1200, height: 800 },
        fitMode: 'crop',
        grid: { columns: 2, rows: 3, gauge: 'square' },
        transform: { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipX: false, flipY: false },
      },
    })

    const ctx = HTMLCanvasElement.prototype.getContext.mock.results[0].value
    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.anything(), 333.33333333333337, 0, 533.3333333333333, 800, -1, -1.5, 2, 3,
    )
    expect(result.rows).toBe(3)
  })
})
