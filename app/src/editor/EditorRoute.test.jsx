import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EditorRoute from './EditorRoute'
import { loadImageFile, quantizeToGrid, revokeImage } from '../lib/quantize'
import { getAsset, getDraft, getLatestDraft, saveAsset, saveDraft } from './draftRepository'

const store = vi.hoisted(() => ({ upsertProject: vi.fn(), projects: [] }))

vi.mock('./draftRepository', () => ({
  saveAsset: vi.fn(),
  saveDraft: vi.fn(),
  getAsset: vi.fn(),
  getDraft: vi.fn(),
  getLatestDraft: vi.fn(() => Promise.resolve(null)),
}))
vi.mock('../store', () => ({
  useStore: () => ({ projects: store.projects, upsertProject: store.upsertProject }),
}))
vi.mock('../lib/quantize', () => ({
  loadImageFile: vi.fn(),
  quantizeToGrid: vi.fn(),
  revokeImage: vi.fn(),
}))
vi.mock('./ChartEditor', () => ({
  default: ({ draft, error, onBack, onGenerate, onPersistError }) => (
    <main className="editor-screen">
      <div>Editing {draft.name}</div>
      <button type="button" onClick={() => onGenerate(draft)}>Generate chart</button>
      <button type="button" onClick={() => onBack(draft)}>Back to charts</button>
      <button type="button" onClick={() => onPersistError(new Error('disk full'))}>Simulate save failure</button>
      {error && <div className="editor-action-alert" role="alert">{error}</div>}
    </main>
  ),
}))

const asset = { id: 'asset-1', width: 1200, height: 800, mimeType: 'image/png' }
const image = { width: 1200, height: 800, src: 'blob:winter-fox' }
const savedDraft = {
  id: 'draft-1',
  schemaVersion: 1,
  name: 'Recovered fox',
  assetId: asset.id,
  source: { width: 1200, height: 800, mimeType: 'image/png' },
  fitMode: 'crop',
  transform: { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipX: false, flipY: false },
  grid: { columns: 32, rows: 40, workingMethod: 'turned', gauge: 'true', dimensionsLocked: false },
  activeStage: 'frame',
  createdAt: '2026-08-18T00:00:00.000Z',
  updatedAt: '2026-08-18T00:00:00.000Z',
}

