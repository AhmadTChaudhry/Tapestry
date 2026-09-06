import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ChartEditor from './ChartEditor'
import { createDraft } from './model'
import { saveDraft } from './draftRepository'

vi.mock('./draftRepository', () => ({ saveDraft: vi.fn(() => Promise.resolve()) }))
// Canvas conversion is tested with pixel fixtures separately; these tests
// exercise editor navigation and persistence races in jsdom.
vi.mock('../lib/conversion', () => ({
  buildDraftChart: vi.fn(() => ({ grid: [[0]], colors: ['#000000'] })),
  chartComplexity: () => ({ changes: 0, singles: 1 }),
  drawChart: vi.fn(),
  matchedYarns: () => [],
}))

afterEach(() => vi.clearAllMocks())

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

const createEditor = (overrides = {}) => {
  const draft = createDraft({ id: 'asset-1', width: 800, height: 600, mimeType: 'image/png' }, 'Rose')
  const onBack = vi.fn()
  const onGenerate = vi.fn()

  render(
    <ChartEditor
      draft={draft}
      image={{ src: 'data:image/png;base64,preview' }}
      onBack={onBack}
      onGenerate={onGenerate}
      {...overrides}
    />,
  )

  return { draft, onBack, onGenerate }
}

describe('ChartEditor', () => {
  it('moves between enabled editor stages with linked tab semantics', async () => {
    const user = userEvent.setup()
    createEditor()

    const gridTab = screen.getByRole('tab', { name: 'Grid' })
    await user.click(gridTab)

    const panel = screen.getByRole('tabpanel', { name: 'Grid' })
    expect(panel).toBeVisible()
    expect(gridTab).toHaveAttribute('aria-selected', 'true')
    expect(gridTab).toHaveAttribute('aria-controls', panel.id)
    expect(panel).toHaveAttribute('aria-labelledby', gridTab.id)
    expect(screen.getByRole('status')).toHaveTextContent(/saved|saving/i)
  })

  it('keeps a stable, labelled panel for every tab and hides inactive panels', async () => {
    const user = userEvent.setup()
    createEditor()

    const assertPanelState = (activeStage) => {
      expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
      expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-label', activeStage)

      for (const tab of screen.getAllByRole('tab')) {
        const panel = document.getElementById(tab.getAttribute('aria-controls'))
        const isActive = tab.getAttribute('aria-selected') === 'true'

        expect(panel).toBeInTheDocument()
        expect(panel).toHaveAttribute('aria-labelledby', tab.id)
        expect(panel.hidden).toBe(!isActive)
        if (isActive) expect(panel).toHaveAttribute('aria-label', activeStage)
      }
    }

    assertPanelState('Frame')
    await user.click(screen.getByRole('tab', { name: 'Grid' }))
    assertPanelState('Grid')
  })

  it('keeps the source preview visible while the active stage changes', async () => {
    const user = userEvent.setup()
    createEditor()

    await user.click(screen.getByRole('tab', { name: 'Yarn' }))

    expect(screen.getByRole('img', { name: 'Exact stitch preview' })).toBeVisible()
    expect(screen.getByRole('tabpanel', { name: 'Yarn' })).toHaveTextContent(/palette/i)
  })

  it('supports arrow-key movement between editor tabs', async () => {
    const user = userEvent.setup()
    createEditor()

    const frameTab = screen.getByRole('tab', { name: 'Frame' })
    frameTab.focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('tab', { name: 'Grid' })).toHaveFocus()
    expect(screen.getByRole('tabpanel', { name: 'Grid' })).toBeVisible()
  })

  it('calls the supplied actions from the back and review controls', async () => {
    const user = userEvent.setup()
    const { draft, onBack, onGenerate } = createEditor()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('tab', { name: 'Review' }))
    await user.click(screen.getByRole('button', { name: 'Generate chart' }))

    await waitFor(() => expect(onBack).toHaveBeenCalledWith(expect.objectContaining({ id: draft.id, activeStage: 'frame' })))
    await waitFor(() => expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({ id: draft.id, activeStage: 'review' })))
    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({ id: draft.id, activeStage: 'review' }))
  })

  it('does not leave the editor when flushing the current draft fails', async () => {
    const user = userEvent.setup()
    const onPersistError = vi.fn()
    const { onBack } = createEditor({ onPersistError })
    vi.mocked(saveDraft).mockRejectedValueOnce(new Error('disk full'))

    await user.click(screen.getByRole('button', { name: 'Back' }))

    await waitFor(() => expect(onPersistError).toHaveBeenCalledWith(expect.any(Error)))
    expect(onBack).not.toHaveBeenCalled()
  })

  it('offers a way out once a save has actually failed', async () => {
    const user = userEvent.setup()
    const onPersistError = vi.fn()
    const { draft, onBack } = createEditor({ onPersistError })
    vi.mocked(saveDraft).mockRejectedValueOnce(new Error('disk full'))

    // No escape hatch until an attempt has failed — the normal path still saves.
    expect(screen.queryByRole('button', { name: 'Leave without saving' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(onPersistError).toHaveBeenCalledOnce())
    expect(onBack).not.toHaveBeenCalled()

    await user.click(await screen.findByRole('button', { name: 'Leave without saving' }))

    expect(onBack).toHaveBeenCalledWith(expect.objectContaining({ id: draft.id }))
  })

  it('summarises the draft on the review stage', async () => {
    const user = userEvent.setup()
    const { draft } = createEditor()
    const { columns, rows } = draft.grid

    await user.click(screen.getByRole('tab', { name: 'Review' }))
    const panel = screen.getByRole('tabpanel', { name: 'Review' })

    expect(panel).toHaveTextContent(`${columns} × ${rows}`)
    expect(panel).toHaveTextContent(String(columns * rows))
    expect(panel).toHaveTextContent('In the round')
    expect(screen.getByRole('button', { name: 'Generate chart' })).toBeEnabled()
  })

  it('renders action errors inside the editor viewport', () => {
    createEditor({ error: 'Changes could not be saved. Please try again.' })

    const alert = screen.getByRole('alert')
    expect(alert).toBeVisible()
    expect(alert).toHaveClass('editor-action-alert')
    expect(alert.closest('main.editor-screen')).not.toBeNull()
  })

  it('accepts only one of two immediate Generate activations while the flush is pending', async () => {
    const pendingSave = deferred()
    const { onGenerate } = createEditor()
    vi.mocked(saveDraft).mockReturnValueOnce(pendingSave.promise)

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Review' }))
    const generate = screen.getByRole('button', { name: 'Generate chart' })
    fireEvent.click(generate)
    fireEvent.click(generate)

    expect(generate).toBeDisabled()
    expect(screen.getByText('Saving action…')).toBeVisible()
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
    await waitFor(() => expect(saveDraft).toHaveBeenCalledOnce())

    pendingSave.resolve()
    await waitFor(() => expect(onGenerate).toHaveBeenCalledOnce())
    expect(generate).toBeEnabled()
    expect(screen.queryByText('Saving action…')).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'false')
  })

  it('accepts the first overlapping Back or Generate action only', async () => {
    const pendingSave = deferred()
    const { onBack, onGenerate } = createEditor()
    vi.mocked(saveDraft).mockReturnValueOnce(pendingSave.promise)

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: 'Generate chart' }))

    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Generate chart' })).toBeDisabled()
    pendingSave.resolve()

    await waitFor(() => expect(onBack).toHaveBeenCalledOnce())
    expect(onGenerate).not.toHaveBeenCalled()
  })

  it('reenables actions after a failed flush so it can be retried', async () => {
    const pendingSave = deferred()
    const onPersistError = vi.fn()
    const { onBack } = createEditor({ onPersistError })
    vi.mocked(saveDraft)
      .mockReturnValueOnce(pendingSave.promise)
      .mockResolvedValueOnce(undefined)
    const back = screen.getByRole('button', { name: 'Back' })

    fireEvent.click(back)
    expect(back).toBeDisabled()
    pendingSave.reject(new Error('disk full'))

    await waitFor(() => expect(onPersistError).toHaveBeenCalledOnce())
    expect(back).toBeEnabled()
    fireEvent.click(back)
    await waitFor(() => expect(onBack).toHaveBeenCalledOnce())
  })
})
