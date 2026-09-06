import { useEffect, useRef, useState } from 'react'
import { EditorProvider, useEditor } from './EditorContext'
import ImageCanvas from './ImageCanvas'
import { EDITOR_STAGES } from './model'
import StageRail, { panelIdFor, STAGE_LABELS, tabIdFor } from './StageRail'
import FrameStage from './stages/FrameStage'
import GridStage from './stages/GridStage'
import ImageStage from './stages/ImageStage'
import YarnStage from './stages/YarnStage'
import { buildDraftChart, chartComplexity } from '../lib/conversion'
import { finishedSize } from '../lib/gauge'
import './editor.css'

const saveStateLabel = (saveState) => {
  if (saveState === 'saved') return 'Saved'
  if (saveState === 'error') return 'Unable to save changes'
  if (saveState === 'saving') return 'Saving changes…'
  return 'Preparing save…'
}

function EditorShell({ error, image, onBack, onGenerate, onPersistError }) {
  const { draft, dispatch, flushDraft, saveState } = useEditor()
  const [actionPending, setActionPending] = useState(false)
  const [saveBlocked, setSaveBlocked] = useState(false)
  const [previewMode, setPreviewMode] = useState('fabric')
  const [showGrid, setShowGrid] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [highlight, setHighlight] = useState(null)
  useEffect(() => {
    if (draft.activeStage !== 'yarn') setHighlight(null)
    if (draft.activeStage === 'review') setPreviewMode('fabric')
  }, [draft.activeStage])
  const actionPendingRef = useRef(false)

  const completeAction = async (action) => {
    if (actionPendingRef.current) return
    actionPendingRef.current = true
    setActionPending(true)
    try {
      await flushDraft()
      setSaveBlocked(false)
      await action(draft)
    } catch (reason) {
      setSaveBlocked(true)
      onPersistError?.(reason)
    } finally {
      actionPendingRef.current = false
      setActionPending(false)
    }
  }

  return (
    <main className="editor-screen" aria-busy={actionPending}>
      <header className="editor-header">
        <button className="press" type="button" disabled={actionPending} onClick={() => void completeAction(onBack)} aria-label="Back">‹</button>
        <div className="editor-title">
          <strong>{draft.name}</strong>
          <span className={`editor-save-state editor-save-state--${saveState}`} role="status" aria-live="polite">
            {actionPending ? 'Saving action…' : saveStateLabel(saveState)}
          </span>
        </div>
        <div className="editor-history">
          <button type="button" disabled={!draft._past?.length || actionPending} aria-label="Undo" onClick={() => dispatch({ type: 'history/undo' })}>↶</button>
          <button type="button" disabled={!draft._future?.length || actionPending} aria-label="Redo" onClick={() => dispatch({ type: 'history/redo' })}>↷</button>
        </div>
      </header>

      {saveBlocked && (
        <div className="editor-escape">
          <button className="press" type="button" disabled={actionPending} onClick={() => onBack?.(draft)}>
            Leave without saving
          </button>
        </div>
      )}

      <section className="editor-preview-shell" aria-label="Chart preview">
        <div className="preview-toolbar">
          <label>View <select aria-label="Preview view" value={previewMode} onChange={e => setPreviewMode(e.target.value)}>
            <option value="original">Original</option><option value="chart">Stitch chart</option><option value="fabric">Fabric proportions</option>
          </select></label>
          <button aria-pressed={showGrid} onClick={() => setShowGrid(v => !v)}>Grid</button>
          <button aria-label="Zoom preview" onClick={() => setZoom(v => v === 3 ? 1 : v + 1)}>{zoom}×</button>
          {highlight !== null && <button onClick={() => setHighlight(null)}>All colours</button>}
        </div>
        <div className="editor-preview">
          {image?.src ? <ImageCanvas image={image} draft={draft} dispatch={dispatch} mode={previewMode} showGrid={showGrid} zoom={zoom} highlight={highlight} /> : null}
        </div>
      </section>

      <StageRail activeStage={draft.activeStage} dispatch={dispatch} />

      <div className="editor-sheet-stack">
        {EDITOR_STAGES.map((stage) => (
          <EditorPanel
            key={stage}
            stage={stage}
            activeStage={draft.activeStage}
            draft={draft}
            dispatch={dispatch}
            image={stage === draft.activeStage ? image : null}
            onHighlight={setHighlight}
            actionPending={actionPending}
            onGenerate={() => void completeAction(onGenerate)}
          />
        ))}
      </div>
      {error && <div className="editor-action-alert" role="alert">{error}</div>}
    </main>
  )
}

