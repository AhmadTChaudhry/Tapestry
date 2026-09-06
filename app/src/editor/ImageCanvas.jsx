import { useCallback, useEffect, useRef, useState } from 'react'
import { drawStitchPreview, drawDraftToCanvas } from './geometry'
import { buildDraftChart, drawChart } from '../lib/conversion'
import { stitchAspect } from '../lib/gauge'

const clampOffset = (value) => Math.max(-1, Math.min(1, value))

// Same operations, same order as quantize.applyImageAdjustments, so the
// preview and the charted result agree.
const previewFilter = (image) => {
  const { brightness = 1, contrast = 1, saturation = 1 } = image || {}
  if (brightness === 1 && contrast === 1 && saturation === 1) return undefined
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`
}

const frameForGrid = (grid) => {
  const cellWidth = grid.gauge === 'square' && !grid.swatch ? 1 : 11
  const cellHeight = cellWidth * stitchAspect(grid)
  const width = grid.columns * cellWidth
  const height = grid.rows * cellHeight

  return { width, height, aspect: width / height }
}

export default function ImageCanvas({ image, draft, dispatch, mode = 'source', showGrid = true, highlight = null, zoom = 1 }) {
  const [error, setError] = useState(null)
  const canvasRef = useRef(null)
  const sourceRef = useRef(null)
  const bufferRef = useRef(null)
  const drag = useRef(null)
  const { transform, grid } = draft
  const cropEnabled = draft.fitMode === 'crop'
  const frame = frameForGrid(mode === 'chart' ? { ...grid, gauge: 'square', swatch: null } : grid)
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const source = sourceRef.current
    const context = canvas?.getContext('2d')
    if (!context || !source) return

    if (!bufferRef.current) bufferRef.current = document.createElement('canvas')
    try {
      if (mode === 'original') drawDraftToCanvas(context, source, draft)
      else if (mode === 'source') drawStitchPreview(context, source, draft, bufferRef.current)
      else drawChart(context, buildDraftChart(source, draft), { highlight })
      setError(null)
    } catch (reason) {
      setError(reason.message || 'Preview unavailable. Try fewer colours or Photo mode.')
    }
  }, [draft, mode, highlight])

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
        ...(zoom > 1 ? { width: `${zoom * 100}%`, maxWidth: 'none', maxHeight: 'none' } : {}),
      }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={mode === 'source' || mode === 'original' ? 'Source preview' : 'Exact stitch preview'}
        width={mode === 'original' ? frame.width * 3 : frame.width}
        height={mode === 'original' ? frame.height * 3 : frame.height}
        style={{ filter: mode === 'source' ? previewFilter(draft.image) : undefined }}
      />
      <img ref={sourceRef} className="editor-canvas-source" data-testid="source-image" src={image.src} alt="" aria-hidden="true" onLoad={draw} />
      {showGrid && <span className="editor-grid-overlay" aria-hidden="true" />}
      {error && <p className="preview-error" role="alert">{error}</p>}
    </div>
  )
}
