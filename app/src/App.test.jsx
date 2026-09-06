import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./store', () => ({ StoreProvider: ({ children }) => children }))
vi.mock('./screens/Home', () => ({
  default: ({ onNew }) => <button type="button" onClick={onNew}>New photo chart</button>,
}))
vi.mock('./screens/MyCharts', () => ({ default: () => <div>Charts list</div> }))
vi.mock('./editor/EditorRoute', () => ({ default: () => <div>Photo editor route</div> }))
vi.mock('./screens/ChartScreen', () => ({ default: () => <div>Chart screen</div> }))

beforeEach(() => sessionStorage.setItem('tapestry-welcome/v1', 'seen'))

it('shows a dismissible welcome once per browser session', () => {
  sessionStorage.removeItem('tapestry-welcome/v1')
  render(<App />)
  expect(screen.getByText('Stitches')).toBeVisible()
  expect(screen.getByText('Tapestry')).toBeVisible()
  expect(screen.getByTestId('stitches-mark')).toBeVisible()
  expect(screen.queryByText('Made for a hook in one hand.')).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'A tulip made of crochet stitches' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Open my charts' }))
  expect(screen.getByRole('button', { name: 'New photo chart' })).toBeVisible()
  expect(sessionStorage.getItem('tapestry-welcome/v1')).toBe('seen')
})

it('can start a photo chart directly from the welcome screen', () => {
  sessionStorage.removeItem('tapestry-welcome/v1')
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Start with a photo' }))
  expect(screen.getByText('Photo editor route')).toBeVisible()
})

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
