import { useRef, useState } from 'react'
import { EditorProvider, useEditor } from './EditorContext'
import ImageCanvas from './ImageCanvas'
import { EDITOR_STAGES } from './model'
import StageRail, { panelIdFor, STAGE_LABELS, tabIdFor } from './StageRail'
import FrameStage from './stages/FrameStage'
import GridStage from './stages/GridStage'
import ImageStage from './stages/ImageStage'
import YarnStage from './stages/YarnStage'
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
        <button type="button" disabled aria-label="Redo">Redo</button>
      </header>

      {saveBlocked && (
        <div className="editor-escape">
          <button className="press" type="button" disabled={actionPending} onClick={() => onBack?.(draft)}>
            Leave without saving
          </button>
        </div>
      )}

      <section className="editor-preview" aria-label="Chart preview">
        {image?.src ? <ImageCanvas image={image} draft={draft} dispatch={dispatch} /> : null}
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
            image={image}
            actionPending={actionPending}
            onGenerate={() => void completeAction(onGenerate)}
          />
        ))}
      </div>
      {error && <div className="editor-action-alert" role="alert">{error}</div>}
    </main>
  )
}

function EditorPanel({ stage, activeStage, draft, dispatch, image, actionPending, onGenerate }) {
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
      {stage === 'grid' && <GridStage draft={draft} dispatch={dispatch} />}
      {stage === 'image' && <ImageStage draft={draft} dispatch={dispatch} />}
      {stage === 'yarn' && <YarnStage draft={draft} dispatch={dispatch} image={image} />}
      {stage === 'review' && <ReviewStage draft={draft} actionPending={actionPending} onGenerate={onGenerate} />}
    </section>
  )
}

function ReviewStage({ draft, actionPending, onGenerate }) {
  const grid = draft.grid
  const summary = [
    ['Grid', `${grid.columns} × ${grid.rows}`],
    ['Stitches', `${grid.columns * grid.rows}`],
    ['Colours', `${draft.image?.colorCount ?? 4}`],
    ['Worked', grid.workingMethod === 'round' ? 'In the round' : 'Turned rows'],
  ]

  return (
    <div className="editor-controls">
      <dl className="editor-summary">
        {summary.map(([term, detail]) => (
          <div className="editor-summary-row" key={term}>
            <dt className="editor-field-label">{term}</dt>
            <dd className="mono">{detail}</dd>
          </div>
        ))}
      </dl>
      <button className="pill-primary press" type="button" disabled={actionPending} onClick={onGenerate}>
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
