// Measurements are stitches and rows across the same 10 cm swatch.
export function validSwatch(swatch) {
  return Number.isFinite(swatch?.stitches) && swatch.stitches > 0 && swatch.stitches <= 100
    && Number.isFinite(swatch?.rows) && swatch.rows > 0 && swatch.rows <= 100
}

export function stitchAspect(grid = {}) {
  if (validSwatch(grid.swatch)) return grid.swatch.stitches / grid.swatch.rows
  return grid.gauge === 'square' ? 1 : 9 / 11
}

export function finishedSize(grid) {
  if (!validSwatch(grid.swatch)) return null
  return { width: grid.columns / grid.swatch.stitches * 10, height: grid.rows / grid.swatch.rows * 10 }
}

export function suggestedRows(draft, columns) {
  const rotated = draft.transform?.rotation % 180 !== 0
  const aspect = rotated ? draft.source.width / draft.source.height : draft.source.height / draft.source.width
  return Math.max(8, Math.min(400, Math.round(columns * aspect / stitchAspect(draft.grid))))
}
