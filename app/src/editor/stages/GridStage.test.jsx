import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import GridStage from './GridStage'

describe('GridStage', () => {
  it('lets the user unlock and edit row count independently', () => {
    const dispatch = vi.fn()
    const grid = { columns: 24, rows: 36, dimensionsLocked: true, gauge: 'true', workingMethod: 'round' }

    render(<GridStage draft={{ grid }} dispatch={dispatch} />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Lock dimensions to the photo' }))

    expect(dispatch).toHaveBeenCalledWith({ type: 'grid/patch', patch: { dimensionsLocked: false } })
  })

  it('sends row edits through the reducer action when dimensions are unlocked', () => {
    const dispatch = vi.fn()
    const grid = { columns: 24, rows: 36, dimensionsLocked: false, gauge: 'true', workingMethod: 'round' }

    render(<GridStage draft={{ grid }} dispatch={dispatch} />)
    const rows = screen.getByRole('spinbutton', { name: 'Rows high' })

    fireEvent.change(rows, { target: { value: '40' } })
    fireEvent.blur(rows)

    expect(dispatch).toHaveBeenLastCalledWith({ type: 'grid/set-rows', value: 40 })
  })

  it('holds keystrokes until the field is committed so low values stay reachable', () => {
    const dispatch = vi.fn()
    const grid = { columns: 24, rows: 36, dimensionsLocked: false, gauge: 'true', workingMethod: 'round' }

    render(<GridStage draft={{ grid }} dispatch={dispatch} />)
    const stitches = screen.getByRole('spinbutton', { name: 'Stitches wide' })

    // A leading "5" used to clamp straight to the minimum, making 50 untypable.
    fireEvent.change(stitches, { target: { value: '5' } })
    expect(dispatch).not.toHaveBeenCalled()
    expect(stitches).toHaveValue(5)

    fireEvent.change(stitches, { target: { value: '50' } })
    fireEvent.keyDown(stitches, { key: 'Enter' })

    expect(dispatch).toHaveBeenCalledExactlyOnceWith({ type: 'grid/set-columns', value: 50 })
  })

  it('clamps an out-of-range entry once, on commit', () => {
    const dispatch = vi.fn()
    const grid = { columns: 24, rows: 36, dimensionsLocked: false, gauge: 'true', workingMethod: 'round' }

    render(<GridStage draft={{ grid }} dispatch={dispatch} />)
    const stitches = screen.getByRole('spinbutton', { name: 'Stitches wide' })

    fireEvent.change(stitches, { target: { value: '900' } })
    fireEvent.blur(stitches)

    expect(dispatch).toHaveBeenCalledWith({ type: 'grid/set-columns', value: 120 })
  })

  it('restores the committed value when the field is left empty', () => {
    const dispatch = vi.fn()
    const grid = { columns: 24, rows: 36, dimensionsLocked: false, gauge: 'true', workingMethod: 'round' }

    render(<GridStage draft={{ grid }} dispatch={dispatch} />)
    const stitches = screen.getByRole('spinbutton', { name: 'Stitches wide' })

    fireEvent.change(stitches, { target: { value: '' } })
    fireEvent.blur(stitches)

    expect(dispatch).not.toHaveBeenCalled()
    expect(stitches).toHaveValue(24)
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
