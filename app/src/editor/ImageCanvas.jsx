import { useRef } from 'react'
import { sourceRectForDraft } from './geometry'

const clampOffset = (value) => Math.max(-1, Math.min(1, value))

const cropPositionForDraft = (draft) => {
  if (!draft.source?.width || !draft.source?.height) return '50% 50%'

  const { sx, sy, sw, sh } = sourceRectForDraft(draft)
  return `${((sx + sw / 2) / draft.source.width) * 100}% ${((sy + sh / 2) / draft.source.height) * 100}%`
}

export default function ImageCanvas({ image, draft, dispatch }) {
  const drag = useRef(null)
  const { transform, grid } = draft
  const cropEnabled = draft.fitMode === 'crop'
  const imagePosition = cropPositionForDraft(draft)
  const moveBy = (dx, dy, origin = transform) => dispatch({
    type: 'transform/patch',
    patch: {
      offsetX: clampOffset(origin.offsetX + dx),
      offsetY: clampOffset(origin.offsetY + dy),
    },
  })
  const updateDrag = (event) => {
    if (!drag.current) return

    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    moveBy(
      ((event.clientX - drag.current.x) / rect.width) * 2,
      ((event.clientY - drag.current.y) / rect.height) * 2,
      drag.current.transform,
    )
  }
  const onKeyDown = (event) => {
    const moves = { ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, -0.02], ArrowDown: [0, 0.02] }
    if (!cropEnabled || !moves[event.key]) return

    event.preventDefault()
    moveBy(...moves[event.key])
  }

  return (
    <div
      className="editor-image-canvas"
      role="application"
      aria-label="Position source image"
      aria-disabled={!cropEnabled}
      tabIndex="0"
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (!cropEnabled) return
        drag.current = { x: event.clientX, y: event.clientY, transform }
        event.currentTarget.setPointerCapture?.(event.pointerId)
      }}
      onPointerMove={updateDrag}
      onPointerUp={(event) => {
        updateDrag(event)
        drag.current = null
        event.currentTarget.releasePointerCapture?.(event.pointerId)
      }}
      onPointerCancel={() => { drag.current = null }}
      style={{ '--grid-x': `${100 / grid.columns}%`, '--grid-y': `${100 / grid.rows}%` }}
    >
      <img
        src={image.src}
        alt="Source preview"
        draggable="false"
        style={{
          objectFit: cropEnabled ? 'cover' : 'fill',
          objectPosition: imagePosition,
          transform: `scale(${cropEnabled ? transform.scale : 1}) rotate(${transform.rotation}deg) scaleX(${transform.flipX ? -1 : 1}) scaleY(${transform.flipY ? -1 : 1})`,
        }}
      />
      <span className="editor-grid-overlay" aria-hidden="true" />
    </div>
  )
}
