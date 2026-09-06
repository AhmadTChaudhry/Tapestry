import { useMemo } from 'react'

/** A proportional grid sampled from the complete chart data — a tiny chart,
 * not an image. The home card shows the whole picture, independent of the
 * maker's current row. Colours are the project's own, straight from its photo. */
export default function MiniChart({ project, size = 64 }) {
  const previewColumns = 16
  const chartAspect = project.stitchesWide > 0 && project.totalRows > 0
    ? project.stitchesWide / project.totalRows
    : 1
  const width = chartAspect < 1 ? size * chartAspect : size
  const height = chartAspect < 1 ? size : size / chartAspect
  const previewRows = Math.max(1, Math.round(previewColumns / chartAspect))
  const cells = useMemo(() => {
    const N = previewColumns
    const out = []
    for (let r = previewRows - 1; r >= 0; r--) {
      const sourceRow = Math.min(
        project.totalRows - 1,
        Math.floor((r * project.totalRows) / previewRows),
      )
      const row = project.grid[sourceRow] || []
      for (let c = 0; c < N; c++) {
        const x = Math.floor((c * project.stitchesWide) / N)
        out.push(project.colors[row[x] ?? 0] || 'transparent')
      }
    }
    return out
  }, [project, previewRows])

  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width,
          height,
          borderRadius: 8,
          border: '1px solid var(--border)',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: `repeat(${previewColumns}, 1fr)`,
          gridTemplateRows: `repeat(${previewRows}, 1fr)`,
          background: 'var(--sunken)',
        }}
      >
        {cells.map((hex, i) => (
          <div key={i} style={{ background: hex }} />
        ))}
      </div>
    </div>
  )
}
