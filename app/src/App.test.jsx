import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./store', () => ({ StoreProvider: ({ children }) => children }))
vi.mock('./screens/Home', () => ({
  default: ({ onNew }) => <button type="button" onClick={onNew}>New photo chart</button>,
}))
vi.mock('./screens/MyCharts', () => ({ default: () => <div>Charts list</div> }))
vi.mock('./editor/EditorRoute', () => ({ default: () => <div>Photo editor route</div> }))
vi.mock('./screens/ChartScreen', () => ({ default: () => <div>Chart screen</div> }))

it('opens on the Home tab', () => {
  render(<App />)

  expect(screen.getByRole('button', { name: 'New photo chart' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
})

it('opens the recoverable photo editor for a new import', () => {
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: 'New photo chart' }))

  expect(screen.getByText('Photo editor route')).toBeVisible()
  expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
})

it('switches to the Charts tab and back without losing the tab bar', () => {
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: 'Charts' }))

  expect(screen.getByText('Charts list')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Charts' })).toHaveAttribute('aria-current', 'page')
  expect(screen.queryByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current')
})
