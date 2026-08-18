export default function FrameStage({ draft, dispatch }) {
  const { transform } = draft
  const cropEnabled = draft.fitMode === 'crop'
  const patch = (value) => dispatch({ type: 'transform/patch', patch: value })

  return (
    <div className="editor-controls">
      <fieldset className="editor-segmented">
        <legend>Image fit</legend>
        <label>
          <input type="radio" name="fit" checked={cropEnabled} onChange={() => dispatch({ type: 'fit/set', value: 'crop' })} />
          Crop to fit
        </label>
        <label>
          <input type="radio" name="fit" checked={!cropEnabled} onChange={() => dispatch({ type: 'fit/set', value: 'stretch' })} />
          Stretch to fit
        </label>
      </fieldset>

      <label className="editor-control">
        Scale <output>{Math.round(transform.scale * 100)}%</output>
        <input
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={transform.scale}
          aria-label="Scale"
          disabled={!cropEnabled}
          onChange={(event) => patch({ scale: Number(event.target.value) })}
        />
      </label>

      <div className="editor-actions">
        <button type="button" onClick={() => dispatch({ type: 'transform/rotate', degrees: transform.rotation - 90 })}>Rotate left</button>
        <button type="button" onClick={() => dispatch({ type: 'transform/rotate', degrees: transform.rotation + 90 })}>Rotate right</button>
        <button type="button" onClick={() => patch({ flipX: !transform.flipX })}>Flip horizontal</button>
        <button type="button" onClick={() => patch({ flipY: !transform.flipY })}>Flip vertical</button>
        <button type="button" disabled={!cropEnabled} onClick={() => patch({ offsetX: 0, offsetY: 0 })}>Recenter</button>
        <button type="button" onClick={() => dispatch({ type: 'transform/reset' })}>Reset frame</button>
      </div>
    </div>
  )
}
