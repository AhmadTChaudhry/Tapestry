import { useRef } from 'react'
import { EDITOR_STAGES } from './model'

export const STAGE_LABELS = {
  frame: 'Frame',
  grid: 'Grid',
  image: 'Image',
  yarn: 'Yarn',
  review: 'Review',
}

const panelIdFor = (stage) => `editor-stage-panel-${stage}`
const tabIdFor = (stage) => `editor-stage-tab-${stage}`

export default function StageRail({ activeStage, dispatch }) {
  const tabRefs = useRef(new Map())

  const activateStage = (stage) => {
    dispatch({ type: 'stage/set', stage })
  }

  const handleKeyDown = (event, stage) => {
    const currentIndex = EDITOR_STAGES.indexOf(stage)
    let nextIndex

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % EDITOR_STAGES.length
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + EDITOR_STAGES.length) % EDITOR_STAGES.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = EDITOR_STAGES.length - 1
        break
      default:
        return
    }

    event.preventDefault()
    const nextStage = EDITOR_STAGES[nextIndex]
    activateStage(nextStage)
    tabRefs.current.get(nextStage)?.focus()
  }

  return (
    <div className="editor-stage-rail no-bar" role="tablist" aria-label="Editor stages">
      {EDITOR_STAGES.map((stage) => (
        <button
          key={stage}
          ref={(element) => {
            if (element) tabRefs.current.set(stage, element)
            else tabRefs.current.delete(stage)
          }}
          id={tabIdFor(stage)}
          className="editor-stage-tab"
          type="button"
          role="tab"
          aria-selected={activeStage === stage}
          aria-controls={panelIdFor(stage)}
          tabIndex={activeStage === stage ? 0 : -1}
          onClick={() => activateStage(stage)}
          onKeyDown={(event) => handleKeyDown(event, stage)}
        >
          {STAGE_LABELS[stage]}
        </button>
      ))}
    </div>
  )
}

export { panelIdFor, tabIdFor }
