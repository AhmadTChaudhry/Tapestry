import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TabBar from './TabBar'

describe('TabBar', () => {
  it('marks the active tab and reports the tapped one', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<TabBar active="home" onSelect={onSelect} />)

    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Charts' })).not.toHaveAttribute('aria-current')

    await user.click(screen.getByRole('button', { name: 'Charts' }))

    expect(onSelect).toHaveBeenCalledWith('list')
  })

  it('is reachable as a landmark for assistive tech', () => {
    render(<TabBar active="list" onSelect={vi.fn()} />)

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  })
})