describe('EditorRoute', () => {
  beforeEach(() => {
    getLatestDraft.mockResolvedValue(null)
    getAsset.mockResolvedValue(undefined)
    saveAsset.mockResolvedValue(asset)
    saveDraft.mockResolvedValue(undefined)
    loadImageFile.mockResolvedValue(image)
    quantizeToGrid.mockReturnValue({ grid: [[0]], colors: ['#000000'], roles: ['Background'] })
  })

  afterEach(() => {
    store.projects = []
    vi.clearAllMocks()
  })

  it('shows an explicit empty import state', async () => {
    render(<EditorRoute onBack={() => {}} onGenerated={() => {}} />)

    expect(await screen.findByRole('button', { name: 'Choose a photo' })).toBeEnabled()
    expect(screen.getByText('Start a chart from a photo')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Back' })).toHaveClass('editor-import-back')
  })

  it('creates and persists a draft from the supplied initial file', async () => {
    const file = new File(['image'], 'winter-fox.png', { type: 'image/png' })

    render(<EditorRoute initialFile={file} onBack={() => {}} onGenerated={() => {}} />)

    expect(await screen.findByText('Editing Winter fox')).toBeVisible()
    await waitFor(() => expect(saveAsset).toHaveBeenCalledWith(file, { width: 1200, height: 800 }))
    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'asset-1',
      name: 'Winter fox',
    }))
  })

  it('offers a recoverable draft without opening it', async () => {
    getLatestDraft.mockResolvedValue(savedDraft)
    getAsset.mockResolvedValue({ ...asset, blob: new Blob(['image'], { type: 'image/png' }) })

    render(<EditorRoute onBack={() => {}} onGenerated={() => {}} />)

    expect(await screen.findByRole('button', { name: 'Resume \u201cRecovered fox\u201d' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Choose a photo' })).toBeEnabled()
    expect(screen.queryByText('Editing Recovered fox')).toBeNull()
    expect(loadImageFile).not.toHaveBeenCalled()
  })

  it('opens the recovered draft only once the offer is accepted', async () => {
    getLatestDraft.mockResolvedValue(savedDraft)
    getAsset.mockResolvedValue({ ...asset, blob: new Blob(['image'], { type: 'image/png' }) })

    render(<EditorRoute onBack={() => {}} onGenerated={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Resume \u201cRecovered fox\u201d' }))

    expect(await screen.findByText('Editing Recovered fox')).toBeVisible()
    expect(getAsset).toHaveBeenCalledWith('asset-1')
    expect(loadImageFile).toHaveBeenCalledWith(expect.any(Blob))
  })

  it('reports a restore failure when the asset disappears before the offer is accepted', async () => {
    getLatestDraft.mockResolvedValue(savedDraft)
    getAsset.mockResolvedValueOnce({ ...asset, blob: new Blob(['image'], { type: 'image/png' }) })
    render(<EditorRoute onBack={() => {}} onGenerated={() => {}} />)
    const resume = await screen.findByRole('button', { name: 'Resume \u201cRecovered fox\u201d' })
    getAsset.mockResolvedValue(undefined)

    fireEvent.click(resume)

    expect(await screen.findByRole('alert')).toHaveTextContent('Your saved draft could not be restored.')
    expect(screen.getByRole('button', { name: 'Choose a photo' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /^Resume/ })).toBeNull()
  })

  it('offers no resume when the saved draft has lost its asset', async () => {
    getLatestDraft.mockResolvedValue(savedDraft)

    render(<EditorRoute onBack={() => {}} onGenerated={() => {}} />)

    expect(await screen.findByRole('button', { name: 'Choose a photo' })).toBeEnabled()
    await waitFor(() => expect(getAsset).toHaveBeenCalledWith('asset-1'))
    expect(screen.queryByRole('button', { name: /^Resume/ })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('offers no resume when a persisted draft is malformed', async () => {
    getLatestDraft.mockResolvedValue({ ...savedDraft, name: '' })

    render(<EditorRoute onBack={() => {}} onGenerated={() => {}} />)

    expect(await screen.findByRole('button', { name: 'Choose a photo' })).toBeEnabled()
    expect(getAsset).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /^Resume/ })).toBeNull()
  })

  it('does not import the same initial file twice when effects are replayed', async () => {
    const file = new File(['image'], 'winter-fox.png', { type: 'image/png' })

    render(
      <StrictMode>
        <EditorRoute initialFile={file} onBack={() => {}} onGenerated={() => {}} />
      </StrictMode>,
    )

    await screen.findByText('Editing Winter fox')
    expect(saveAsset).toHaveBeenCalledTimes(1)
    expect(saveDraft).toHaveBeenCalledTimes(1)
  })

  it('discards a stale image load when a newer initial file replaces it', async () => {
    let resolveFirst
    const first = new Promise((resolve) => { resolveFirst = resolve })
    const firstFile = new File(['first'], 'first.png', { type: 'image/png' })
    const secondFile = new File(['second'], 'second.png', { type: 'image/png' })
    const secondImage = { width: 1000, height: 500, src: 'blob:second' }
    loadImageFile.mockReturnValueOnce(first).mockResolvedValueOnce(secondImage)
    const { rerender } = render(<EditorRoute initialFile={firstFile} onBack={() => {}} onGenerated={() => {}} />)

    rerender(<EditorRoute initialFile={secondFile} onBack={() => {}} onGenerated={() => {}} />)
    expect(await screen.findByText('Editing Second')).toBeVisible()
    resolveFirst(image)

    await waitFor(() => expect(revokeImage).toHaveBeenCalledWith(image))
    expect(saveAsset).toHaveBeenCalledTimes(1)
  })

  it('releases the editor image when the route unmounts', async () => {
    const file = new File(['image'], 'winter-fox.png', { type: 'image/png' })
    const view = render(<EditorRoute initialFile={file} onBack={() => {}} onGenerated={() => {}} />)

    await screen.findByText('Editing Winter fox')
    view.unmount()

    expect(revokeImage).toHaveBeenCalledWith(image)
  })

  it('generates a chart with the current editor draft and bottom-first quantizer result', async () => {
    const file = new File(['image'], 'winter-fox.png', { type: 'image/png' })
    const onGenerated = vi.fn()
    quantizeToGrid.mockReturnValue({ grid: [[0, 1], [1, 0]], colors: ['#000000', '#FFFFFF'], roles: ['Background', 'Foreground'] })

    render(<EditorRoute initialFile={file} onBack={() => {}} onGenerated={onGenerated} />)
    await screen.findByText('Editing Winter fox')
    fireEvent.click(screen.getByRole('button', { name: 'Generate chart' }))

    expect(quantizeToGrid).toHaveBeenCalledWith(image, 24, 4, expect.objectContaining({
      rows: 20,
      draft: expect.objectContaining({ name: 'Winter fox' }),
    }))
    expect(store.upsertProject).toHaveBeenCalledWith(expect.objectContaining({
      editorDraftId: expect.any(String),
      name: 'Winter fox',
      stitchesWide: 24,
      totalRows: 20,
      colorCount: 2,
      workingMethod: 'round',
      grid: [[0, 1], [1, 0]],
      currentRow: 1,
    }))
    expect(onGenerated).toHaveBeenCalledWith(expect.stringMatching(/^p-/))
  })

  it('regenerates into the chart the draft already produced', async () => {
    const file = new File(['image'], 'winter-fox.png', { type: 'image/png' })
    const onGenerated = vi.fn()
    saveDraft.mockImplementation((next) => { store.projects = [{ id: 'p-existing', editorDraftId: next.id }]; return Promise.resolve() })

    render(<EditorRoute initialFile={file} onBack={() => {}} onGenerated={onGenerated} />)
    await screen.findByText('Editing Winter fox')
    fireEvent.click(screen.getByRole('button', { name: 'Generate chart' }))

    expect(store.upsertProject).toHaveBeenCalledWith(expect.objectContaining({ id: 'p-existing' }))
    expect(onGenerated).toHaveBeenCalledWith('p-existing')
  })

  it.each([1, [1, 3]])('preserves a started pattern when regenerating (completedRows=%j)', async completedRows => {
    getDraft.mockResolvedValue(savedDraft)
    getAsset.mockResolvedValue({ ...asset, blob: new Blob(['image']) })
    const existing = { id: 'started', editorDraftId: savedDraft.id, currentRow: 1, completedRows, totalRows: 40, grid: [[0]] }
    store.projects = [existing]
    render(<EditorRoute initialDraftId={savedDraft.id} onBack={() => {}} onGenerated={() => {}} />)
    await screen.findByText('Editing Recovered fox')
    fireEvent.click(screen.getByRole('button', { name: 'Generate chart' }))
    const generated = store.upsertProject.mock.calls[0][0]
    expect(generated.id).not.toBe(existing.id)
    expect(generated).toMatchObject({ versionOf: existing.id, sourceDraftId: savedDraft.id, completedRows: 0, currentRow: 1 })
    expect(existing.completedRows).toEqual(completedRows)
    expect(existing.grid).toEqual([[0]])
  })

  it('generates with the chosen palette size and yarn overrides', async () => {
    const file = new File(['image'], 'winter-fox.png', { type: 'image/png' })
    quantizeToGrid.mockReturnValue({ grid: [[0, 1]], colors: ['#111111', '#222222'], roles: ['Background', 'Foreground'] })
    saveDraft.mockImplementation(() => Promise.resolve())
    vi.mocked(getLatestDraft).mockResolvedValue(null)

    render(<EditorRoute initialFile={file} onBack={() => {}} onGenerated={() => {}} />)
    await screen.findByText('Editing Winter fox')
    // the mocked ChartEditor hands back whatever draft it was given, so drive
    // the palette through the draft itself
    fireEvent.click(screen.getByRole('button', { name: 'Generate chart' }))

    expect(quantizeToGrid).toHaveBeenCalledWith(image, 24, 4, expect.anything())
    expect(store.upsertProject).toHaveBeenCalledWith(expect.objectContaining({
      colors: ['#111111', '#222222'],
      // nobody visited the Yarn stage, so the label still falls back to
      // what part the colour plays rather than staying blank
      yarnLabels: ['A', 'B'],
    }))
  })

  it('keeps the editor open and reports a generation failure', async () => {
    const file = new File(['image'], 'winter-fox.png', { type: 'image/png' })
    quantizeToGrid.mockImplementation(() => { throw new Error('Canvas unavailable') })

    render(<EditorRoute initialFile={file} onBack={() => {}} onGenerated={() => {}} />)
    await screen.findByText('Editing Winter fox')
    fireEvent.click(screen.getByRole('button', { name: 'Generate chart' }))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Canvas unavailable')
    expect(alert.closest('main.editor-screen')).not.toBeNull()
    expect(store.upsertProject).not.toHaveBeenCalled()
  })

  it('receives the current draft from Back before returning to the chart list', async () => {
    const file = new File(['image'], 'winter-fox.png', { type: 'image/png' })
    const onBack = vi.fn()

    render(<EditorRoute initialFile={file} onBack={onBack} onGenerated={() => {}} />)
    await screen.findByText('Editing Winter fox')
    fireEvent.click(screen.getByRole('button', { name: 'Back to charts' }))

    expect(onBack).toHaveBeenCalledWith()
  })

  it('keeps the editor open with an actionable error when an action save fails', async () => {
    const file = new File(['image'], 'winter-fox.png', { type: 'image/png' })
    const onBack = vi.fn()

    render(<EditorRoute initialFile={file} onBack={onBack} onGenerated={() => {}} />)
    await screen.findByText('Editing Winter fox')
    fireEvent.click(screen.getByRole('button', { name: 'Simulate save failure' }))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Changes could not be saved. Please try again before leaving.')
    expect(alert.closest('main.editor-screen')).not.toBeNull()
    expect(onBack).not.toHaveBeenCalled()
  })
})
