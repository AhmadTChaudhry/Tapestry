export default function FrameStage({ draft, dispatch }) {
  const { transform } = draft
  const cropEnabled = draft.fitMode === 'crop'
  const patch = (value) => dispatch({ type: 'transform/patch', patch: value })

  return (
    <div className="editor-controls">
      <fieldset className="editor-group">
        <legend className="editor-field-label">Image fit</legend>
        <div className="editor-segmented">
          <label className="editor-choice">
            <input type="radio" name="fit" checked={cropEnabled} onChange={() => dispatch({ type: 'fit/set', value: 'crop' })} />
            <span>Crop to fit</span>
          </label>
          <label className="editor-choice">
            <input type="radio" name="fit" checked={!cropEnabled} onChange={() => dispatch({ type: 'fit/set', value: 'stretch' })} />
            <span>Stretch to fit</span>
          </label>
        </div>
      </fieldset>

      <label className="editor-control">
        <span className="editor-field-label">Scale</span>
        <output className="editor-field-value mono">{Math.round(transform.scale * 100)}%</output>
        <input
          className="stitch-slider"
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={transform.scale}
          aria-label="Scale"
          disabled={!cropEnabled}
          style={{ '--fill': `${((transform.scale - 1) / 2) * 100}%` }}
          onChange={(event) => patch({ scale: Number(event.target.value) })}
        />
      </label>

      <div className="editor-actions">
        <button className="press" type="button" onClick={() => dispatch({ type: 'transform/rotate', degrees: transform.rotation - 90 })}>Rotate left</button>
        <button className="press" type="button" onClick={() => dispatch({ type: 'transform/rotate', degrees: transform.rotation + 90 })}>Rotate right</button>
        <button className="press" type="button" onClick={() => patch({ flipX: !transform.flipX })}>Flip horizontal</button>
        <button className="press" type="button" onClick={() => patch({ flipY: !transform.flipY })}>Flip vertical</button>
        <button className="press" type="button" disabled={!cropEnabled} onClick={() => patch({ offsetX: 0, offsetY: 0 })}>Recenter</button>
        <button className="press" type="button" onClick={() => dispatch({ type: 'transform/reset' })}>Reset frame</button>
      </div>
    </div>
  )
}
