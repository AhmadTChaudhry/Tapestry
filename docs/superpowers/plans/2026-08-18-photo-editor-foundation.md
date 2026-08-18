# Photo Editor Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current import form with the first working phase of the hybrid editor: persistent preview, crop/stretch framing, independent grid dimensions, IndexedDB-backed drafts, and generation through the existing quantizer.

**Architecture:** A versioned `EditorDraft` reducer is the source of truth for user decisions. Image blobs and drafts live in IndexedDB through a small repository boundary; React components consume the reducer through `EditorProvider`. Frame geometry is kept independent of React and passed into the quantizer so crop and stretch share one deterministic sampling path.

**Tech Stack:** React 18, Vite 6, browser Canvas 2D, IndexedDB, Vitest, Testing Library, jsdom.

## Global Constraints

- Implement only delivery phase 1 from `docs/superpowers/specs/2026-08-18-photo-to-chart-editor-design.md`.
- Support both `crop` and `stretch` fit modes; never rewrite the source image.
- Store source image assets and drafts in IndexedDB; keep only lightweight interface preferences in localStorage.
- Keep every interactive target at least 44px.
- Provide text labels in addition to color and icon-only state.
- Preserve the current working methods: `round` and `turned`.
- Preserve existing saved projects and the localStorage key `tapestry-crochet/v1`.
- Do not add yarn mapping, image-adjustment controls, cleanup brushes, fabric simulation, or worker conversion in this phase; each receives its own later implementation plan.
- The workspace is not currently a Git repository. Run the commit steps only after the user initializes or supplies Git history; do not initialize Git implicitly.

## File Structure

- `app/src/editor/model.js` — draft schema, defaults, validation, and reducer.
- `app/src/editor/draftRepository.js` — IndexedDB asset/draft persistence.
- `app/src/editor/geometry.js` — crop/stretch transforms and sampling rectangles.
- `app/src/editor/EditorContext.jsx` — reducer context and debounced autosave.
- `app/src/editor/ChartEditor.jsx` — editor shell and stage orchestration.
- `app/src/editor/ImageCanvas.jsx` — source preview, crop overlay, drag, and zoom.
- `app/src/editor/StageRail.jsx` — accessible stage navigation.
- `app/src/editor/stages/FrameStage.jsx` — fit, scale, rotation, flip, and reset controls.
- `app/src/editor/stages/GridStage.jsx` — independent dimensions, lock, gauge, and method controls.
- `app/src/editor/editor.css` — editor-only responsive styling.
- `app/src/test/setup.js` — shared DOM test setup.
- `app/src/editor/*.test.*` — focused unit and component tests next to owned code.
- `app/src/lib/quantize.js` — accept explicit output rows and frame transforms.
- `app/src/App.jsx` — route the import flow to `ChartEditor`.

---

### Task 1: Establish the test harness

**Files:**
- Modify: `app/package.json`
- Modify: `app/package-lock.json` via npm
- Modify: `app/vite.config.js`
- Create: `app/src/test/setup.js`
- Create: `app/src/editor/smoke.test.jsx`

**Interfaces:**
- Consumes: Vite's existing React plugin.
- Produces: `npm test`, `npm run test:watch`, jsdom cleanup, and DOM matchers for every later task.

- [ ] **Step 1: Add the failing smoke test**

```jsx
// app/src/editor/smoke.test.jsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

function Probe() {
  return <button>Editor ready</button>
}

describe('editor test harness', () => {
  it('renders React into jsdom', () => {
    render(<Probe />)
    expect(screen.getByRole('button', { name: 'Editor ready' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify the harness is missing**

Run: `cd app && npm test -- --run src/editor/smoke.test.jsx`

Expected: FAIL because the `test` script and Testing Library dependencies do not exist.

- [ ] **Step 3: Install and configure the test tools**

Run:

```bash
cd app
npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event fake-indexeddb
```

Add these scripts to `app/package.json`:

```json
"test": "vitest",
"test:watch": "vitest --watch"
```

Replace `app/vite.config.js` with:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5183, host: true },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    restoreMocks: true,
  },
})
```

Create:

```js
// app/src/test/setup.js
import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)
```

- [ ] **Step 4: Run the smoke test**

Run: `cd app && npm test -- --run src/editor/smoke.test.jsx`

Expected: one passing test.

- [ ] **Step 5: Commit when Git is available**

```bash
git add app/package.json app/package-lock.json app/vite.config.js app/src/test/setup.js app/src/editor/smoke.test.jsx
git commit -m "test: add editor test harness"
```

### Task 2: Define the versioned editor draft

**Files:**
- Create: `app/src/editor/model.js`
- Create: `app/src/editor/model.test.js`

**Interfaces:**
- Consumes: no application state.
- Produces: `EDITOR_SCHEMA_VERSION`, `createDraft(asset, name)`, `editorReducer(draft, action)`, and `validateDraft(value)`.

- [ ] **Step 1: Write reducer tests**

