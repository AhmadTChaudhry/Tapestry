/** Colours are labelled A, B, C… by rank, the way a written pattern does it.
 *  A project can override any rank with the yarn name set in the editor. */
export const rankLabel = (index) => String.fromCharCode(65 + index)
export const yarnLabel = (index, project) => {
  const named = project?.yarnLabels?.[index]
  return typeof named === 'string' && named.trim() !== '' ? named : rankLabel(index)
}

// Derived chart values. Nothing here is stored — see README "State Management".
import { STITCH_ASPECT } from './quantize'

// gutters and padding the chart row spends on things that aren't cells
const CHART_CHROME = 32 /* scroller padding */ + 20 /* row number */ + 24 /* NOW */ + 4 /* strip */

/**
 * Cell geometry for one row.
 *
 * A row always spans the full usable width, whatever the stitch count, and the
 * vertical pitch is the horizontal pitch times the stitch aspect. Sizes stay
 * fractional on purpose: rounding cells to whole pixels used to collapse the
 * gauge on wide charts (60 stitches came out 22% too tall) because the cell
 * height hit its floor while the gap stayed a fixed 1px.
 */
export function cellMetrics(containerWidth, stitchesWide, gauge, zoom = 1, gaps = true) {
  const usable = Math.max(40, containerWidth - CHART_CHROME)
  const pitchX = (usable / stitchesWide) * zoom
  const gapX = gaps ? Math.min(1.2, Math.max(0.4, pitchX * 0.09)) : 0
  const ratio = gauge === 'square' ? 1 : STITCH_ASPECT
  // The row pitch is the column pitch times the stitch aspect — nothing else
  // may add height, or rows drift apart and the picture stretches vertically.
  return {
    cellW: Math.max(1, pitchX - gapX),
    cellH: Math.max(1, (pitchX - gapX) * ratio),
    gapX,
    gapY: gapX * ratio,
    pitchY: pitchX * ratio,
  }
}


/** Working a row in the round always reads left->right; turned work reverses
 *  every wrong-side (even) row. */
export const isReversed = (rowNumber, workingMethod) =>
  workingMethod === 'turned' && rowNumber % 2 === 0

export function rowCells(project, rowNumber) {
  const cells = project.grid[rowNumber - 1] || []
  return isReversed(rowNumber, project.workingMethod) ? [...cells].reverse() : cells
}

/** Run-length encode the current row in the direction it will be worked. */
export function runsForRow(project, rowNumber) {
  const cells = rowCells(project, rowNumber)
  const runs = []
  for (const v of cells) {
    const last = runs[runs.length - 1]
    if (last && last.index === v) last.count++
    else runs.push({ index: v, count: 1 })
  }
  return runs
}

export const percentDone = (project) =>
  Math.round((project.currentRow / project.totalRows) * 100)

export const clampRow = (project, n) => Math.max(1, Math.min(project.totalRows, n))

/** Window of rows to render around the marker, newest first (work grows upward). */
export function visibleRows(project, above = 35, below = 25) {
  const top = Math.min(project.totalRows, project.currentRow + above)
  const bottom = Math.max(1, project.currentRow - below)
  const out = []
  for (let r = top; r >= bottom; r--) out.push(r)
  return out
}
