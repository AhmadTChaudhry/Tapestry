import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import FrameStage from './FrameStage'

describe('FrameStage', () => {
  it('switches explicitly between crop and stretch', async () => {
    const user = userEvent.setup()
    const dispatch = vi.fn()

    render(<FrameStage draft={{ fitMode: 'crop', transform: { scale: 1 } }} dispatch={dispatch} />)

    await user.click(screen.getByRole('radio', { name: 'Stretch to fit' }))

    expect(dispatch).toHaveBeenCalledWith({ type: 'fit/set', value: 'stretch' })
  })

  it('disables crop-only positioning and scale controls in stretch mode', () => {
    const dispatch = vi.fn()

    render(<FrameStage draft={{ fitMode: 'stretch', transform: { scale: 1 } }} dispatch={dispatch} />)

    expect(screen.getByRole('slider', { name: /scale/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Recenter' })).toBeDisabled()
  })

  it('dispatches a crop scale adjustment', () => {
    const dispatch = vi.fn()

    render(<FrameStage draft={{ fitMode: 'crop', transform: { scale: 1 } }} dispatch={dispatch} />)
    fireEvent.change(screen.getByRole('slider', { name: 'Scale' }), { target: { value: '2' } })

    expect(dispatch).toHaveBeenCalledWith({ type: 'transform/patch', patch: { scale: 2 } })
  })

  it('dispatches rotate, flip, and reset frame actions', async () => {
    const user = userEvent.setup()
    const dispatch = vi.fn()
    const draft = { fitMode: 'crop', transform: { scale: 1, rotation: 90, flipX: false, flipY: true } }

    render(<FrameStage draft={draft} dispatch={dispatch} />)

    await user.click(screen.getByRole('button', { name: 'Rotate left' }))
    await user.click(screen.getByRole('button', { name: 'Rotate right' }))
    await user.click(screen.getByRole('button', { name: 'Flip horizontal' }))
    await user.click(screen.getByRole('button', { name: 'Flip vertical' }))
    await user.click(screen.getByRole('button', { name: 'Reset frame' }))

    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'transform/rotate', degrees: 0 })
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'transform/rotate', degrees: 180 })
    expect(dispatch).toHaveBeenNthCalledWith(3, { type: 'transform/patch', patch: { flipX: true } })
    expect(dispatch).toHaveBeenNthCalledWith(4, { type: 'transform/patch', patch: { flipY: false } })
    expect(dispatch).toHaveBeenNthCalledWith(5, { type: 'transform/reset' })
  })
})
