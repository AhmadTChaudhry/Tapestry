import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./store', () => ({ StoreProvider: ({ children }) => children }))
vi.mock('./screens/MyCharts', () => ({
  default: ({ onNew }) => <button type="button" onClick={onNew}>New photo chart</button>,
}))
vi.mock('./screens/ImportGrid', () => ({ default: () => <div>Legacy import</div> }))
vi.mock('./editor/EditorRoute', () => ({ default: () => <div>Photo editor route</div> }))
vi.mock('./screens/ChartScreen', () => ({ default: () => <div>Chart screen</div> }))

it('opens the recoverable photo editor for a new import', () => {
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: 'New photo chart' }))

  expect(screen.getByText('Photo editor route')).toBeVisible()
  expect(screen.queryByText('Legacy import')).not.toBeInTheDocument()
})
