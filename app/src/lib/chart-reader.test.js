import { describe, expect, it } from 'vitest'
import * as chart from './chart'

const project = { grid: [[0, 0, 1, 2], [0, 1, 1, 2], [2, 0, 1, 0]], totalRows: 3, stitchesWide: 4, currentRow: 1, workingMethod: 'turned' }

describe('chart reader directions', () => {
  it('keeps legacy rank labels and extends them through all 64 colours', () => {
    expect([0, 25, 26, 51, 52, 63].map(chart.rankLabel)).toEqual(['A', 'Z', 'AA', 'AZ', 'BA', 'BL'])
  })
  it('never mirrors the canonical asymmetric grid on turned rows', () => {
    expect(chart.rowCells(project, 2)).toEqual([0, 1, 1, 2])
  })
  it('reads right-handed odd rows RTL and even rows LTR', () => {
    expect(chart.runsForRow(project, 1)).toEqual([{ index: 2, count: 1 }, { index: 1, count: 1 }, { index: 0, count: 2 }])
    expect(chart.runsForRow(project, 2)).toEqual([{ index: 0, count: 1 }, { index: 1, count: 2 }, { index: 2, count: 1 }])
  })
  it('reverses handedness, keeps rounds constant and honours starting direction', () => {
    expect(chart.rowDirection({ ...project, handedness: 'left' }, 1)).toBe('ltr')
    expect(chart.rowDirection({ ...project, handedness: 'left' }, 2)).toBe('rtl')
    expect(chart.rowDirection({ ...project, workingMethod: 'round' }, 2)).toBe('rtl')
    expect(chart.rowDirection({ ...project, workingMethod: 'round', handedness: 'left' }, 2)).toBe('ltr')
    expect(chart.rowDirection({ ...project, startDirection: 'ltr' }, 1)).toBe('ltr')
    expect(chart.rowDirection({ ...project, startDirection: 'ltr' }, 2)).toBe('rtl')
  })
  it('includes every run and exactly every stitch without mutation', () => {
    const original = JSON.stringify(project)
    for (let r = 1; r <= 3; r++) {
      expect(chart.runsForRow(project, r).reduce((n, run) => n + run.count, 0)).toBe(4)
    }
    expect(chart.runsForRow(project, 3)).toHaveLength(4)
    expect(JSON.stringify(project)).toBe(original)
  })
})

describe('explicit progress', () => {
  it('uses completed rows, with legacy currentRow minus one fallback', () => {
    expect(chart.percentDone(project)).toBe(0)
    expect(chart.percentDone({ ...project, currentRow: 3 })).toBe(67)
    expect(chart.percentDone({ ...project, currentRow: 3, completedRows: [] })).toBe(0)
    expect(chart.percentDone({ ...project, completedRows: [1, 1, 3, 99, -1] })).toBe(67)
    expect(chart.percentDone({ ...project, completedRows: 3 })).toBe(100)
    expect(chart.percentDone({ totalRows: 0 })).toBe(0)
  })
  it('completes idempotently and resets the run, including the last row', () => {
    expect(chart.completeRowPatch({ ...project, currentRun: 2 })).toEqual({ completedRows: [1], currentRow: 2, currentRun: 0 })
    expect(chart.completeRowPatch({ ...project, currentRow: 3, completedRows: [1, 3] })).toEqual({ completedRows: [1, 3], currentRow: 3, currentRun: 0 })
  })
  it('detects started work even when no rows have yet been completed', () => {
    expect(chart.hasStarted(project)).toBe(false)
    expect(chart.hasStarted({ ...project, currentRun: 1 })).toBe(true)
    expect(chart.hasStarted({ ...project, currentRow: 2, completedRows: [] })).toBe(true)
  })
})

describe('safe edits and geometry', () => {
  it('paints only one canonical cell and fills only four-connected matching cells', () => {
    const grid = [[0, 0, 1], [0, 1, 0], [1, 0, 0]]
    expect(chart.editCells(grid, 0, 0, 2, 'paint')).toEqual([[2, 0, 1], [0, 1, 0], [1, 0, 0]])
    expect(chart.editCells(grid, 0, 0, 2, 'fill')).toEqual([[2, 2, 1], [2, 1, 0], [1, 0, 0]])
    expect(grid[0][0]).toBe(0)
    expect(chart.editCells(grid, -1, 0, 2, 'fill')).toBe(grid)
    expect(chart.editCells(grid, 0, 0, 0, 'fill')).toBe(grid)
  })
  it('derives swatch aspect from stitches/rows per 10cm and keeps square display separate', () => {
    expect(chart.gaugeAspect({ gauge: 'true', swatch: { stitches: 20, rows: 25 } })).toBe(0.8)
    expect(chart.gaugeAspect({ gauge: 'square' })).toBe(1)
    expect(chart.gaugeAspect({ gauge: 'square', swatch: { stitches: 20, rows: 25 } })).toBe(0.8)
    expect(chart.rankLabel(-1)).toBe('?')
    expect(chart.rankLabel(NaN)).toBe('?')
    expect(chart.rankLabel(Infinity)).toBe('?')
    expect(chart.gaugeAspect({ gauge: 'true', swatch: { stitches: 0, rows: 0 } })).toBeGreaterThan(0)
  })
})
