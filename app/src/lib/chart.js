/** Colours are labelled A, B, C… by rank, the way a written pattern does it.
 *  A project can override any rank with the yarn name set in the editor. */
export const rankLabel = (index) => {
  if (!Number.isSafeInteger(index) || index < 0) return '?'
  let label = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label
  }
  return label
}
export const yarnLabel = (index, project) => {
  const named = project?.yarnLabels?.[index]
  return typeof named === 'string' && named.trim() !== '' ? named : rankLabel(index)
}

// Derived chart values. Nothing here is stored — see README "State Management".
import { STITCH_ASPECT } from './quantize'
import { stitchAspect } from './gauge'

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
  const ratio = typeof gauge === 'object' ? gaugeAspect(gauge) : gauge === 'square' ? 1 : STITCH_ASPECT
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


/** Legacy turn predicate; visual cells must never be reversed by this flag. */
export const isReversed = (rowNumber, workingMethod) =>
  (workingMethod === 'turned' || workingMethod === 'flat') && rowNumber % 2 === 0

/** Starting direction overrides handedness, then flat work alternates. */
export function rowDirection(project, rowNumber) {
  const start = ['rtl', 'ltr'].includes(project.startDirection)
    ? project.startDirection : project.handedness === 'left' ? 'ltr' : 'rtl'
  return isReversed(rowNumber, project.workingMethod) ? (start === 'rtl' ? 'ltr' : 'rtl') : start
}

export function rowCells(project, rowNumber) {
  return project.grid?.[rowNumber - 1] || []
}

/** Run-length encode the current row in the direction it will be worked. */
export function runsForRow(project, rowNumber) {
  const canonical = rowCells(project, rowNumber)
  const cells = rowDirection(project, rowNumber) === 'rtl' ? [...canonical].reverse() : canonical
  const runs = []
  for (const v of cells) {
    const last = runs[runs.length - 1]
    if (last && last.index === v) last.count++
    else runs.push({ index: v, count: 1 })
  }
  return runs
}

/** Persist explicit row numbers, accepting legacy numeric counts on read. */
export function completedRowNumbers(project) {
  const total = Math.max(0, Math.floor(Number(project.totalRows) || 0))
  if (Array.isArray(project.completedRows)) {
    return [...new Set(project.completedRows.filter((r) => Number.isInteger(r) && r >= 1 && r <= total))].sort((a, b) => a - b)
  }
  const count = Number.isFinite(project.completedRows) ? project.completedRows : (Number(project.currentRow) || 1) - 1
  return Array.from({ length: Math.max(0, Math.min(total, Math.floor(count))) }, (_, i) => i + 1)
}

export const percentDone = (project) => project.totalRows > 0
  ? Math.round(completedRowNumbers(project).length / project.totalRows * 100) : 0

export function completeRowPatch(project) {
  const currentRow = clampRow(project, project.currentRow)
  return {
    completedRows: [...new Set([...completedRowNumbers(project), currentRow])].sort((a, b) => a - b),
    currentRow: clampRow(project, currentRow + 1), currentRun: 0,
  }
}

export const hasStarted = (project) => Boolean(project.chartStarted || project.startedAt || project.currentRow > 1 || project.currentRun > 0 || completedRowNumbers(project).length)

export const clampRow = (project, n) => Math.max(1, Math.min(Number(project.totalRows) || 1, Math.floor(Number(n) || 1)))

export function gaugeAspect(project) {
  return stitchAspect(project)
}

/** Immutable four-connected fill. No recursion or writes to the saved grid. */
export function editCells(grid, row, column, color, tool = 'paint') {
  if (!Number.isInteger(row) || !Number.isInteger(column) || !Number.isInteger(color) || color < 0
      || !grid[row] || column < 0 || column >= grid[row].length || !['paint', 'fill'].includes(tool)) return grid
  const source = grid[row][column]
  if (source === color) return grid
  const next = grid.map((cells) => [...cells])
  next[row][column] = color
  if (tool === 'paint') return next
  const stack = [[row, column]]
  while (stack.length) {
    const [r, c] = stack.pop()
    for (const [y, x] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      if (y >= 0 && y < next.length && x >= 0 && x < next[y].length && next[y][x] === source) {
        next[y][x] = color
        stack.push([y, x])
      }
    }
  }
  return next
}

/** Window of rows to render around the marker, newest first (work grows upward). */
export function visibleRows(project, above = 35, below = 25) {
  const top = Math.min(project.totalRows, project.currentRow + above)
  const bottom = Math.max(1, project.currentRow - below)
  const out = []
  for (let r = top; r >= bottom; r--) out.push(r)
  return out
}
