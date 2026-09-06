import { beforeEach, describe, expect, it, vi } from 'vitest'
import { quantizeToGrid } from './quantize'
import { buildDraftChart, matchedYarns, drawChart } from './conversion'
import { finishedSize, suggestedRows, stitchAspect } from './gauge'

let pixels
const draft = (patch = {}) => ({
  source: { width: 2, height: 2 }, fitMode: 'stretch',
  transform: { rotation: 0, scale: 1, offsetX: 0, offsetY: 0 },
  grid: { columns: 2, rows: 2, gauge: 'square' },
  image: { brightness: 1, contrast: 1, saturation: 1, colorCount: 4 }, yarns: [], ...patch,
})
beforeEach(() => {
  pixels = [255, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 255]
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    return { canvas: this, clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray(pixels) }) }
  })
})

describe('conversion invariants', () => {
  it('does not invent duplicate yarns for a solid image', () => {
    pixels = Array(4).fill([32, 64, 96, 255]).flat()
    const result = buildDraftChart({ width: 2, height: 2 }, draft())
    expect(result.colors).toEqual(['#204060'])
    expect(result.grid).toEqual([[0, 0], [0, 0]])
    expect(result.counts).toEqual([4])
  })

  it('preserves pixel art colours and bottom-first row order', () => {
    const result = buildDraftChart({ width: 2, height: 2 }, draft({ image: { sampling: 'pixel', colorCount: 2 } }))
    expect(result.colors).toEqual(['#000000', '#FF0000', '#FFFFFF'])
    expect(result.grid.map(row => row.map(i => result.colors[i]))).toEqual([['#FFFFFF', '#FF0000'], ['#FF0000', '#000000']])
  })

  it('maps only to the supplied yarn palette and prunes unused colours', () => {
    const result = quantizeToGrid({ width: 2, height: 2 }, 2, 2, { rows: 2, palette: ['#000000', '#FFFFFF'] })
    expect(result.colors).toEqual(['#000000', '#FFFFFF'])
    expect(result.grid.flat().every(i => i === 0 || i === 1)).toBe(true)
    expect(result.counts.reduce((a, b) => a + b)).toBe(4)
  })

  it('keeps yarn names attached to their source colour when ranks change', () => {
    const yarn = { sourceHex: '#FF0000', hex: '#EE1100', label: 'My red' }
    expect(matchedYarns(['#000000', '#FF0000'], [yarn])).toEqual([null, yarn])
    expect(matchedYarns(['#FF0000', '#FFFFFF'], [yarn])).toEqual([yarn, null])
    expect(matchedYarns(['#0000FF'], [yarn])).toEqual([null])
  })

  it('the rendered preview uses exact generated colours and top-to-bottom orientation', () => {
    const result = buildDraftChart({ width: 2, height: 2 }, draft({ image: { sampling: 'pixel' } }))
    const painted = []
    const ctx = { canvas: { width: 20, height: 20 }, clearRect() {}, fillRect(x, y) { painted.push({ x, y, color: this.fillStyle }) } }
    drawChart(ctx, result)
    expect(painted.find(p => p.x === 0 && p.y === 0).color).toBe('#FF0000')
    expect(painted.find(p => p.x === 0 && p.y === 10).color).toBe('#FFFFFF')
    expect(painted.every(p => result.colors.includes(p.color))).toBe(true)
  })
})

describe('physical gauge', () => {
  it('uses the measured swatch for both stitch proportions and finished dimensions', () => {
    const grid = { columns: 40, rows: 60, gauge: 'true', swatch: { stitches: 20, rows: 30 } }
    expect(stitchAspect(grid)).toBeCloseTo(2 / 3)
    expect(finishedSize(grid)).toEqual({ width: 20, height: 20 })
    expect(suggestedRows(draft({ grid }), 40)).toBe(60)
  })
  it('accounts for a quarter-turn when deriving locked dimensions', () => {
    expect(suggestedRows(draft({ source: { width: 400, height: 200 }, transform: { rotation: 90 } }), 40)).toBe(80)
  })
})
