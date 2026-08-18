import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

function Probe() {
  return <button>Editor ready</button>
}

describe('editor test harness', () => {
  it('renders React into jsdom', () => {
    render(<Probe />)
    expect(screen.getByRole('button', { name: 'Editor ready' })).toBeInTheDocument()
  })
})
