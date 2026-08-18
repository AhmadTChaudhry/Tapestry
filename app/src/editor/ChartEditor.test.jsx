import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ChartEditor from './ChartEditor'
import { createDraft } from './model'

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

  it('keeps the source preview visible while the active stage changes', async () => {
    const user = userEvent.setup()
    createEditor()

    await user.click(screen.getByRole('tab', { name: 'Yarn' }))

    expect(screen.getByRole('img', { name: 'Source preview' })).toBeVisible()
    expect(screen.getByRole('tabpanel', { name: 'Yarn' })).toHaveTextContent('Yarn mapping arrives in phase 3.')
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

    expect(onBack).toHaveBeenCalledOnce()
    expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({ id: draft.id, activeStage: 'review' }))
  })
})