```js
// app/src/editor/model.test.js
import { describe, expect, it } from 'vitest'
import { createDraft, editorReducer, validateDraft } from './model'

const asset = { id: 'asset-1', width: 1200, height: 800, mimeType: 'image/jpeg' }

describe('editor draft', () => {
  it('creates a crop-mode draft with deterministic defaults', () => {
    const draft = createDraft(asset, 'Fox')
    expect(draft).toMatchObject({
      schemaVersion: 1,
      name: 'Fox',
      assetId: 'asset-1',
      fitMode: 'crop',
      transform: { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipX: false, flipY: false },
      grid: { columns: 24, rows: 20, dimensionsLocked: true, gauge: 'true', workingMethod: 'round' },
      activeStage: 'frame',
    })
  })

  it('clamps dimensions and normalizes rotations', () => {
    let draft = createDraft(asset, 'Fox')
    draft = editorReducer(draft, { type: 'grid/set-columns', value: 4 })
    draft = editorReducer(draft, { type: 'transform/rotate', degrees: 450 })
    expect(draft.grid.columns).toBe(8)
    expect(draft.transform.rotation).toBe(90)
  })

  it('derives rows when dimensions are locked', () => {
    let draft = createDraft(asset, 'Fox')
    draft = editorReducer(draft, { type: 'grid/set-columns', value: 48 })
    expect(draft.grid).toMatchObject({ columns: 48, rows: 39, dimensionsLocked: true })
  })

  it('rejects malformed persisted values', () => {
    expect(validateDraft({ schemaVersion: 1 })).toEqual({ ok: false, reason: 'invalid-draft' })
  })
})
```

- [ ] **Step 2: Run the tests and confirm failure**

Run: `cd app && npm test -- --run src/editor/model.test.js`

Expected: FAIL because `model.js` does not exist.

- [ ] **Step 3: Implement the schema and reducer**

```js
// app/src/editor/model.js
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
```

- [ ] **Step 4: Run the reducer tests**

Run: `cd app && npm test -- --run src/editor/model.test.js`

Expected: all three tests pass.

- [ ] **Step 5: Commit when Git is available**

```bash
git add app/src/editor/model.js app/src/editor/model.test.js
git commit -m "feat: define editor draft model"
```

### Task 3: Persist image assets and drafts in IndexedDB

**Files:**
- Create: `app/src/editor/draftRepository.js`
- Create: `app/src/editor/draftRepository.test.js`

**Interfaces:**
- Consumes: validated drafts from `model.js`.
- Produces: `saveAsset(file, dimensions)`, `getAsset(id)`, `saveDraft(draft)`, `getDraft(id)`, `getLatestDraft()`, and `deleteDraft(id)`.

- [ ] **Step 1: Write persistence tests**

```js
// app/src/editor/draftRepository.test.js
import { beforeEach, describe, expect, it } from 'vitest'
import { createDraft } from './model'
import { __resetDatabase, getAsset, getLatestDraft, saveAsset, saveDraft } from './draftRepository'

beforeEach(() => __resetDatabase())

describe('draft repository', () => {
  it('stores a blob separately from the draft', async () => {
    const file = new File(['pixels'], 'fox.png', { type: 'image/png' })
    const asset = await saveAsset(file, { width: 640, height: 480 })
    await saveDraft(createDraft(asset, 'Fox'))
    expect(await getAsset(asset.id)).toMatchObject({ width: 640, height: 480, mimeType: 'image/png' })
    expect((await getLatestDraft()).name).toBe('Fox')
  })
})
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `cd app && npm test -- --run src/editor/draftRepository.test.js`

Expected: FAIL because the repository does not exist.

- [ ] **Step 3: Implement the repository**

```js
// app/src/editor/draftRepository.js
import { validateDraft } from './model'

const DB_NAME = 'tapestry-crochet-editor'
const DB_VERSION = 1
let dbPromise

function openDatabase() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('drafts')) {
        const drafts = db.createObjectStore('drafts', { keyPath: 'id' })
        drafts.createIndex('updatedAt', 'updatedAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

async function transact(storeName, mode, operation) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const request = operation(tx.objectStore(storeName))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveAsset(blob, dimensions) {
  const asset = {
    id: `asset-${crypto.randomUUID()}`,
    blob,
    width: dimensions.width,
    height: dimensions.height,
    mimeType: blob.type || 'application/octet-stream',
  }
  await transact('assets', 'readwrite', (store) => store.put(asset))
  return asset
}

export const getAsset = (id) => transact('assets', 'readonly', (store) => store.get(id))

export async function saveDraft(draft) {
  const checked = validateDraft(draft)
  if (!checked.ok) throw new Error(checked.reason)
  await transact('drafts', 'readwrite', (store) => store.put(draft))
  return draft
}

export const getDraft = (id) => transact('drafts', 'readonly', (store) => store.get(id))
export const deleteDraft = (id) => transact('drafts', 'readwrite', (store) => store.delete(id))

export async function getLatestDraft() {
  const drafts = await transact('drafts', 'readonly', (store) => store.getAll())
  return drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null
}

export async function __resetDatabase() {
  if (dbPromise) {
    const open = await dbPromise
    open.close()
  }
  dbPromise = null
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = resolve
    request.onerror = () => reject(request.error)
    request.onblocked = resolve
  })
}
```

- [ ] **Step 4: Run persistence tests**

Run: `cd app && npm test -- --run src/editor/draftRepository.test.js`

Expected: one passing test and no open-handle warning.

- [ ] **Step 5: Commit when Git is available**

```bash
git add app/src/editor/draftRepository.js app/src/editor/draftRepository.test.js
git commit -m "feat: persist editor drafts in indexeddb"
```

### Task 4: Make crop and stretch geometry deterministic

**Files:**
- Create: `app/src/editor/geometry.js`
- Create: `app/src/editor/geometry.test.js`
- Modify: `app/src/lib/quantize.js`
- Create: `app/src/lib/quantize.test.js`

**Interfaces:**
- Consumes: `draft.source`, `draft.fitMode`, `draft.transform`, and `draft.grid`.
- Produces: `sourceRectForDraft(draft)`, `drawDraftToCanvas(ctx, image, draft)`, and `quantizeToGrid(image, columns, colorCount, options)` where `options` is `{ rows: number, draft?: EditorDraft }`.

- [ ] **Step 1: Write geometry tests**

```js
// app/src/editor/geometry.test.js
import { describe, expect, it } from 'vitest'
import { sourceRectForDraft } from './geometry'

