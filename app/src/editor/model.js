import { suggestedRows, validSwatch } from '../lib/gauge'

export const EDITOR_SCHEMA_VERSION = 1
export const EDITOR_STAGES = ['frame', 'grid', 'image', 'yarn', 'review']
export const COLOR_COUNTS = [2, 3, 4, 6]
// Neutral is 1 on every axis, so an untouched draft samples the photo as-is.
export const IMAGE_LIMITS = {
  brightness: [0.6, 1.4],
  contrast: [0.6, 1.6],
  saturation: [0, 1.8],
}
export const HEX_PATTERN = /^#[0-9a-f]{6}$/i

const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n)))
const normalizeRotation = (degrees) => (
  Math.round((((Number(degrees) % 360) + 360) % 360) / 90) * 90
) % 360
const hasFiniteNumber = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') return false
  if (typeof value === 'string' && value.trim() === '') return false
  return Number.isFinite(Number(value))
}
const hasInvalidNumericPatch = (patch, fields) => fields.some((field) => (
  patch[field] !== undefined && !hasFiniteNumber(patch[field])
))
const hasInvalidBooleanPatch = (patch, fields) => fields.some((field) => (
  patch[field] !== undefined && typeof patch[field] !== 'boolean'
))
const hasParseableTimestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))
const rowsForColumns = (draft, columns, gauge = draft.grid?.gauge || 'true') => {
  return suggestedRows({ ...draft, grid: { ...draft.grid, gauge } }, columns)
}
export const createDraftImage = () => ({
  brightness: 1,
  contrast: 1,
  saturation: 1,
  colorCount: 4,
})

const normalizeImage = (image) => {
  const next = { ...image }
  Object.entries(IMAGE_LIMITS).forEach(([field, [min, max]]) => {
    next[field] = clamp(next[field], min, max)
  })
  next.colorCount = COLOR_COUNTS.includes(Number(next.colorCount))
    ? Number(next.colorCount)
    : createDraftImage().colorCount
  return next
}

const isYarnOverride = (value) => (
  value === null
  || value === undefined
  || (
    typeof value === 'object'
    && (value.label === undefined || typeof value.label === 'string')
    && (value.hex === undefined || value.hex === null || (typeof value.hex === 'string' && HEX_PATTERN.test(value.hex)))
    && (value.sourceHex === undefined || (typeof value.sourceHex === 'string' && HEX_PATTERN.test(value.sourceHex)))
    && (value.locked === undefined || typeof value.locked === 'boolean')
  )
)

/** Fills in fields added after a draft was first written, so older saved
 *  drafts still open instead of failing validation. */
export const hydrateDraft = (draft) => ({
  ...draft,
  image: normalizeImage({ ...createDraftImage(), ...draft?.image }),
  yarns: Array.isArray(draft?.yarns) ? draft.yarns : [],
})

const normalizeTransform = (transform) => ({
  ...transform,
  offsetX: clamp(transform.offsetX, -1, 1),
  offsetY: clamp(transform.offsetY, -1, 1),
  scale: clamp(transform.scale, 1, 3),
  rotation: normalizeRotation(transform.rotation),
})

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
    image: createDraftImage(),
    yarns: [],
    activeStage: 'frame',
    createdAt: now,
    updatedAt: now,
  }
}

const touch = (draft, patch) => ({ ...draft, ...patch, updatedAt: new Date().toISOString() })

function reduceDraft(draft, action) {
  switch (action.type) {
    case 'settings/patch':
      return touch(draft, {
        ...(typeof action.patch.name === 'string' && action.patch.name.trim() ? { name: action.patch.name.trim().slice(0, 120) } : {}),
        ...(['photo', 'yarn'].includes(action.patch.paletteMode) ? { paletteMode: action.patch.paletteMode } : {}),
      })
    case 'stage/set':
      return EDITOR_STAGES.includes(action.stage) ? touch(draft, { activeStage: action.stage }) : draft
    case 'fit/set':
      return action.value === 'crop' || action.value === 'stretch'
        ? touch(draft, { fitMode: action.value })
        : draft
    case 'transform/patch':
      if (
        hasInvalidNumericPatch(action.patch || {}, ['offsetX', 'offsetY', 'scale', 'rotation'])
        || hasInvalidBooleanPatch(action.patch || {}, ['flipX', 'flipY'])
      ) return draft
      return touch(draft, { transform: normalizeTransform({ ...draft.transform, ...action.patch }) })
    case 'transform/rotate':
      if (!hasFiniteNumber(action.degrees)) return draft
      return touch(draft, { transform: { ...draft.transform, rotation: normalizeRotation(action.degrees) } })
    case 'transform/reset':
      return touch(draft, { transform: createDraftTransform() })
    case 'grid/set-columns':
      {
        if (!hasFiniteNumber(action.value)) return draft
        const columns = Math.round(clamp(action.value, 8, 120))
        const rows = draft.grid.dimensionsLocked ? rowsForColumns(draft, columns) : draft.grid.rows
        return touch(draft, { grid: { ...draft.grid, columns, rows } })
      }
    case 'grid/set-rows':
      if (!hasFiniteNumber(action.value)) return draft
      return touch(draft, { grid: { ...draft.grid, rows: Math.round(clamp(action.value, 8, 400)) } })
    case 'grid/patch':
      {
        const patch = action.patch || {}
        if (hasInvalidNumericPatch(patch, ['columns', 'rows'])) return draft
        if (patch.swatch !== undefined && patch.swatch !== null && !validSwatch(patch.swatch)) return draft
        const grid = { ...draft.grid, ...patch }
        if (patch.columns !== undefined) grid.columns = Math.round(clamp(grid.columns, 8, 120))
        if (patch.rows !== undefined) grid.rows = Math.round(clamp(grid.rows, 8, 400))
        const lockEnabled = patch.dimensionsLocked === true && draft.grid.dimensionsLocked !== true
        if (grid.dimensionsLocked && (patch.columns !== undefined || patch.gauge !== undefined || patch.swatch !== undefined || patch.rows !== undefined || lockEnabled)) {
          grid.rows = rowsForColumns({ ...draft, grid }, grid.columns, grid.gauge)
        }
        return touch(draft, { grid })
      }
    case 'image/patch':
      {
        const patch = action.patch || {}
        if (hasInvalidNumericPatch(patch, ['brightness', 'contrast', 'saturation', 'colorCount'])) return draft
        if (patch.colorCount !== undefined && !COLOR_COUNTS.includes(Number(patch.colorCount))) return draft

        const image = normalizeImage({ ...createDraftImage(), ...draft.image, ...patch })
        // Overrides are held per colour rank, so shrinking the palette drops
        // the ranks that no longer exist rather than leaving them dangling.
        const yarns = draft.yarns || []
        return touch(draft, { image, yarns })
      }
    case 'image/reset':
      return touch(draft, {
        image: { ...createDraftImage(), colorCount: draft.image?.colorCount ?? createDraftImage().colorCount },
      })
    case 'yarn/patch':
      {
        const index = Number(action.index)
        const colorCount = draft.image?.colorCount ?? createDraftImage().colorCount
        if (!Number.isInteger(index) || index < 0 || index >= 64) return draft
        if (!isYarnOverride(action.patch)) return draft

        const yarns = Array.from({ length: Math.max(colorCount, index + 1, draft.yarns?.length || 0) }, (_, i) => (draft.yarns || [])[i] ?? null)
        const merged = { ...(yarns[index] || {}), ...action.patch }
        if (typeof merged.label === 'string' && merged.label.trim() === '') delete merged.label
        if (merged.hex === null) delete merged.hex
        yarns[index] = Object.keys(merged).length > 0 ? merged : null
        return touch(draft, { yarns })
      }
    case 'yarn/reset':
      return touch(draft, { yarns: [] })
    default:
      return draft
  }
}

