import { describe, expect, it } from 'vitest'
import { drawPlanForDraft } from './geometry'

const base = {
  source: { width: 1200, height: 800 },
  fitMode: 'crop',
  grid: { columns: 36, rows: 24, gauge: 'true' },
  transform: { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipX: false, flipY: false },
}

describe('drawPlanForDraft', () => {
  it.each([90, 270])('fills a 120 by 80 canvas after a %i degree quarter-turn', (rotation) => {
    const plan = drawPlanForDraft({
      ...base,
      transform: { ...base.transform, rotation },
    }, { width: 120, height: 80 })

    expect(plan.rotation).toBe(rotation)
    expect(plan.destination).toEqual({ x: -40, y: -60, width: 80, height: 120 })
    expect(plan.outputBounds).toEqual({ width: 120, height: 80 })
  })

  it('snaps a non-right-angle rotation before computing the plan', () => {
    const plan = drawPlanForDraft({
      ...base,
      transform: { ...base.transform, rotation: 47 },
    }, { width: 120, height: 80 })

    expect(plan.rotation).toBe(90)
    expect(plan.outputBounds).toEqual({ width: 120, height: 80 })
  })

  it('maps horizontal and vertical flips to independent output directions', () => {
    const horizontal = drawPlanForDraft({
      ...base,
      transform: { ...base.transform, flipX: true },
    }, { width: 120, height: 80 })
    const vertical = drawPlanForDraft({
      ...base,
      transform: { ...base.transform, flipY: true },
    }, { width: 120, height: 80 })

    expect(horizontal.scale).toEqual({ x: -1, y: 1 })
    expect(vertical.scale).toEqual({ x: 1, y: -1 })
  })
})
