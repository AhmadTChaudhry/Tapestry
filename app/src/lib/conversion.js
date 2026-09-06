import { quantizeToGrid, fromHex, perceptualColor, colorDistance } from './quantize'
import { rankLabel } from './chart'

export function matchedYarns(colors, yarns = []) {
  const matches = Array(colors.length).fill(null)
  const available = new Set(colors.map((_, i) => i))
  // A remembered source colour anchors a yarn choice when colour ranks move.
  const candidates = []
  yarns.forEach((yarn, oldIndex) => {
    if (!yarn) return
    if (!yarn.sourceHex) {
      if (oldIndex < colors.length) candidates.push({ yarn, index: oldIndex, distance: 0 })
      return
    }
    colors.forEach((hex, index) => candidates.push({ yarn, index, distance: colorDistance(perceptualColor(fromHex(hex)), perceptualColor(fromHex(yarn.sourceHex))) }))
  })
  const assigned = new Set()
  candidates.sort((a, b) => a.distance - b.distance).forEach(({yarn, index, distance}) => {
    if (!assigned.has(yarn) && available.has(index) && distance < 0.04) {
      matches[index] = yarn
      assigned.add(yarn)
      available.delete(index)
    }
  })
  return matches
}

export function buildDraftChart(image, draft) {
  const lockedColors = (draft.yarns || []).filter(yarn => yarn?.locked).map(yarn => yarn.sourceHex || yarn.hex).filter(Boolean)
  const options = { draft, rows: draft.grid.rows, lockedColors }
  const sampled = quantizeToGrid(image, draft.grid.columns, draft.image?.colorCount ?? 4, options)
  const matches = matchedYarns(sampled.colors, draft.yarns)
  const palette = sampled.colors.map((color, i) => matches[i]?.hex || color)
  let result = sampled
  if (draft.paletteMode === 'yarn') {
    // Include all explicitly supplied yarns, even if the source colour moved.
    const fixed = [...new Set([...(draft.yarns || []).map(y => y?.hex).filter(Boolean), ...palette])]
    result = quantizeToGrid(image, draft.grid.columns, fixed.length, { ...options, palette: fixed })
  }
  const colors = draft.paletteMode === 'yarn' ? result.colors : palette
  const labels = colors.map((hex, i) => {
    const yarn = draft.paletteMode === 'yarn'
      ? (draft.yarns || []).find(y => y?.hex?.toUpperCase() === hex.toUpperCase())
      : matches[i]
    return yarn?.label || rankLabel(i)
  })
  // Two yarns assigned the same swatch become one actual colour in the chart.
  const unique = [...new Set(colors.map(c => c.toUpperCase()))]
  const remap = colors.map(c => unique.indexOf(c.toUpperCase()))
  const grid = result.grid.map(row => row.map(i => remap[i]))
  const counts = unique.map((_, index) => grid.reduce((sum, row) => sum + row.filter(i => i === index).length, 0))
  return { ...result, grid, counts, colors: unique, sourceColors: sampled.colors, matchedYarns: matches, yarnLabels: unique.map(hex => labels[colors.findIndex(c => c.toUpperCase() === hex)]) }
}

export function drawChart(ctx, chart, { highlight = null } = {}) {
  const rows = chart.grid.length
  const columns = chart.grid[0]?.length || 1
  const cw = ctx.canvas.width / columns
  const ch = ctx.canvas.height / rows
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  chart.grid.forEach((row, y) => row.forEach((index, x) => {
    ctx.globalAlpha = highlight === null || index === highlight ? 1 : 0.15
    ctx.fillStyle = chart.colors[index]
    const left = Math.round(x * cw), top = Math.round((rows - 1 - y) * ch)
    ctx.fillRect(left, top, Math.round((x + 1) * cw) - left, Math.round((rows - y) * ch) - top)
  }))
  ctx.globalAlpha = 1
}

export function chartComplexity(chart) {
  let changes = 0
  let singles = 0
  chart.grid.forEach(row => row.forEach((color, i) => {
    if (i > 0 && row[i - 1] !== color) changes++
    if ((i === 0 || row[i - 1] !== color) && (i === row.length - 1 || row[i + 1] !== color)) singles++
  }))
  return { changes, singles }
}
