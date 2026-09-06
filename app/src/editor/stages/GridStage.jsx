import { useEffect, useState } from 'react'

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

export default function GridStage({ draft, dispatch }) {
  const { grid } = draft
  const patch = (value) => dispatch({ type: 'grid/patch', patch: value })

  return (
    <div className="editor-controls">
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
        <legend className="editor-field-label">Gauge preview</legend>
        <div className="editor-segmented">
          <label className="editor-choice">
            <input type="radio" name="gauge" checked={grid.gauge === 'true'} onChange={() => patch({ gauge: 'true' })} />
            <span>Aran gauge</span>
          </label>
          <label className="editor-choice">
            <input type="radio" name="gauge" checked={grid.gauge === 'square'} onChange={() => patch({ gauge: 'square' })} />
            <span>Square grid</span>
          </label>
        </div>
      </fieldset>
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
      <p className="editor-total mono">{grid.columns * grid.rows} stitches</p>
    </div>
  )
}