const base = {
  source: { width: 1200, height: 800 },
  grid: { columns: 24, rows: 24, gauge: 'square' },
  transform: { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipX: false, flipY: false },
}

describe('sourceRectForDraft', () => {
  it('center-crops a landscape image to a square output', () => {
    expect(sourceRectForDraft({ ...base, fitMode: 'crop' })).toEqual({ sx: 200, sy: 0, sw: 800, sh: 800 })
  })

  it('uses the entire source in stretch mode', () => {
    expect(sourceRectForDraft({ ...base, fitMode: 'stretch' })).toEqual({ sx: 0, sy: 0, sw: 1200, sh: 800 })
  })
})
```

- [ ] **Step 2: Run the geometry tests and confirm failure**

Run: `cd app && npm test -- --run src/editor/geometry.test.js`

Expected: FAIL because `geometry.js` does not exist.

- [ ] **Step 3: Implement geometry and connect it to quantization**

```js
// app/src/editor/geometry.js
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
```

In `app/src/lib/quantize.js`, import `drawDraftToCanvas`, accept an options object, set `rows` from `options.rows`, and replace the direct `ctx.drawImage` call:

```js
import { drawDraftToCanvas } from '../editor/geometry'

function samplePixels(img, w, h, options = {}) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (options.draft) drawDraftToCanvas(ctx, img, options.draft)
  else ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const px = new Array(w * h)
  for (let i = 0; i < w * h; i++) {
    px[i] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]
  }
  return px
}

export function quantizeToGrid(img, stitchesWide, colorCount, options = {}) {
  const rows = options.rows || rowsForImage(img.width, img.height, stitchesWide)
  const px = samplePixels(img, stitchesWide, rows, options)
  const centroids = medianCut(px, colorCount).sort((a, b) => lum(a) - lum(b))
  const nearest = (p) => {
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < centroids.length; i++) {
      const c = centroids[i]
      const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }
  const grid = []
  for (let r = rows - 1; r >= 0; r--) {
    const row = new Array(stitchesWide)
    for (let x = 0; x < stitchesWide; x++) row[x] = nearest(px[r * stitchesWide + x])
    grid.push(row)
  }
  return { grid, rows, colors: centroids.map(toHex) }
}
```

Create the quantizer regression test:

```js
// app/src/lib/quantize.test.js
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { quantizeToGrid } from './quantize'

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    canvas: { width: 2, height: 3 },
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(2 * 3 * 4).fill(120) }),
  })
})

describe('quantizeToGrid options', () => {
  it('uses an explicit row count', () => {
    const result = quantizeToGrid({ width: 20, height: 20 }, 2, 2, { rows: 3 })
    expect(result.grid).toHaveLength(3)
    expect(result.grid.every((row) => row.length === 2)).toBe(true)
  })
})
```

- [ ] **Step 4: Run geometry and quantization tests**

Run: `cd app && npm test -- --run src/editor/geometry.test.js src/lib/quantize.test.js`

Expected: all tests pass; existing default quantization behavior remains unchanged when options are omitted.

- [ ] **Step 5: Commit when Git is available**

```bash
git add app/src/editor/geometry.js app/src/editor/geometry.test.js app/src/lib/quantize.js app/src/lib/quantize.test.js
git commit -m "feat: add crop and stretch sampling"
```

### Task 5: Build editor context and autosave

**Files:**
- Create: `app/src/editor/EditorContext.jsx`
- Create: `app/src/editor/EditorContext.test.jsx`

**Interfaces:**
- Consumes: `editorReducer`, `saveDraft`, and an initial validated draft.
- Produces: `<EditorProvider initialDraft>`, `useEditor()`, `{ draft, dispatch, saveState }`, with `saveState` equal to `idle`, `saving`, `saved`, or `error`.

- [ ] **Step 1: Write the autosave test**

```jsx
// app/src/editor/EditorContext.test.jsx
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EditorProvider, useEditor } from './EditorContext'
import { createDraft } from './model'

vi.mock('./draftRepository', () => ({ saveDraft: vi.fn(() => Promise.resolve()) }))

