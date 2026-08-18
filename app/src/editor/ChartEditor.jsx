import { EditorProvider, useEditor } from './EditorContext'
import StageRail, { panelIdFor, STAGE_LABELS, tabIdFor } from './StageRail'
import './editor.css'

const saveStateLabel = (saveState) => {
  if (saveState === 'saved') return 'Saved'
  if (saveState === 'error') return 'Unable to save changes'
  if (saveState === 'saving') return 'Saving changes…'
  return 'Preparing save…'
}

function EditorShell({ image, onBack, onGenerate }) {
  const { draft, dispatch, saveState } = useEditor()
  const label = STAGE_LABELS[draft.activeStage]

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
        {image?.src ? <img src={image.src} alt="Source preview" /> : null}
      </section>

      <StageRail activeStage={draft.activeStage} dispatch={dispatch} />

      <section
        id={panelIdFor(draft.activeStage)}
        className="editor-sheet"
        role="tabpanel"
        aria-label={label}
        aria-labelledby={tabIdFor(draft.activeStage)}
      >
        <h2>{label}</h2>
        {draft.activeStage === 'frame' && <p>Frame controls</p>}
        {draft.activeStage === 'grid' && <p>Grid controls</p>}
        {draft.activeStage === 'image' && <p>Image controls arrive in phase 2.</p>}
        {draft.activeStage === 'yarn' && <p>Yarn mapping arrives in phase 3.</p>}
        {draft.activeStage === 'review' && (
          <button className="pill-primary" type="button" onClick={() => onGenerate(draft)}>
            Generate chart
          </button>
        )}
      </section>
    </main>
  )
}

export default function ChartEditor({ draft, image, onBack, onGenerate }) {
  return (
    <EditorProvider initialDraft={draft}>
      <EditorShell image={image} onBack={onBack} onGenerate={onGenerate} />
    </EditorProvider>
  )
}
