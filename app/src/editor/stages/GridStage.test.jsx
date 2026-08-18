import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import GridStage from './GridStage'

describe('GridStage', () => {
  it('lets the user unlock and edit row count independently', () => {
    const dispatch = vi.fn()
    const grid = { columns: 24, rows: 36, dimensionsLocked: true, gauge: 'true', workingMethod: 'round' }

    render(<GridStage draft={{ grid }} dispatch={dispatch} />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Lock dimensions' }))

    expect(dispatch).toHaveBeenCalledWith({ type: 'grid/patch', patch: { dimensionsLocked: false } })
  })

  it('sends row edits through the reducer action when dimensions are unlocked', () => {
    const dispatch = vi.fn()
    const grid = { columns: 24, rows: 36, dimensionsLocked: false, gauge: 'true', workingMethod: 'round' }

    render(<GridStage draft={{ grid }} dispatch={dispatch} />)

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Rows high' }), { target: { value: '40' } })

    expect(dispatch).toHaveBeenLastCalledWith({ type: 'grid/set-rows', value: '40' })
  })

  it('dispatches gauge and working-method patches and displays the stitch total', async () => {
    const user = userEvent.setup()
    const dispatch = vi.fn()
    const grid = { columns: 24, rows: 36, dimensionsLocked: false, gauge: 'true', workingMethod: 'round' }

    render(<GridStage draft={{ grid }} dispatch={dispatch} />)

    await user.click(screen.getByRole('radio', { name: 'Square grid' }))
    await user.click(screen.getByRole('radio', { name: 'Turned rows' }))

    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'grid/patch', patch: { gauge: 'square' } })
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'grid/patch', patch: { workingMethod: 'turned' } })
    expect(screen.getByText('864 stitches')).toBeVisible()
  })
})
