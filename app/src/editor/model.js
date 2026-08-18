export const EDITOR_SCHEMA_VERSION = 1
export const EDITOR_STAGES = ['frame', 'grid', 'image', 'yarn', 'review']

const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n)))
const normalizeRotation = (degrees) => ((Number(degrees) % 360) + 360) % 360
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
      return touch(draft, { transform: { ...draft.transform, ...action.patch } })
    case 'transform/rotate':
      return touch(draft, { transform: { ...draft.transform, rotation: normalizeRotation(action.degrees) } })
    case 'transform/reset':
      return touch(draft, { transform: createDraftTransform() })
    case 'grid/set-columns':
      {
        const columns = clamp(action.value, 8, 120)
        const rows = draft.grid.dimensionsLocked ? rowsForColumns(draft, columns) : draft.grid.rows
        return touch(draft, { grid: { ...draft.grid, columns, rows } })
      }
    case 'grid/set-rows':
      return touch(draft, { grid: { ...draft.grid, rows: clamp(action.value, 8, 400) } })
    case 'grid/patch':
      {
        const grid = { ...draft.grid, ...action.patch }
        if (grid.dimensionsLocked && action.patch.gauge) grid.rows = rowsForColumns(draft, grid.columns, grid.gauge)
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
  const valid = value?.schemaVersion === EDITOR_SCHEMA_VERSION
    && typeof value.id === 'string'
    && typeof value.assetId === 'string'
    && typeof value.source?.width === 'number'
    && (value.fitMode === 'crop' || value.fitMode === 'stretch')
    && typeof value.grid?.columns === 'number'
    && typeof value.grid?.rows === 'number'
  return valid ? { ok: true, draft: value } : { ok: false, reason: 'invalid-draft' }
}
