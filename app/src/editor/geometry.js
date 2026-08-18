export function sourceRectForDraft(draft) {
  const { width, height } = draft.source
  if (draft.fitMode === 'stretch') return { sx: 0, sy: 0, sw: width, sh: height }

  const stitchAspect = draft.grid.gauge === 'square' ? 1 : 11 / 9
  const outputAspect = (draft.grid.columns / draft.grid.rows) * stitchAspect
  const sourceAspect = width / height
  let sw = width
  let sh = height
  if (sourceAspect > outputAspect) sw = height * outputAspect
  else sh = width / outputAspect

  const scaledW = sw / draft.transform.scale
  const scaledH = sh / draft.transform.scale
  const maxX = (width - scaledW) / 2
  const maxY = (height - scaledH) / 2
  return {
    sx: Math.max(0, Math.min(width - scaledW, maxX + draft.transform.offsetX * maxX)),
    sy: Math.max(0, Math.min(height - scaledH, maxY + draft.transform.offsetY * maxY)),
    sw: scaledW,
    sh: scaledH,
  }
}

export function drawDraftToCanvas(ctx, image, draft) {
  const { sx, sy, sw, sh } = sourceRectForDraft(draft)
  const { width, height } = ctx.canvas
  ctx.save()
  ctx.translate(width / 2, height / 2)
  ctx.rotate((draft.transform.rotation * Math.PI) / 180)
  ctx.scale(draft.transform.flipX ? -1 : 1, draft.transform.flipY ? -1 : 1)
  ctx.drawImage(image, sx, sy, sw, sh, -width / 2, -height / 2, width, height)
  ctx.restore()
}
