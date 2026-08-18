import { fireEvent, render, screen } from '@testing-library/react'
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
})
