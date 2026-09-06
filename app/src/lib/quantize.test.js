import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assignColorRoles, quantizeToGrid } from './quantize'

describe('quantizeToGrid options', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      canvas: { width: 2, height: 3 },
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      clearRect: vi.fn(),
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
      clearRect: vi.fn(),
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

  it('flattens transparency onto white instead of quantizing it as black', () => {
    // A logo on a transparent background used to hand (0,0,0) to the
    // quantizer and burn a phantom black yarn into the palette.
    HTMLCanvasElement.prototype.getContext.mockReturnValueOnce({
      canvas: { width: 2, height: 2 },
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      getImageData: () => ({
        data: Uint8ClampedArray.from([
          0, 0, 0, 0, 0, 0, 0, 0,
          180, 85, 60, 255, 180, 85, 60, 255,
        ]),
      }),
    })

    const result = quantizeToGrid({ width: 20, height: 20 }, 2, 2, { rows: 2 })

    expect(result.colors).toContain('#FFFFFF')
    expect(result.colors).not.toContain('#000000')
  })

  it('samples through the draft adjustments', () => {
    const result = quantizeToGrid({ width: 20, height: 20 }, 2, 2, {
      rows: 2,
      draft: {
        source: { width: 20, height: 20 },
        fitMode: 'stretch',
        grid: { columns: 2, rows: 2, gauge: 'square' },
        transform: { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipX: false, flipY: false },
        image: { brightness: 1, contrast: 1, saturation: 0, colorCount: 2 },
      },
    })

    // saturation 0 leaves every channel on the grey axis
    result.colors.forEach((hex) => {
      expect(hex.slice(1, 3)).toBe(hex.slice(3, 5))
      expect(hex.slice(3, 5)).toBe(hex.slice(5, 7))
    })
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

describe('assignColorRoles', () => {
  it('names the only colour Background when there is just one', () => {
    expect(assignColorRoles([100], [40])).toEqual(['Background'])
  })

  it('picks the colour dominating the border as Background, and the largest of what remains as Foreground', () => {
    // rank 0 covers most of the image by area, but rank 1 owns the border —
    // a subject that fills most of the frame, framed by a thin backdrop.
    const roles = assignColorRoles([80, 20], [2, 30])

    expect(roles).toEqual(['Foreground', 'Background'])
  })

  it('breaks a border tie by overall coverage', () => {
    const roles = assignColorRoles([80, 20], [10, 10])

    expect(roles).toEqual(['Background', 'Foreground'])
  })

  it('leaves a single leftover colour as a plain Accent, not numbered', () => {
    const roles = assignColorRoles([50, 30, 5], [20, 2, 1])

    expect(roles).toEqual(['Background', 'Foreground', 'Accent'])
  })

  it('numbers accents by coverage once there is more than one', () => {
    const roles = assignColorRoles([50, 30, 12, 4], [20, 2, 1, 1])

    expect(roles).toEqual(['Background', 'Foreground', 'Accent 1', 'Accent 2'])
  })
})

describe('quantizeToGrid roles', () => {
  afterEach(() => vi.restoreAllMocks())

  it('names a border colour Background and an interior colour Foreground', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      canvas: { width: 4, height: 4 },
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      // a white border framing a 2x2 black centre — exactly what a subject
      // photographed against a plain backdrop looks like once quantized
      getImageData: () => {
        const white = [255, 255, 255, 255]
        const black = [0, 0, 0, 255]
        const rows = [
          [white, white, white, white],
          [white, black, black, white],
          [white, black, black, white],
          [white, white, white, white],
        ]
        return { data: Uint8ClampedArray.from(rows.flat().flat()) }
      },
    })

    const result = quantizeToGrid({ width: 4, height: 4 }, 4, 2, { rows: 4 })

    expect(result.colors).toHaveLength(2)
    expect(result.roles).toHaveLength(2)
    expect(result.roles).toContain('Background')
    expect(result.roles).toContain('Foreground')
    const backgroundRank = result.roles.indexOf('Background')
    expect(result.colors[backgroundRank].toUpperCase()).toBe('#FFFFFF')
  })
})
