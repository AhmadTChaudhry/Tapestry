import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EditorRoute from './EditorRoute'
import { loadImageFile, quantizeToGrid, revokeImage } from '../lib/quantize'
import { getAsset, getLatestDraft, saveAsset, saveDraft } from './draftRepository'

const store = vi.hoisted(() => ({ addProject: vi.fn() }))

vi.mock('./draftRepository', () => ({
  saveAsset: vi.fn(),
  saveDraft: vi.fn(),
  getAsset: vi.fn(),
  getLatestDraft: vi.fn(() => Promise.resolve(null)),
}))
vi.mock('../store', () => ({ useStore: () => ({ addProject: store.addProject }) }))
vi.mock('../lib/quantize', () => ({
  loadImageFile: vi.fn(),
  quantizeToGrid: vi.fn(),
  revokeImage: vi.fn(),
}))
vi.mock('./ChartEditor', () => ({
  default: ({ draft, onGenerate }) => (
    <>
      <div>Editing {draft.name}</div>
      <button type="button" onClick={() => onGenerate(draft)}>Generate chart</button>
    </>
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
    quantizeToGrid.mockReturnValue({ grid: [[0]], colors: ['#000000'] })
  })

  afterEach(() => vi.clearAllMocks())

  it('shows an explicit empty import state', async () => {
    render(<EditorRoute onBack={() => {}} onGenerated={() => {}} />)

    expect(await screen.findByRole('button', { name: 'Choose a photo' })).toBeEnabled()
    expect(screen.getByText('Start a chart from a photo')).toBeVisible()
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

  it('restores the latest persisted draft and its image asset', async () => {
    getLatestDraft.mockResolvedValue(savedDraft)
    getAsset.mockResolvedValue({ ...asset, blob: new Blob(['image'], { type: 'image/png' }) })

    render(<EditorRoute onBack={() => {}} onGenerated={() => {}} />)

    expect(await screen.findByText('Editing Recovered fox')).toBeVisible()
    expect(getAsset).toHaveBeenCalledWith('asset-1')
    expect(loadImageFile).toHaveBeenCalledWith(expect.any(Blob))
  })

  it('returns to the import state with an error when a saved asset is missing', async () => {
    getLatestDraft.mockResolvedValue(savedDraft)

    render(<EditorRoute onBack={() => {}} onGenerated={() => {}} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Your saved draft could not be restored.')
    expect(screen.getByRole('button', { name: 'Choose a photo' })).toBeEnabled()
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
    quantizeToGrid.mockReturnValue({ grid: [[0, 1], [1, 0]], colors: ['#000000', '#FFFFFF'] })

    render(<EditorRoute initialFile={file} onBack={() => {}} onGenerated={onGenerated} />)
    await screen.findByText('Editing Winter fox')
    fireEvent.click(screen.getByRole('button', { name: 'Generate chart' }))

    expect(quantizeToGrid).toHaveBeenCalledWith(image, 24, 4, expect.objectContaining({
      rows: 20,
      draft: expect.objectContaining({ name: 'Winter fox' }),
    }))
    expect(store.addProject).toHaveBeenCalledWith(expect.objectContaining({
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

  it('keeps the editor open and reports a generation failure', async () => {
    const file = new File(['image'], 'winter-fox.png', { type: 'image/png' })
    quantizeToGrid.mockImplementation(() => { throw new Error('Canvas unavailable') })

    render(<EditorRoute initialFile={file} onBack={() => {}} onGenerated={() => {}} />)
    await screen.findByText('Editing Winter fox')
    fireEvent.click(screen.getByRole('button', { name: 'Generate chart' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Canvas unavailable')
    expect(store.addProject).not.toHaveBeenCalled()
  })
})
