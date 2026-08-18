export default function GridStage({ draft, dispatch }) {
  const { grid } = draft
  const patch = (value) => dispatch({ type: 'grid/patch', patch: value })

  return (
    <div className="editor-controls">
      <label className="editor-control">
        Stitches wide
        <input type="number" min="8" max="120" value={grid.columns} onChange={(event) => dispatch({ type: 'grid/set-columns', value: event.target.value })} />
      </label>
      <label className="editor-control">
        Rows high
        <input type="number" min="8" max="400" value={grid.rows} disabled={grid.dimensionsLocked} onChange={(event) => dispatch({ type: 'grid/set-rows', value: event.target.value })} />
      </label>
      <label className="editor-check">
        <input type="checkbox" checked={grid.dimensionsLocked} onChange={(event) => patch({ dimensionsLocked: event.target.checked })} />
        Lock dimensions
      </label>
      <fieldset>
        <legend>Gauge preview</legend>
        <label>
          <input type="radio" name="gauge" checked={grid.gauge === 'true'} onChange={() => patch({ gauge: 'true' })} />
          Aran gauge
        </label>
        <label>
          <input type="radio" name="gauge" checked={grid.gauge === 'square'} onChange={() => patch({ gauge: 'square' })} />
          Square grid
        </label>
      </fieldset>
      <fieldset>
        <legend>Working method</legend>
        <label>
          <input type="radio" name="method" checked={grid.workingMethod === 'round'} onChange={() => patch({ workingMethod: 'round' })} />
          In the round
        </label>
        <label>
          <input type="radio" name="method" checked={grid.workingMethod === 'turned'} onChange={() => patch({ workingMethod: 'turned' })} />
          Turned rows
        </label>
      </fieldset>
      <p className="mono">{grid.columns * grid.rows} stitches</p>
    </div>
  )
}
