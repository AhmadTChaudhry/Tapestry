import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore, useWakeLock, tick } from '../store'
import { cellMetrics, percentDone, runsForRow, visibleRows, rowCells } from '../lib/chart'

/** Colours are labelled A, B, C… by rank, the way a written pattern does it. */
export const colorLabel = (i) => String.fromCharCode(65 + i)

export default function ChartScreen({ projectId, onBack }) {
  const { projects, gauge, gaps, theme, setGauge, setRow, toggleGaps, toggleTheme } = useStore()
  const project = projects.find((p) => p.id === projectId)
  const [zoom, setZoom] = useState(1)
  const [swipeMode, setSwipeMode] = useState(false)

  // A chart is open: hold the screen awake (README: night mode especially).
  useWakeLock(!!project)

  if (!project) return null

  const move = (delta) => {
    setRow(project.id, (r) => r + delta)
    tick()
  }
  const jump = (n) => {
    setRow(project.id, n)
    tick()
  }

  const pct = percentDone(project)
  const runs = runsForRow(project, project.currentRow)
  const shownRuns = runs.slice(0, 4)
  const moreRuns = runs.length - shownRuns.length

  return (
    <div className="screen">
      {/* Header */}
      <header
        style={{
          padding: '6px 20px 12px',
          paddingTop: 'max(6px, env(safe-area-inset-top))',
          borderBottom: '1px solid var(--hairline)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <button
          className="press"
          onClick={onBack}
          style={{ flex: 1, textAlign: 'left', minWidth: 0 }}
        >
          <div
            style={{
              fontSize: 19,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {project.name}
          </div>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--faint)',
              marginTop: 2,
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {theme === 'dark'
              ? 'NIGHT MODE · SCREEN ON'
              : `ROW ${project.currentRow} / ${project.totalRows} · ${pct}% DONE`}
          </div>
        </button>

        <HeaderPill onClick={() => setZoom((z) => (z >= 2 ? 1 : z + 0.5))} label="Zoom chart">
          ◫
        </HeaderPill>
        <HeaderPill
          onClick={() => setGauge(gauge === 'true' ? 'square' : 'true')}
          label="Toggle gauge"
          wide
        >
          {gauge === 'true' ? 'ARAN GAUGE' : 'SQUARE GRID'}
        </HeaderPill>
        <HeaderPill onClick={toggleTheme} label="Toggle night mode">
          {theme === 'dark' ? '☀' : '☾'}
        </HeaderPill>
      </header>

      <ChartScroller
        project={project}
        gauge={gauge}
        zoom={zoom}
        gaps={gaps !== false}
        swipeMode={swipeMode}
        onPickRow={jump}
        onNudge={move}
      />

      {/* Bottom control block */}
      <div
        style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--hairline)',
          padding: '12px 16px 8px',
          paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Run-length legend for the current row */}
        <div
          className="no-bar"
          style={{ display: 'flex', gap: 6, overflowX: 'auto', alignItems: 'center' }}
        >
          {shownRuns.map((run, i) => (
            <span
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--chip)',
                borderRadius: 8,
                padding: '6px 9px',
                flexShrink: 0,
              }}
            >
              <Swatch hex={project.colors[run.index]} size={11} round />
              <span className="mono" style={{ fontSize: 12, color: 'var(--ink)' }}>
                {run.count} {colorLabel(run.index)}
              </span>
            </span>
          ))}
          {moreRuns > 0 && (
            <span
              className="mono"
              style={{ fontSize: 12, color: 'var(--faint)', flexShrink: 0, paddingLeft: 2 }}
            >
              +{moreRuns} more
            </span>
          )}
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="press"
            onClick={() => move(-1)}
            aria-label="Previous row"
            style={{
              width: 68,
              height: 62,
              borderRadius: 16,
              background: 'var(--sunken)',
              fontSize: 28,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--ink)',
            }}
          >
            −
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div
              className="mono"
              style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--faint)' }}
            >
              ROW
            </div>
            <div
              className="mono"
              style={{
                fontSize: 34,
                fontWeight: 500,
                color: 'var(--accent-readout)',
                lineHeight: 1.1,
              }}
            >
              {project.currentRow}
            </div>
          </div>
          <button
            className="press"
            onClick={() => move(1)}
            aria-label="Next row"
            style={{
              width: 68,
              height: 62,
              borderRadius: 16,
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 28,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            +
          </button>
        </div>

        {/* Secondary row: the chart's own colours, keyed A/B/C… */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div
            className="no-bar"
            style={{
              flex: 1,
              height: 44,
              borderRadius: 999,
              border: '1px solid var(--border-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              overflowX: 'auto',
              padding: '0 12px',
            }}
          >
            {project.colors.map((hex, i) => (
              <span
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
              >
                <Swatch hex={hex} size={14} />
                <span className="mono" style={{ fontSize: 12, color: 'var(--body)' }}>
                  {colorLabel(i)}
                </span>
              </span>
            ))}
          </div>
          {/* Close the gaps to read the chart as continuous fabric */}
          <button
            className="press"
            onClick={toggleGaps}
            aria-pressed={gaps === false}
            aria-label="Close the gaps between stitches"
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              border: '1px solid var(--border-strong)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 15,
              flexShrink: 0,
              background: gaps === false ? 'var(--sunken)' : 'transparent',
              color: gaps === false ? 'var(--accent-readout)' : 'var(--ink)',
            }}
          >
            {gaps === false ? '■' : '▦'}
          </button>
          <button
            className="press"
            onClick={() => setSwipeMode((v) => !v)}
            aria-pressed={swipeMode}
            aria-label="Swipe to move the marker"
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              border: '1px solid var(--border-strong)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 16,
              flexShrink: 0,
              background: swipeMode ? 'var(--sunken)' : 'transparent',
              color: swipeMode ? 'var(--accent-readout)' : 'var(--ink)',
            }}
          >
            ↕
          </button>
        </div>
      </div>
    </div>
  )
}