function EditorPanel({ stage, activeStage, draft, dispatch, image, actionPending, onGenerate, onHighlight }) {
  const label = STAGE_LABELS[stage]

  return (
    <section
      id={panelIdFor(stage)}
      className="editor-sheet"
      role="tabpanel"
      aria-label={label}
      aria-labelledby={tabIdFor(stage)}
      hidden={stage !== activeStage}
    >
      <h2>{label}</h2>
      {stage === 'frame' && <FrameStage draft={draft} dispatch={dispatch} />}
      {stage === 'grid' && <GridStage draft={draft} dispatch={dispatch} image={image} />}
      {stage === 'image' && <ImageStage draft={draft} dispatch={dispatch} />}
      {stage === 'yarn' && <YarnStage draft={draft} dispatch={dispatch} image={image} onHighlight={onHighlight} />}
      {stage === 'review' && <ReviewStage draft={draft} image={image} dispatch={dispatch} actionPending={actionPending} onGenerate={onGenerate} />}
    </section>
  )
}

function ReviewStage({ draft, image, dispatch, actionPending, onGenerate }) {
  const grid = draft.grid
  let chart, error
  try { if (image) chart = buildDraftChart(image, draft) } catch (reason) { error = reason.message }
  const size = finishedSize(grid)
  const complexity = chart ? chartComplexity(chart) : null
  const summary = [
    ['Grid', `${grid.columns} × ${grid.rows}`],
    ['Stitches', `${grid.columns * grid.rows}`],
    ['Colours', `${chart?.colors.length ?? draft.image?.colorCount ?? 4}`],
    ['Worked', grid.workingMethod === 'round' ? 'In the round' : 'Turned rows'],
  ]

  return (
    <div className="editor-controls">
      <label className="editor-control">Project name<input aria-label="Project name" defaultValue={draft.name} key={draft.name} onBlur={e => dispatch({ type: 'settings/patch', patch: { name: e.target.value } })} maxLength={120} /></label>
      <dl className="editor-summary">
        {summary.map(([term, detail]) => (
          <div className="editor-summary-row" key={term}>
            <dt className="editor-field-label">{term}</dt>
            <dd className="mono">{detail}</dd>
          </div>
        ))}
      </dl>
      <p className="editor-note">{size ? `Estimated size: ${size.width.toFixed(1)} × ${size.height.toFixed(1)} cm, before borders.` : 'Add a measured swatch in Grid to estimate the finished size.'}</p>
      {complexity && <p className="editor-note">{complexity.changes.toLocaleString()} colour changes · {complexity.singles.toLocaleString()} single-stitch runs. More changes mean more yarn handling.</p>}
      <p className="editor-note">Regenerating a chart that has been started creates a new version and keeps your existing progress safe.</p>
      {error && <p role="alert">{error}</p>}
      <button className="pill-primary press" type="button" disabled={actionPending || !!error} onClick={onGenerate}>
        Generate chart
      </button>
    </div>
  )
}

export default function ChartEditor({ draft, error, image, onBack, onGenerate, onPersistError }) {
  return (
    <EditorProvider initialDraft={draft}>
      <EditorShell
        error={error}
        image={image}
        onBack={onBack}
        onGenerate={onGenerate}
        onPersistError={onPersistError}
      />
    </EditorProvider>
  )
}
