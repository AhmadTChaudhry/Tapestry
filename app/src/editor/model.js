export const EDITOR_SCHEMA_VERSION = 1
export const EDITOR_STAGES = ['frame', 'grid', 'image', 'yarn', 'review']

const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n)))
const normalizeRotation = (degrees) => ((Number(degrees) % 360) + 360) % 360
const hasFiniteNumber = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') return false
  if (typeof value === 'string' && value.trim() === '') return false
  return Number.isFinite(Number(value))
}
const hasInvalidNumericPatch = (patch, fields) => fields.some((field) => (
  patch[field] !== undefined && !hasFiniteNumber(patch[field])
))
const rowsForColumns = (draft, columns, gauge = draft.grid?.gauge || 'true') => {
  const gaugeCorrection = gauge === 'square' ? 1 : 11 / 9
  return clamp(Math.round(columns * (draft.source.height / draft.source.width) * gaugeCorrection), 8, 400)
}

export function createDraft(asset, name = 'New chart') {
  const rows = clamp(Math.round(24 * (asset.height / asset.width) * (11 / 9)), 8, 400)
  const now = new Date().toISOString()
  return {
    id: `draft-${crypto.randomUUID()}`,
    schemaVersion: EDITOR_SCHEMA_VERSION,
    name,
    assetId: asset.id,
    source: { width: asset.width, height: asset.height, mimeType: asset.mimeType },
    fitMode: 'crop',
    transform: { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipX: false, flipY: false },
    grid: { columns: 24, rows, dimensionsLocked: true, gauge: 'true', workingMethod: 'round' },
    activeStage: 'frame',
    createdAt: now,
    updatedAt: now,
  }
}

const touch = (draft, patch) => ({ ...draft, ...patch, updatedAt: new Date().toISOString() })

export function editorReducer(draft, action) {
  switch (action.type) {
    case 'stage/set':
      return EDITOR_STAGES.includes(action.stage) ? touch(draft, { activeStage: action.stage }) : draft
    case 'fit/set':
      return action.value === 'crop' || action.value === 'stretch'
        ? touch(draft, { fitMode: action.value })
        : draft
    case 'transform/patch':
      if (hasInvalidNumericPatch(action.patch || {}, ['offsetX', 'offsetY', 'scale', 'rotation'])) return draft
      return touch(draft, { transform: { ...draft.transform, ...action.patch } })
    case 'transform/rotate':
      if (!hasFiniteNumber(action.degrees)) return draft
      return touch(draft, { transform: { ...draft.transform, rotation: normalizeRotation(action.degrees) } })
    case 'transform/reset':
      return touch(draft, { transform: createDraftTransform() })
    case 'grid/set-columns':
      {
        if (!hasFiniteNumber(action.value)) return draft
        const columns = clamp(action.value, 8, 120)
        const rows = draft.grid.dimensionsLocked ? rowsForColumns(draft, columns) : draft.grid.rows
        return touch(draft, { grid: { ...draft.grid, columns, rows } })
      }
    case 'grid/set-rows':
      if (!hasFiniteNumber(action.value)) return draft
      return touch(draft, { grid: { ...draft.grid, rows: clamp(action.value, 8, 400) } })
    case 'grid/patch':
      {
        const patch = action.patch || {}
        if (hasInvalidNumericPatch(patch, ['columns', 'rows'])) return draft
        const grid = { ...draft.grid, ...patch }
        if (patch.columns !== undefined) grid.columns = clamp(grid.columns, 8, 120)
        if (patch.rows !== undefined) grid.rows = clamp(grid.rows, 8, 400)
        const lockEnabled = patch.dimensionsLocked === true && draft.grid.dimensionsLocked !== true
        if (grid.dimensionsLocked && (patch.columns !== undefined || patch.gauge !== undefined || patch.rows !== undefined || lockEnabled)) {
          grid.rows = rowsForColumns(draft, grid.columns, grid.gauge)
        }
        return touch(draft, { grid })
      }
    default:
      return draft
  }
}

export const createDraftTransform = () => ({
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  rotation: 0,
  flipX: false,
  flipY: false,
})

export function validateDraft(value) {
  const sourceWidthValid = typeof value?.source?.width === 'number'
    && Number.isFinite(value.source.width)
    && value.source.width > 0
  const sourceHeightValid = typeof value?.source?.height === 'number'
    && Number.isFinite(value.source.height)
    && value.source.height > 0
  const columnsValid = typeof value?.grid?.columns === 'number'
    && Number.isFinite(value.grid.columns)
    && value.grid.columns >= 8
    && value.grid.columns <= 120
  const rowsValid = typeof value?.grid?.rows === 'number'
    && Number.isFinite(value.grid.rows)
    && value.grid.rows >= 8
    && value.grid.rows <= 400
  const valid = value?.schemaVersion === EDITOR_SCHEMA_VERSION
    && typeof value.id === 'string'
    && typeof value.assetId === 'string'
    && sourceWidthValid
    && sourceHeightValid
    && (value.fitMode === 'crop' || value.fitMode === 'stretch')
    && columnsValid
    && rowsValid
  return valid ? { ok: true, draft: value } : { ok: false, reason: 'invalid-draft' }
}
