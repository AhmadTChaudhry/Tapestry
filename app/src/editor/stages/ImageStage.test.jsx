import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ImageStage from './ImageStage'
import { createDraftImage } from '../model'

const draftWith = (image = {}) => ({ image: { ...createDraftImage(), ...image } })

describe('ImageStage', () => {
  it('sends each adjustment through the reducer', () => {
    const dispatch = vi.fn()
    render(<ImageStage draft={draftWith()} dispatch={dispatch} />)

    fireEvent.change(screen.getByRole('slider', { name: 'Brightness' }), { target: { value: '1.2' } })
    fireEvent.change(screen.getByRole('slider', { name: 'Saturation' }), { target: { value: '0' } })

    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'image/patch', patch: { brightness: 1.2 } })
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'image/patch', patch: { saturation: 0 } })
  })

  it('reads adjustments as a signed nudge away from neutral', () => {
    render(<ImageStage draft={draftWith({ brightness: 1.25, contrast: 0.8 })} dispatch={vi.fn()} />)

    expect(screen.getByText('+25%')).toBeVisible()
    expect(screen.getByText('−20%')).toBeVisible()
    expect(screen.getByText('Neutral')).toBeVisible()
  })

  it('changes the palette size from the segmented control', async () => {
    const user = userEvent.setup()
    const dispatch = vi.fn()
    render(<ImageStage draft={draftWith()} dispatch={dispatch} />)

    expect(screen.getByRole('radio', { name: '4 colours' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: '6 colours' }))

    expect(dispatch).toHaveBeenCalledWith({ type: 'image/patch', patch: { colorCount: 6 } })
  })

  it('only offers a reset once an adjustment has moved', async () => {
    const user = userEvent.setup()
    const dispatch = vi.fn()
    const { unmount } = render(<ImageStage draft={draftWith()} dispatch={dispatch} />)

    expect(screen.getByRole('button', { name: 'Reset adjustments' })).toBeDisabled()
    unmount()

    render(<ImageStage draft={draftWith({ contrast: 1.4 })} dispatch={dispatch} />)
    await user.click(screen.getByRole('button', { name: 'Reset adjustments' }))

    expect(dispatch).toHaveBeenCalledWith({ type: 'image/reset' })
  })
})
