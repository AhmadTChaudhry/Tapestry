import { render, screen } from '@testing-library/react'
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
})
