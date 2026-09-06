import { stitchAspect } from '../lib/gauge'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const boundedNumber = (value, min, max, fallback) => {
  const number = Number(value)
  return Number.isFinite(number) ? clamp(number, min, max) : fallback
}
const normalizedQuarterRotation = (value) => {
  const degrees = Number(value)
  if (!Number.isFinite(degrees)) return 0
  return (Math.round((((degrees % 360) + 360) % 360) / 90) * 90) % 360
}

export function sourceRectForDraft(draft) {
  const { width, height } = draft.source
  if (draft.fitMode === 'stretch') return { sx: 0, sy: 0, sw: width, sh: height }

  const outputAspect = (draft.grid.columns / draft.grid.rows) / stitchAspect(draft.grid)
  const rotation = normalizedQuarterRotation(draft.transform.rotation)
  const cropAspect = rotation % 180 === 0 ? outputAspect : 1 / outputAspect
  const sourceAspect = width / height
  let sw = width
  let sh = height
  if (sourceAspect > cropAspect) sw = height * cropAspect
  else sh = width / cropAspect

  const scale = boundedNumber(draft.transform.scale, 1, 3, 1)
  const offsetX = boundedNumber(draft.transform.offsetX, -1, 1, 0)
  const offsetY = boundedNumber(draft.transform.offsetY, -1, 1, 0)
  const scaledW = sw / scale
  const scaledH = sh / scale
  const rangeX = width - scaledW
  const rangeY = height - scaledH
  return {
    sx: clamp(rangeX * ((offsetX + 1) / 2), 0, rangeX),
    sy: clamp(rangeY * ((offsetY + 1) / 2), 0, rangeY),
    sw: scaledW,
    sh: scaledH,
  }
}

export function drawPlanForDraft(draft, canvas) {
  const rotation = normalizedQuarterRotation(draft.transform.rotation)
  const quarterTurn = rotation % 180 !== 0
  const width = quarterTurn ? canvas.height : canvas.width
  const height = quarterTurn ? canvas.width : canvas.height
  return {
    sourceRect: sourceRectForDraft(draft),
    rotation,
    scale: {
      x: draft.transform.flipX ? -1 : 1,
      y: draft.transform.flipY ? -1 : 1,
    },
    destination: { x: -width / 2, y: -height / 2, width, height },
    outputBounds: quarterTurn
      ? { width: height, height: width }
      : { width, height },
  }
}

export function drawDraftToCanvas(ctx, image, draft) {
  const plan = drawPlanForDraft(draft, ctx.canvas)
  const { sx, sy, sw, sh } = plan.sourceRect
  const { x, y, width: drawWidth, height: drawHeight } = plan.destination
  const { width: canvasWidth, height: canvasHeight } = ctx.canvas
  // The preview canvas is reused across redraws and its width/height attributes
  // only change with the grid, so rotating or panning a source with transparency
  // would otherwise composite the new frame over the last one.
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  ctx.save()
  ctx.translate(canvasWidth / 2, canvasHeight / 2)
  ctx.rotate((plan.rotation * Math.PI) / 180)
  ctx.scale(plan.scale.x, plan.scale.y)
  ctx.drawImage(image, sx, sy, sw, sh, x, y, drawWidth, drawHeight)
  ctx.restore()
}

/** Renders the draft as flat, single-colour stitch blocks — a stitch is
 *  either empty or one colour, never a gradient across the cell. Drawing
 *  straight into the full-size preview canvas would leave the browser's own
 *  smoothing blending each cell into its neighbours at the grid lines,
 *  visibly "half filling" a box. Compositing at one pixel per stitch first
 *  lets the same downscale filter quantizeToGrid relies on average each
 *  cell down to one flat colour, then that gets blitted up with smoothing
 *  off — the result matches exactly what the finished chart will show. */
export function drawStitchPreview(ctx, image, draft, buffer = document.createElement('canvas')) {
  const { columns, rows } = draft.grid
  buffer.width = columns
  buffer.height = rows
  drawDraftToCanvas(buffer.getContext('2d'), image, draft)

  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(buffer, 0, 0, width, height)
}
