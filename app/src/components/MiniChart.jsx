import { useMemo } from 'react'

/** 16x16 grid of cells sampled from the real chart data — a tiny chart, not an
 *  image. Sampled around the current row so the thumbnail shows where the maker
 *  actually is. Colours are the project's own, straight from its photo. */
export default function MiniChart({ project, size = 64 }) {
  const cells = useMemo(() => {
    const N = 16
    const startRow = Math.max(
      0,
      Math.min(project.totalRows - N, project.currentRow - Math.floor(N / 2)),
    )
    const out = []
    for (let r = N - 1; r >= 0; r--) {
      const row = project.grid[startRow + r] || []
      for (let c = 0; c < N; c++) {
        const x = Math.floor((c * project.stitchesWide) / N)
        out.push(project.colors[row[x] ?? 0] || 'transparent')
      }
    }
    return out
  }, [project])

  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        border: '1px solid var(--border)',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: 'repeat(16, 1fr)',
        gridTemplateRows: 'repeat(16, 1fr)',
        flexShrink: 0,
        background: 'var(--sunken)',
      }}
    >
      {cells.map((hex, i) => (
        <div key={i} style={{ background: hex }} />
      ))}
    </div>
  )
}
