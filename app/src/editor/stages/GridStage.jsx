import { useEffect, useRef, useState } from 'react'
import { buildDraftChart, drawChart } from '../../lib/conversion'
import { finishedSize, suggestedRows, stitchAspect } from '../../lib/gauge'
import { sourceRectForDraft } from '../geometry'

/** A number field that lets you finish typing before the value is clamped.
 *  Committing eagerly meant "50" was unreachable: the leading "5" clamped
 *  straight to the minimum of 8. */
function CommittedNumber({ label, value, min, max, disabled, onCommit }) {
  const [text, setText] = useState(String(value))

  useEffect(() => { setText(String(value)) }, [value])

  const commit = () => {
    if (text.trim() === '') return setText(String(value))
    const next = Number(text)
    if (!Number.isFinite(next)) return setText(String(value))
    onCommit(Math.max(min, Math.min(max, Math.round(next))))
  }

  return (
    <label className="editor-control">
      <span className="editor-field-label">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={text}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          commit()
        }}
      />
    </label>
  )
}

export default function GridStage({ draft, dispatch, image }) {
  const { grid } = draft
  const patch = (value) => dispatch({ type: 'grid/patch', patch: value })
  const crop = draft.source && draft.transform ? sourceRectForDraft(draft) : { sw: Infinity, sh: Infinity }
  const quarterTurn = (draft.transform?.rotation || 0) % 180 !== 0
  const lowResolution = (quarterTurn ? crop.sh : crop.sw) < grid.columns || (quarterTurn ? crop.sw : crop.sh) < grid.rows
  const size = finishedSize(grid)

  return (
    <div className="editor-controls">
      {image && <div className="quality-presets" aria-label="Detail comparisons">
        {[['Simple', 24], ['Balanced', 48], ['Detailed', 96]].map(([label, columns]) => <DetailChoice key={label} label={label} columns={columns} draft={draft} image={image} onPick={() => patch({ columns, rows: suggestedRows(draft, columns) })} />)}
      </div>}
      <p className="editor-note">One cell is one stitch. Doubling both dimensions means four times the work. Simple shapes can use a small grid; photographs usually need more detail.</p>
      <CommittedNumber
        label="Stitches wide"
        value={grid.columns}
        min={8}
        max={120}
        onCommit={(value) => dispatch({ type: 'grid/set-columns', value })}
      />
      <CommittedNumber
        label="Rows high"
        value={grid.rows}
        min={8}
        max={400}
        disabled={grid.dimensionsLocked}
        onCommit={(value) => dispatch({ type: 'grid/set-rows', value })}
      />
      <label className="editor-check">
        <input type="checkbox" checked={grid.dimensionsLocked} onChange={(event) => patch({ dimensionsLocked: event.target.checked })} />
        <span>Lock dimensions to the photo</span>
      </label>
      <fieldset className="editor-group">
        <legend className="editor-field-label">Stitch proportions</legend>
        <div className="editor-segmented">
          <label className="editor-choice">
            <input type="radio" name="gauge" checked={grid.gauge === 'true'} onChange={() => patch({ gauge: 'true' })} />
            <span>Estimated 11:9</span>
          </label>
          <label className="editor-choice">
            <input type="radio" name="gauge" checked={grid.gauge === 'square'} onChange={() => patch({ gauge: 'square' })} />
            <span>Square grid</span>
          </label>
        </div>
      </fieldset>
      <label className="editor-check"><input type="checkbox" checked={!!grid.swatch} onChange={e => patch({ swatch: e.target.checked ? { stitches: 18, rows: 22 } : null })} />Use my measured 10 cm swatch</label>
      {grid.swatch && <>
        <CommittedNumber label="Stitches per 10 cm" value={grid.swatch.stitches} min={1} max={100} onCommit={stitches => patch({ swatch: { ...grid.swatch, stitches } })} />
        <CommittedNumber label="Rows per 10 cm" value={grid.swatch.rows} min={1} max={100} onCommit={rows => patch({ swatch: { ...grid.swatch, rows } })} />
      </>}
      <p className="editor-note">{size ? `Finished size approximately ${size.width.toFixed(1)} × ${size.height.toFixed(1)} cm before borders.` : 'The estimate is a starting point, not a yarn-weight guarantee. Measure your own swatch for accurate proportions.'} Changing stitch proportions recalculates locked rows. The preview View menu only changes how cells are displayed.</p>
      <fieldset className="editor-group">
        <legend className="editor-field-label">Working method</legend>
        <div className="editor-segmented">
          <label className="editor-choice">
            <input type="radio" name="method" checked={grid.workingMethod === 'round'} onChange={() => patch({ workingMethod: 'round' })} />
            <span>In the round</span>
          </label>
          <label className="editor-choice">
            <input type="radio" name="method" checked={grid.workingMethod === 'turned'} onChange={() => patch({ workingMethod: 'turned' })} />
            <span>Turned rows</span>
          </label>
        </div>
      </fieldset>
      <label className="editor-control">Handedness<select aria-label="Handedness" value={grid.handedness || 'right'} onChange={e => patch({ handedness: e.target.value, startDirection: e.target.value === 'right' ? 'rtl' : 'ltr' })}><option value="right">Right-handed</option><option value="left">Left-handed</option></select></label>
      <label className="editor-control">First row direction<select aria-label="First row direction" value={grid.startDirection || (grid.handedness === 'left' ? 'ltr' : 'rtl')} onChange={e => patch({ startDirection: e.target.value })}><option value="rtl">Right to left ←</option><option value="ltr">Left to right →</option></select></label>
      {lowResolution && <p role="status" className="editor-warning">The cropped image has fewer pixels than this grid. Enlarging it cannot recover detail. Use fewer stitches or choose a sharper image; intentional pixel art is still allowed.</p>}
      <p className="editor-total mono">{grid.columns * grid.rows} stitches</p>
    </div>
  )
}

function DetailChoice({ label, columns, draft, image, onPick }) {
  const ref = useRef(null)
  const rows = suggestedRows(draft, columns)
  const [error, setError] = useState(false)
  useEffect(() => {
    try {
      const ctx = ref.current?.getContext('2d')
      if (ctx) drawChart(ctx, buildDraftChart(image, { ...draft, grid: { ...draft.grid, columns, rows } }))
      setError(false)
    } catch { setError(true) }
  }, [draft, image, columns, rows])
  return <button type="button" className="quality-choice" onClick={onPick} aria-pressed={draft.grid.columns === columns}>
    <canvas ref={ref} width={columns * 3} height={Math.round(rows * 3 * stitchAspect(draft.grid))} aria-label={`${label} preview`} />
    <strong>{label}</strong><span>{columns} × {rows}</span><small>{error ? 'Try Photo mode' : `${(columns * rows).toLocaleString()} stitches`}</small>
  </button>
}
