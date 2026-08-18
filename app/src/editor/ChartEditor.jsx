import { EditorProvider, useEditor } from './EditorContext'
import ImageCanvas from './ImageCanvas'
import { EDITOR_STAGES } from './model'
import StageRail, { panelIdFor, STAGE_LABELS, tabIdFor } from './StageRail'
import FrameStage from './stages/FrameStage'
import GridStage from './stages/GridStage'
import './editor.css'

const saveStateLabel = (saveState) => {
  if (saveState === 'saved') return 'Saved'
  if (saveState === 'error') return 'Unable to save changes'
  if (saveState === 'saving') return 'Saving changes…'
  return 'Preparing save…'
}

function EditorShell({ image, onBack, onGenerate }) {
  const { draft, dispatch, saveState } = useEditor()

  return (
    <main className="editor-screen">
      <header className="editor-header">
        <button className="press" type="button" onClick={onBack} aria-label="Back">‹</button>
        <div className="editor-title">
          <strong>{draft.name}</strong>
          <span className={`editor-save-state editor-save-state--${saveState}`} role="status" aria-live="polite">
            {saveStateLabel(saveState)}
          </span>
        </div>
        <button type="button" disabled aria-label="Redo">Redo</button>
      </header>

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
            onGenerate={onGenerate}
          />
        ))}
      </div>
    </main>
  )
}

function EditorPanel({ stage, activeStage, draft, dispatch, onGenerate }) {
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
      {stage === 'image' && <p>Image controls arrive in phase 2.</p>}
      {stage === 'yarn' && <p>Yarn mapping arrives in phase 3.</p>}
      {stage === 'review' && (
        <button className="pill-primary" type="button" onClick={() => onGenerate(draft)}>
          Generate chart
        </button>
      )}
    </section>
  )
}

export default function ChartEditor({ draft, image, onBack, onGenerate }) {
  return (
    <EditorProvider initialDraft={draft}>
      <EditorShell image={image} onBack={onBack} onGenerate={onGenerate} />
    </EditorProvider>
  )
}