export function editorReducer(draft, action) {
  const { _past = [], _future = [], ...present } = draft
  if (action.type === 'history/undo') {
    if (!_past.length) return draft
    return { ..._past.at(-1), _past: _past.slice(0, -1), _future: [present, ..._future].slice(0, 20), updatedAt: new Date().toISOString() }
  }
  if (action.type === 'history/redo') {
    if (!_future.length) return draft
    return { ..._future[0], _past: [..._past, present].slice(-20), _future: _future.slice(1), updatedAt: new Date().toISOString() }
  }
  const next = reduceDraft(draft, action)
  if (next === draft || action.type === 'stage/set') return next
  if (next.grid.dimensionsLocked && next.transform.rotation !== draft.transform.rotation) {
    next.grid = { ...next.grid, rows: suggestedRows(next, next.grid.columns) }
  }
  return { ...next, _past: [..._past, present].slice(-20), _future: [] }
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
    && Number.isInteger(value.grid.columns)
    && value.grid.columns >= 8
    && value.grid.columns <= 120
  const rowsValid = typeof value?.grid?.rows === 'number'
    && Number.isInteger(value.grid.rows)
    && value.grid.rows >= 8
    && value.grid.rows <= 400
  const transformValid = typeof value?.transform?.offsetX === 'number'
    && Number.isFinite(value.transform.offsetX)
    && value.transform.offsetX >= -1
    && value.transform.offsetX <= 1
    && typeof value.transform.offsetY === 'number'
    && Number.isFinite(value.transform.offsetY)
    && value.transform.offsetY >= -1
    && value.transform.offsetY <= 1
    && typeof value.transform.scale === 'number'
    && Number.isFinite(value.transform.scale)
    && value.transform.scale >= 1
    && value.transform.scale <= 3
    && [0, 90, 180, 270].includes(value.transform.rotation)
    && typeof value.transform.flipX === 'boolean'
    && typeof value.transform.flipY === 'boolean'
  const imageValid = value?.image === undefined || (
    Object.entries(IMAGE_LIMITS).every(([field, [min, max]]) => (
      typeof value.image?.[field] === 'number'
      && Number.isFinite(value.image[field])
      && value.image[field] >= min
      && value.image[field] <= max
    ))
    && COLOR_COUNTS.includes(value.image.colorCount)
  )
  const yarnsValid = value?.yarns === undefined
    || (Array.isArray(value.yarns) && value.yarns.every(isYarnOverride))
  const valid = value?.schemaVersion === EDITOR_SCHEMA_VERSION
    && (value.grid?.swatch == null || validSwatch(value.grid.swatch))
    && (value.grid?.handedness === undefined || ['right', 'left'].includes(value.grid.handedness))
    && (value.grid?.startDirection === undefined || ['rtl', 'ltr'].includes(value.grid.startDirection))
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && value.name.trim().length > 0
    && typeof value.assetId === 'string'
    && sourceWidthValid
    && sourceHeightValid
    && (value.fitMode === 'crop' || value.fitMode === 'stretch')
    && columnsValid
    && rowsValid
    && typeof value.grid?.dimensionsLocked === 'boolean'
    && (value.grid?.gauge === 'true' || value.grid?.gauge === 'square')
    && (value.grid?.workingMethod === 'round' || value.grid?.workingMethod === 'turned')
    && transformValid
    && imageValid
    && yarnsValid
    && EDITOR_STAGES.includes(value.activeStage)
    && hasParseableTimestamp(value.createdAt)
    && hasParseableTimestamp(value.updatedAt)
  return valid ? { ok: true, draft: value } : { ok: false, reason: 'invalid-draft' }
}
