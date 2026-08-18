import { useCallback, useEffect, useRef } from 'react'
import { drawDraftToCanvas } from './geometry'

const clampOffset = (value) => Math.max(-1, Math.min(1, value))

const frameForGrid = (grid) => {
  const cellWidth = grid.gauge === 'square' ? 1 : 11
  const cellHeight = grid.gauge === 'square' ? 1 : 9
  const width = grid.columns * cellWidth
  const height = grid.rows * cellHeight

  return { width, height, aspect: width / height }
}

export default function ImageCanvas({ image, draft, dispatch }) {
  const canvasRef = useRef(null)
  const sourceRef = useRef(null)
  const drag = useRef(null)
  const { transform, grid } = draft
  const cropEnabled = draft.fitMode === 'crop'
  const frame = frameForGrid(grid)
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const source = sourceRef.current
    const context = canvas?.getContext('2d')
    if (!context || !source) return

    drawDraftToCanvas(context, source, draft)
  }, [draft])

  useEffect(() => {
    if (sourceRef.current?.complete && sourceRef.current.naturalWidth > 0) draw()
  }, [draw, image.src])

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
      onPointerCancel={(event) => {
        drag.current = null
        event.currentTarget.releasePointerCapture?.(event.pointerId)
      }}
      style={{
        '--frame-aspect': frame.aspect,
        '--grid-x': `${100 / grid.columns}%`,
        '--grid-y': `${100 / grid.rows}%`,
      }}
    >
      <canvas ref={canvasRef} role="img" aria-label="Source preview" width={frame.width} height={frame.height} />
      <img ref={sourceRef} className="editor-canvas-source" data-testid="source-image" src={image.src} alt="" aria-hidden="true" onLoad={draw} />
      <span className="editor-grid-overlay" aria-hidden="true" />
    </div>
  )
}
