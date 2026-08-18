// Seed projects so the list isn't empty on first run. These grids and colours
// stand in for real quantised photos; anything imported through screen 2 gets
// its colours from the photo itself. Colours are ordered dark -> light, matching
// the rank order the quantiser produces.
const W = 24
const H = 96

// ranks are dark -> light in every seed grid
const build = (fn) => {
  const grid = []
  for (let y = 0; y < H; y++) {
    const row = new Array(W)
    for (let x = 0; x < W; x++) row[x] = fn(x, y)
    grid.push(row)
  }
  return grid
}

const diamonds = build((x, y) => {
  const band = Math.floor(y / 16) % 2
  const dx = Math.abs(((x + (band ? 6 : 0)) % 12) - 6)
  const dy = Math.abs((y % 16) - 8)
  const d = dx + dy * 0.75
  if (y % 16 === 0) return 0
  if (d < 2.5) return 1
  if (d < 4.5) return 2
  return 3
})

const zigzag = build((x, y) => {
  const phase = (x + y) % 10
  const back = (x - y + 200) % 10
  if (y % 12 === 0 || y % 12 === 1) return 0
  if (phase < 2) return 1
  if (back < 2) return 2
  return 3
})

const mountains = build((x, y) => {
  const peak = Math.abs((x % 8) - 4)
  const h = (y % 20) / 20
  if (y % 20 === 19) return 0
  if (h * 5 < peak) return 3
  if (peak < 2) return 1
  return 2
})

export const seedProjects = [
  {
    id: 'fox-ferns',
    name: 'Fox & Ferns',
    stitchesWide: W,
    totalRows: H,
    colorCount: 4,
    workingMethod: 'round',
    colors: ['#2C2823', '#B4553C', '#C9964F', '#EFE7DA'],
    grid: diamonds,
    currentRow: 42,
  },
  {
    id: 'zigzag-tote',
    name: 'Zigzag tote',
    stitchesWide: W,
    totalRows: H,
    colorCount: 4,
    workingMethod: 'round',
    colors: ['#232F35', '#3E6B57', '#9DB29B', '#E9EAE3'],
    grid: zigzag,
    currentRow: 78,
  },
  {
    id: 'mountain-pillow',
    name: 'Mountain pillow',
    stitchesWide: W,
    totalRows: H,
    colorCount: 4,
    workingMethod: 'turned',
    colors: ['#3A342E', '#8A6E52', '#C7B79C', '#E8DFD1'],
    grid: mountains,
    currentRow: 12,
  },
]