/** Yarn colours are never dimmed or tinted — the chart must stay colour-true,
 *  so swatches carry a hairline instead of a background treatment. */
function Swatch({ hex, size, round }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: round ? 999 : 4,
        background: hex,
        boxShadow: 'inset 0 0 0 1px rgba(128,128,128,0.35)',
        flexShrink: 0,
      }}
    />
  )
}

function HeaderPill({ children, onClick, label, wide }) {
  return (
    <button
      className={wide ? 'mono press' : 'press'}
      onClick={onClick}
      aria-label={label}
      style={{
        height: 36,
        minWidth: 36,
        padding: wide ? '0 9px' : 0,
        borderRadius: 999,
        background: 'var(--sunken)',
        display: 'grid',
        placeItems: 'center',
        fontSize: wide ? 10 : 15,
        letterSpacing: wide ? '0.06em' : 0,
        color: 'var(--ink)',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

function ChartScroller({ project, gauge, zoom, gaps, swipeMode, onPickRow, onNudge }) {
  const scrollerRef = useRef(null)
  const currentRef = useRef(null)
  const [width, setWidth] = useState(375)

  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const { cellW, cellH, gapX, gapY } = cellMetrics(
    width,
    project.stitchesWide,
    gauge,
    zoom,
    gaps,
  )
  const rows = visibleRows(project)

  // Keep the current row centred whenever the marker moves.
  useEffect(() => {
    const el = currentRef.current
    const sc = scrollerRef.current
    if (!el || !sc) return
    const target = el.offsetTop - sc.clientHeight / 2 + el.offsetHeight / 2
    sc.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
  }, [project.currentRow, project.id, cellW, cellH])

  // Vertical swipe on the chart nudges the marker (README: intended, not drawn).
  const drag = useRef(null)
  const swiped = useRef(false)
  const onPointerDown = (e) => {
    swiped.current = false
    drag.current = { y: e.clientY, row: project.currentRow }
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d || !swipeMode) return
    // rows read newest-at-top: swiping up walks the marker forward
    const steps = Math.round((d.y - e.clientY) / (cellH + gapY))
    if (steps === 0) return
    swiped.current = true
    if (d.row + steps !== project.currentRow) onNudge(d.row + steps - project.currentRow)
  }
  const onPointerUp = () => {
    drag.current = null
  }

  return (
    <div
      ref={scrollerRef}
      className="no-bar"
      style={{
        flex: 1,
        // A shade deeper than the page: photo colours can be very pale, and on
        // paper the lightest ones stop reading as cells at all.
        background: 'var(--canvas)',
        // when the marker is driven by swipe, only horizontal panning is left
        overflowX: 'auto',
        overflowY: swipeMode ? 'hidden' : 'auto',
        padding: '14px 16px',
        touchAction: swipeMode ? 'pan-x' : 'pan-y',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* "safe center" keeps the row-number gutter reachable when a zoomed
          chart is wider than the viewport — plain centring clips it away */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: gapY,
          alignItems: 'safe center',
          width: 'max-content',
          minWidth: '100%',
        }}
      >
        {rows.map((r) => (
          <ChartRow
            key={r}
            ref={r === project.currentRow ? currentRef : undefined}
            rowNumber={r}
            cells={rowCells(project, r)}
            colors={project.colors}
            cellW={cellW}
            cellH={cellH}
            gapX={gapX}
            gaps={gaps}
            current={r === project.currentRow}
            worked={r < project.currentRow}
            showNumber={r % 4 === 0 || r === project.currentRow}
            onClick={() => {
              if (swiped.current) return
              onPickRow(r)
            }}
          />
        ))}
      </div>
    </div>
  )
}

const ChartRow = forwardRef(function ChartRow(
  { rowNumber, cells, colors, cellW, cellH, gapX, gaps, current, worked, showNumber, onClick },
  ref,
) {
  // The row is exactly one cell tall and the gutters use line-height 1 with
  // overflow visible: any padding or leading here would push rows apart and
  // stretch the picture vertically, which is the whole point of the gauge.
  const gutter = {
    fontSize: 10,
    lineHeight: 1,
    flexShrink: 0,
    overflow: 'visible',
    whiteSpace: 'nowrap',
  }
  return (
    <div
      ref={ref}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: cellH,
        opacity: worked ? 'var(--worked-opacity)' : 1,
        cursor: 'pointer',
      }}
    >
      <span
        className="mono"
        style={{
          ...gutter,
          width: 20,
          paddingRight: 4,
          textAlign: 'right',
          color: current ? 'var(--accent-readout)' : 'var(--faint-2)',
        }}
      >
        {showNumber ? rowNumber : ''}
      </span>
      <span
        style={{
          display: 'flex',
          gap: gapX,
          height: cellH,
          // outline, not border/padding — it must not take part in layout
          outline: current ? '2px solid var(--accent)' : 'none',
          outlineOffset: gaps ? 1 : 0,
          background: current ? 'rgba(180,85,60,0.14)' : 'transparent',
        }}
      >
        {cells.map((v, i) => (
          <span
            key={i}
            style={{
              width: cellW,
              height: cellH,
              borderRadius: gaps ? 1 : 0,
              background: colors[v] || 'transparent',
              flexShrink: 0,
            }}
          />
        ))}
      </span>
      <span
        className="mono"
        style={{ ...gutter, width: 24, paddingLeft: 4, color: 'var(--accent-readout)' }}
      >
        {current ? 'NOW' : ''}
      </span>
    </div>
  )
})