describe('EditorProvider', () => {
  it('autosaves the newest revision after a debounce', async () => {
    vi.useFakeTimers()
    const draft = createDraft({ id: 'asset-1', width: 800, height: 600, mimeType: 'image/png' })
    const wrapper = ({ children }) => <EditorProvider initialDraft={draft}>{children}</EditorProvider>
    const { result } = renderHook(() => useEditor(), { wrapper })
    act(() => result.current.dispatch({ type: 'fit/set', value: 'stretch' }))
    await act(() => vi.advanceTimersByTimeAsync(350))
    expect(result.current.saveState).toBe('saved')
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `cd app && npm test -- --run src/editor/EditorContext.test.jsx`

Expected: FAIL because the context does not exist.

- [ ] **Step 3: Implement reducer context and debounced save**

```jsx
// app/src/editor/EditorContext.jsx
import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { editorReducer } from './model'
import { saveDraft } from './draftRepository'

const EditorContext = createContext(null)

export function EditorProvider({ initialDraft, children }) {
  const [draft, dispatch] = useReducer(editorReducer, initialDraft)
  const [saveState, setSaveState] = useState('idle')

  useEffect(() => {
    setSaveState('saving')
    const timer = setTimeout(() => {
      saveDraft(draft).then(() => setSaveState('saved')).catch(() => setSaveState('error'))
    }, 300)
    return () => clearTimeout(timer)
  }, [draft])

  const value = useMemo(() => ({ draft, dispatch, saveState }), [draft, saveState])
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

export function useEditor() {
  const value = useContext(EditorContext)
  if (!value) throw new Error('useEditor must be used inside EditorProvider')
  return value
}
```

- [ ] **Step 4: Run the autosave test**

Run: `cd app && npm test -- --run src/editor/EditorContext.test.jsx`

Expected: one passing test.

- [ ] **Step 5: Commit when Git is available**

```bash
git add app/src/editor/EditorContext.jsx app/src/editor/EditorContext.test.jsx
git commit -m "feat: add editor draft autosave"
```

### Task 6: Build the hybrid shell and accessible stage rail

**Files:**
- Create: `app/src/editor/ChartEditor.jsx`
- Create: `app/src/editor/StageRail.jsx`
- Create: `app/src/editor/editor.css`
- Create: `app/src/editor/ChartEditor.test.jsx`

**Interfaces:**
- Consumes: `<EditorProvider>`, `useEditor()`, and `EDITOR_STAGES`.
- Produces: `<ChartEditor draft image onBack onGenerate>` and `<StageRail>`.

- [ ] **Step 1: Write the shell behavior test**

```jsx
// app/src/editor/ChartEditor.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import ChartEditor from './ChartEditor'
import { createDraft } from './model'

describe('ChartEditor', () => {
  it('moves between enabled editor stages', async () => {
    const user = userEvent.setup()
    const draft = createDraft({ id: 'asset-1', width: 800, height: 600, mimeType: 'image/png' })
    render(<ChartEditor draft={draft} image={{}} onBack={() => {}} onGenerate={() => {}} />)
    await user.click(screen.getByRole('tab', { name: 'Grid' }))
    expect(screen.getByRole('tabpanel', { name: 'Grid' })).toBeVisible()
    expect(screen.getByText(/saved|saving/i)).toBeVisible()
  })
})
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `cd app && npm test -- --run src/editor/ChartEditor.test.jsx`

Expected: FAIL because the shell does not exist.

- [ ] **Step 3: Implement the shell and stage semantics**

Create the stage rail:

```jsx
// app/src/editor/StageRail.jsx
import { EDITOR_STAGES } from './model'

export const STAGE_LABELS = {
  frame: 'Frame',
  grid: 'Grid',
  image: 'Image',
  yarn: 'Yarn',
  review: 'Review',
}

export default function StageRail({ activeStage, dispatch }) {
  return (
    <div className="editor-stage-rail no-bar" role="tablist" aria-label="Editor stages">
      {EDITOR_STAGES.map((stage) => (
        <button
          key={stage}
          className="editor-stage-tab"
          role="tab"
          aria-selected={activeStage === stage}
          onClick={() => dispatch({ type: 'stage/set', stage })}
        >
          {STAGE_LABELS[stage]}
        </button>
      ))}
    </div>
  )
}
```

Create the shell with temporary phase boundaries:

```jsx
// app/src/editor/ChartEditor.jsx
import { EditorProvider, useEditor } from './EditorContext'
import StageRail, { STAGE_LABELS } from './StageRail'
import './editor.css'

function EditorShell({ image, onBack, onGenerate }) {
  const { draft, dispatch, saveState } = useEditor()
  const label = STAGE_LABELS[draft.activeStage]
  return (
    <main className="editor-screen">
      <header className="editor-header">
        <button onClick={onBack} aria-label="Back">‹</button>
        <div><strong>{draft.name}</strong><small>{saveState}</small></div>
        <button type="button" disabled>Redo</button>
      </header>
      <section className="editor-preview" aria-label="Chart preview">
        {image?.src ? <img src={image.src} alt="Source preview" /> : null}
      </section>
      <StageRail activeStage={draft.activeStage} dispatch={dispatch} />
      <section className="editor-sheet" role="tabpanel" aria-label={label}>
        <h2>{label}</h2>
        {draft.activeStage === 'frame' && <p>Frame controls</p>}
        {draft.activeStage === 'grid' && <p>Grid controls</p>}
        {draft.activeStage === 'image' && <p>Image controls arrive in phase 2.</p>}
        {draft.activeStage === 'yarn' && <p>Yarn mapping arrives in phase 3.</p>}
        {draft.activeStage === 'review' && (
          <button className="pill-primary" onClick={() => onGenerate(draft)}>Generate chart</button>
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
```

Create the editor styles:

```css
/* app/src/editor/editor.css */
.editor-screen { height: 100dvh; display: grid; grid-template-rows: auto minmax(220px, 1fr) auto auto; background: var(--paper); overflow: hidden; }
.editor-header { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; gap: 8px; padding: max(8px, env(safe-area-inset-top)) 16px 8px; }
.editor-header button { min-width: 44px; min-height: 44px; }
.editor-header div { display: grid; text-align: center; min-width: 0; }
.editor-header small { color: var(--faint); text-transform: capitalize; }
.editor-preview { margin: 0 16px; border-radius: 16px; overflow: hidden; background: var(--canvas); display: grid; place-items: center; min-height: 220px; }
.editor-preview img { width: 100%; height: 100%; object-fit: contain; }
.editor-stage-rail { display: flex; gap: 7px; padding: 12px 16px; overflow-x: auto; }
.editor-stage-tab { min-height: 44px; padding: 0 14px; border-radius: 999px; background: var(--sunken); flex: 0 0 auto; }
.editor-stage-tab[aria-selected='true'] { color: white; background: var(--accent); }
.editor-sheet { min-height: 200px; padding: 18px 18px max(18px, env(safe-area-inset-bottom)); border-radius: 22px 22px 0 0; background: var(--surface); border-top: 1px solid var(--border); }
.editor-sheet h2 { margin: 0 0 14px; font-size: 20px; }
.editor-control, .editor-control input, .editor-control button { min-height: 44px; }
```

- [ ] **Step 4: Run shell and accessibility-focused tests**

Run: `cd app && npm test -- --run src/editor/ChartEditor.test.jsx`

Expected: the stage test passes with no React accessibility warnings.

- [ ] **Step 5: Commit when Git is available**

```bash
git add app/src/editor/ChartEditor.jsx app/src/editor/StageRail.jsx app/src/editor/editor.css app/src/editor/ChartEditor.test.jsx
git commit -m "feat: add hybrid editor shell"
```

### Task 7: Implement Frame and Grid stages

**Files:**
- Create: `app/src/editor/ImageCanvas.jsx`
- Create: `app/src/editor/ImageCanvas.test.jsx`
- Create: `app/src/editor/stages/FrameStage.jsx`
- Create: `app/src/editor/stages/GridStage.jsx`
- Create: `app/src/editor/stages/FrameStage.test.jsx`
- Create: `app/src/editor/stages/GridStage.test.jsx`
- Modify: `app/src/editor/ChartEditor.jsx`
- Modify: `app/src/editor/editor.css`

**Interfaces:**
- Consumes: `draft`, reducer actions from Task 2, and `sourceRectForDraft` from Task 4.
- Produces: frame controls, grid controls, and pointer-to-normalized-offset conversion in `ImageCanvas`.

- [ ] **Step 1: Write interaction tests**

```jsx
// app/src/editor/stages/FrameStage.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import FrameStage from './FrameStage'

it('switches explicitly between crop and stretch', async () => {
  const user = userEvent.setup()
  const dispatch = vi.fn()
  render(<FrameStage draft={{ fitMode: 'crop', transform: { scale: 1 } }} dispatch={dispatch} />)
  await user.click(screen.getByRole('radio', { name: 'Stretch to fit' }))
  expect(dispatch).toHaveBeenCalledWith({ type: 'fit/set', value: 'stretch' })
})
```

```jsx
// app/src/editor/stages/GridStage.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import GridStage from './GridStage'

it('lets the user unlock and edit row count independently', async () => {
  const user = userEvent.setup()
  const dispatch = vi.fn()
  const grid = { columns: 24, rows: 36, dimensionsLocked: true, gauge: 'true', workingMethod: 'round' }
  render(<GridStage draft={{ grid }} dispatch={dispatch} />)
  await user.click(screen.getByRole('checkbox', { name: 'Lock dimensions' }))
  expect(dispatch).toHaveBeenCalledWith({ type: 'grid/patch', patch: { dimensionsLocked: false } })
})
```

```jsx
// app/src/editor/ImageCanvas.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import ImageCanvas from './ImageCanvas'

it('offers keyboard positioning in crop mode', async () => {
  const user = userEvent.setup()
  const dispatch = vi.fn()
  const draft = {
    fitMode: 'crop',
    transform: { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipX: false, flipY: false },
    grid: { columns: 24, rows: 20 },
  }
  render(<ImageCanvas image={{ src: 'blob:preview' }} draft={draft} dispatch={dispatch} />)
  await user.click(screen.getByRole('application', { name: 'Position source image' }))
  await user.keyboard('{ArrowRight}')
  expect(dispatch).toHaveBeenCalledWith({ type: 'transform/patch', patch: { offsetX: 0.02, offsetY: 0 } })
})
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `cd app && npm test -- --run src/editor/stages/FrameStage.test.jsx src/editor/stages/GridStage.test.jsx src/editor/ImageCanvas.test.jsx`

Expected: FAIL because both stage components do not exist.

- [ ] **Step 3: Implement controls and preview interaction**

Create the Frame controls:

```jsx
// app/src/editor/stages/FrameStage.jsx
export default function FrameStage({ draft, dispatch }) {
  const patch = (value) => dispatch({ type: 'transform/patch', patch: value })
  const { transform } = draft
  return (
    <div className="editor-controls">
      <fieldset className="editor-segmented">
        <legend>Image fit</legend>
        <label><input type="radio" name="fit" checked={draft.fitMode === 'crop'} onChange={() => dispatch({ type: 'fit/set', value: 'crop' })} />Crop to fit</label>
        <label><input type="radio" name="fit" checked={draft.fitMode === 'stretch'} onChange={() => dispatch({ type: 'fit/set', value: 'stretch' })} />Stretch to fit</label>
      </fieldset>
      <label className="editor-control">Scale <output>{Math.round(transform.scale * 100)}%</output>
        <input type="range" min="1" max="3" step="0.01" value={transform.scale} disabled={draft.fitMode === 'stretch'} onChange={(event) => patch({ scale: Number(event.target.value) })} />
      </label>
      <div className="editor-actions">
        <button onClick={() => dispatch({ type: 'transform/rotate', degrees: transform.rotation - 90 })}>Rotate left</button>
        <button onClick={() => dispatch({ type: 'transform/rotate', degrees: transform.rotation + 90 })}>Rotate right</button>
        <button onClick={() => patch({ flipX: !transform.flipX })}>Flip horizontal</button>
        <button onClick={() => patch({ flipY: !transform.flipY })}>Flip vertical</button>
        <button onClick={() => patch({ offsetX: 0, offsetY: 0 })}>Recenter</button>
        <button onClick={() => dispatch({ type: 'transform/reset' })}>Reset frame</button>
      </div>
    </div>
  )
}
```

Create the Grid controls:

```jsx
// app/src/editor/stages/GridStage.jsx
export default function GridStage({ draft, dispatch }) {
  const { grid } = draft
  const patch = (value) => dispatch({ type: 'grid/patch', patch: value })
  return (
    <div className="editor-controls">
      <label className="editor-control">Stitches wide
        <input type="number" min="8" max="120" value={grid.columns} onChange={(event) => dispatch({ type: 'grid/set-columns', value: event.target.value })} />
      </label>
      <label className="editor-control">Rows high
        <input type="number" min="8" max="400" value={grid.rows} disabled={grid.dimensionsLocked} onChange={(event) => dispatch({ type: 'grid/set-rows', value: event.target.value })} />
      </label>
      <label className="editor-check"><input type="checkbox" checked={grid.dimensionsLocked} onChange={(event) => patch({ dimensionsLocked: event.target.checked })} />Lock dimensions</label>
      <fieldset><legend>Gauge preview</legend>
        <label><input type="radio" name="gauge" checked={grid.gauge === 'true'} onChange={() => patch({ gauge: 'true' })} />Aran gauge</label>
        <label><input type="radio" name="gauge" checked={grid.gauge === 'square'} onChange={() => patch({ gauge: 'square' })} />Square grid</label>
      </fieldset>
      <fieldset><legend>Working method</legend>
        <label><input type="radio" name="method" checked={grid.workingMethod === 'round'} onChange={() => patch({ workingMethod: 'round' })} />In the round</label>
        <label><input type="radio" name="method" checked={grid.workingMethod === 'turned'} onChange={() => patch({ workingMethod: 'turned' })} />Turned rows</label>
      </fieldset>
      <p className="mono">{grid.columns * grid.rows} stitches</p>
    </div>
  )
}
```

Create the interactive preview:

```jsx
// app/src/editor/ImageCanvas.jsx
import { useRef } from 'react'

const clampOffset = (value) => Math.max(-1, Math.min(1, value))

export default function ImageCanvas({ image, draft, dispatch }) {
  const start = useRef(null)
  const { transform, grid } = draft
  const moveBy = (dx, dy) => dispatch({ type: 'transform/patch', patch: {
    offsetX: clampOffset(transform.offsetX + dx),
    offsetY: clampOffset(transform.offsetY + dy),
  } })
  const onKeyDown = (event) => {
    const moves = { ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, -0.02], ArrowDown: [0, 0.02] }
    if (!moves[event.key] || draft.fitMode !== 'crop') return
    event.preventDefault()
    moveBy(...moves[event.key])
  }
  return (
    <div
      className="editor-image-canvas"
      role="application"
      aria-label="Position source image"
      tabIndex="0"
      onKeyDown={onKeyDown}
      onPointerDown={(event) => { if (draft.fitMode === 'crop') start.current = { x: event.clientX, y: event.clientY } }}
      onPointerUp={(event) => {
        if (!start.current) return
        const rect = event.currentTarget.getBoundingClientRect()
        moveBy((event.clientX - start.current.x) / rect.width * 2, (event.clientY - start.current.y) / rect.height * 2)
        start.current = null
      }}
      style={{ '--grid-x': `${100 / grid.columns}%`, '--grid-y': `${100 / grid.rows}%` }}
    >
      <img
        src={image.src}
        alt="Source preview"
        draggable="false"
        style={{
          objectFit: draft.fitMode === 'stretch' ? 'fill' : 'cover',
          transform: `translate(${transform.offsetX * 25}%, ${transform.offsetY * 25}%) scale(${transform.scale}) rotate(${transform.rotation}deg) scaleX(${transform.flipX ? -1 : 1}) scaleY(${transform.flipY ? -1 : 1})`,
        }}
      />
      <span className="editor-grid-overlay" aria-hidden="true" />
    </div>
  )
}
```

In `ChartEditor.jsx`, add these imports:

```jsx
import ImageCanvas from './ImageCanvas'
import FrameStage from './stages/FrameStage'
import GridStage from './stages/GridStage'
```

Replace the preview and the first two temporary panels with:

```jsx
<section className="editor-preview" aria-label="Chart preview">
  <ImageCanvas image={image} draft={draft} dispatch={dispatch} />
</section>
```

```jsx
{draft.activeStage === 'frame' && <FrameStage draft={draft} dispatch={dispatch} />}
{draft.activeStage === 'grid' && <GridStage draft={draft} dispatch={dispatch} />}
```

Append these styles to `editor.css`:

```css
.editor-image-canvas { position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: none; }
.editor-image-canvas > img { width: 100%; height: 100%; transform-origin: center; pointer-events: none; }
.editor-grid-overlay { position: absolute; inset: 0; background-image: linear-gradient(to right, rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.3) 1px, transparent 1px); background-size: var(--grid-x) var(--grid-y); pointer-events: none; }
.editor-controls { display: grid; gap: 14px; }
.editor-control { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; }
.editor-control input[type='range'] { grid-column: 1 / -1; width: 100%; }
.editor-control input[type='number'] { width: 84px; min-height: 44px; border: 1px solid var(--border); border-radius: 10px; padding: 0 10px; background: var(--surface); color: var(--ink); }
.editor-segmented, .editor-controls fieldset { border: 0; padding: 0; margin: 0; display: flex; gap: 8px; flex-wrap: wrap; }
.editor-controls legend { width: 100%; font-weight: 600; margin-bottom: 6px; }
.editor-segmented label, .editor-controls fieldset label, .editor-check { min-height: 44px; display: flex; align-items: center; gap: 7px; }
.editor-actions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.editor-actions button { min-height: 44px; border: 1px solid var(--border-strong); border-radius: 999px; }
```

- [ ] **Step 4: Run stage, reducer, and geometry tests**

Run: `cd app && npm test -- --run src/editor src/lib/quantize.test.js`

Expected: all editor and quantizer tests pass.

- [ ] **Step 5: Commit when Git is available**

```bash
git add app/src/editor/ImageCanvas.jsx app/src/editor/ImageCanvas.test.jsx app/src/editor/stages app/src/editor/ChartEditor.jsx app/src/editor/editor.css
git commit -m "feat: add frame and grid editing"
```

### Task 8: Replace the import route and generate through the editor

**Files:**
- Modify: `app/src/App.jsx`
- Modify: `app/src/screens/MyCharts.jsx`
- Modify: `app/src/lib/quantize.js`
- Create: `app/src/editor/EditorRoute.jsx`
- Create: `app/src/editor/EditorRoute.test.jsx`
- Modify: `app/README.md`

**Interfaces:**
- Consumes: repository functions, `createDraft`, `ChartEditor`, `quantizeToGrid`, and `addProject`.
- Produces: `<EditorRoute initialFile onBack onGenerated>`, resumable drafts, and generated projects matching the existing project schema.

- [ ] **Step 1: Write the route-level test**

```jsx
// app/src/editor/EditorRoute.test.jsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EditorRoute from './EditorRoute'

vi.mock('./draftRepository', () => ({
  saveAsset: vi.fn(),
  saveDraft: vi.fn(),
  getAsset: vi.fn(),
  getLatestDraft: vi.fn(() => Promise.resolve(null)),
}))
vi.mock('../store', () => ({ useStore: () => ({ addProject: vi.fn() }) }))

describe('EditorRoute', () => {
  it('shows an explicit empty import state', async () => {
    render(<EditorRoute onBack={() => {}} onGenerated={() => {}} />)
    expect(await screen.findByRole('button', { name: 'Choose a photo' })).toBeEnabled()
    expect(screen.getByText('Start a chart from a photo')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run the route test and confirm failure**

Run: `cd app && npm test -- --run src/editor/EditorRoute.test.jsx`

Expected: FAIL because `EditorRoute.jsx` does not exist.

- [ ] **Step 3: Implement file loading, draft recovery, and generation**

Create the route component:

```jsx
// app/src/editor/EditorRoute.jsx
import { useEffect, useRef, useState } from 'react'
import { loadImageFile, quantizeToGrid, revokeImage } from '../lib/quantize'
import { useStore } from '../store'
import ChartEditor from './ChartEditor'
import { getAsset, getLatestDraft, saveAsset, saveDraft } from './draftRepository'
import { createDraft } from './model'

export default function EditorRoute({ initialFile, onBack, onGenerated }) {
  const { addProject } = useStore()
  const [draft, setDraft] = useState(null)
  const [image, setImage] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const openFile = async (file) => {
    setError(null)
    try {
      const loaded = await loadImageFile(file)
      const asset = await saveAsset(file, { width: loaded.width, height: loaded.height })
      const base = file.name?.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'New chart'
      const next = createDraft(asset, base.charAt(0).toUpperCase() + base.slice(1))
      await saveDraft(next)
      setImage((previous) => { revokeImage(previous); return loaded })
      setDraft(next)
    } catch (reason) {
      setError(reason?.message || 'That image could not be opened.')
    }
  }

  useEffect(() => {
    let cancelled = false
    if (initialFile) {
      openFile(initialFile)
      return () => { cancelled = true }
    }
    getLatestDraft().then(async (saved) => {
      if (!saved || cancelled) return
      const asset = await getAsset(saved.assetId)
      if (!asset || cancelled) return
      const loaded = await loadImageFile(asset.blob)
      if (cancelled) return revokeImage(loaded)
      setImage(loaded)
      setDraft(saved)
    }).catch(() => setError('Your saved draft could not be restored.'))
    return () => { cancelled = true }
  }, [initialFile])

  useEffect(() => () => revokeImage(image), [image])

  const generate = (currentDraft) => {
    const result = quantizeToGrid(image, currentDraft.grid.columns, 4, {
      rows: currentDraft.grid.rows,
      draft: currentDraft,
    })
    const project = {
      id: `p-${Date.now()}`,
      editorDraftId: currentDraft.id,
      name: currentDraft.name,
      stitchesWide: currentDraft.grid.columns,
      totalRows: currentDraft.grid.rows,
      colorCount: result.colors.length,
      workingMethod: currentDraft.grid.workingMethod,
      colors: result.colors,
      grid: result.grid,
      currentRow: 1,
    }
    addProject(project)
    onGenerated(project.id)
  }

  if (draft && image) return <ChartEditor draft={draft} image={image} onBack={onBack} onGenerate={generate} />

  return (
    <main className="screen pad" style={{ paddingTop: 66 }}>
      <button onClick={onBack} aria-label="Back">‹</button>
      <h1>Start a chart from a photo</h1>
      <p>Choose a clear image, then frame it and set the stitch grid.</p>
      {error && <p role="alert">{error}</p>}
      <button className="pill-primary" onClick={() => fileRef.current?.click()}>Choose a photo</button>
      <input ref={fileRef} hidden type="file" accept="image/*" onChange={(event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file) openFile(file)
      }} />
    </main>
  )
}
```

On generation, the route calls:

```js
const result = quantizeToGrid(image, draft.grid.columns, 4, {
  rows: draft.grid.rows,
  draft,
})
```

It adds a project with this exact shape:

```js
{
  id: `p-${Date.now()}`,
  editorDraftId: draft.id,
  name: draft.name,
  stitchesWide: draft.grid.columns,
  totalRows: draft.grid.rows,
  colorCount: result.colors.length,
  workingMethod: draft.grid.workingMethod,
  colors: result.colors,
  grid: result.grid,
  currentRow: 1,
}
```

Replace `app/src/App.jsx` with:

```jsx
import { useState } from 'react'
import { StoreProvider } from './store'
import MyCharts from './screens/MyCharts'
import ChartScreen from './screens/ChartScreen'
import EditorRoute from './editor/EditorRoute'

export default function App() {
  const [route, setRoute] = useState({ name: 'list' })
  return (
    <StoreProvider>
      {route.name === 'list' && (
        <MyCharts
          onOpen={(id) => setRoute({ name: 'chart', id })}
          onNew={() => setRoute({ name: 'import' })}
          onImportFile={(file) => setRoute({ name: 'import', file })}
        />
      )}
      {route.name === 'import' && (
        <EditorRoute
          initialFile={route.file}
          onBack={() => setRoute({ name: 'list' })}
          onGenerated={(id) => setRoute({ name: 'chart', id })}
        />
      )}
      {route.name === 'chart' && (
        <ChartScreen projectId={route.id} onBack={() => setRoute({ name: 'list' })} />
      )}
    </StoreProvider>
  )
}
```

In `MyCharts.jsx`, change `.pat` copy and `accept` attributes to images only because `.pat` parsing is not implemented:

```jsx
accept="image/*"
```

```text
OR CHOOSE AN EXISTING PHOTO
```

Append this section to `app/README.md`:

```markdown
## Photo editor foundation

The import flow now opens a recoverable hybrid editor. Source images and editor drafts are stored locally in IndexedDB. Frame supports crop-to-fit and stretch-to-fit, rotation, flipping, scale, and position. Grid dimensions support 8–120 columns and 8–400 rows, with optional aspect locking, Aran/square preview, and round/turned working methods.

Image adjustments, owned-yarn mapping, crochet-simplicity cleanup, and review diagnostics are intentionally reserved for the next delivery phases described in `../docs/superpowers/specs/2026-08-18-photo-to-chart-editor-design.md`.
```

- [ ] **Step 4: Run the complete verification set**

Run:

```bash
cd app
npm test -- --run
npm run build
```

Expected: all tests pass and Vite exits successfully with production assets in `app/dist`.

Perform this manual phone-width check at 375×812:

- Choose a landscape photo.
- Confirm crop mode excludes side content without distortion.
- Confirm drag and scale change the crop.
- Switch to stretch and confirm the full image is visible.
- Set 32 columns and 40 rows with dimensions unlocked.
- Refresh and confirm the draft reopens with the same settings.
- Generate and confirm the chart is 32×40 with row 1 at the bottom.
- Confirm previously seeded and saved projects still open.

- [ ] **Step 5: Commit when Git is available**

```bash
git add app/src/App.jsx app/src/screens/MyCharts.jsx app/src/lib/quantize.js app/src/editor/EditorRoute.jsx app/src/editor/EditorRoute.test.jsx app/README.md
git commit -m "feat: launch photo editor foundation"
```

## Follow-on implementation plans

After this plan is verified, write separate plans in this order:

1. Image adjustments and revisioned Web Worker conversion.
2. Manual yarn inventory and perceptual yarn mapping.
3. Crochet-simplicity cleanup and manual grid overrides.
4. Review diagnostics, fabric preview, accessibility hardening, and end-to-end visual tests.

Each follow-on plan must preserve the `EditorDraft` schema through explicit migrations and produce independently testable working software.
