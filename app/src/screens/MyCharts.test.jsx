import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import MyCharts from './MyCharts'

vi.mock('../store', () => ({ useStore: () => ({ projects: [] }) }))

it('offers images only and does not imply unsupported .pat parsing', () => {
  const { container } = render(<MyCharts onOpen={() => {}} onNew={() => {}} onImportFile={() => {}} />)

  expect(container.querySelector('input[type="file"]')).toHaveAttribute('accept', 'image/*')
  expect(screen.getByText('OR CHOOSE AN EXISTING PHOTO')).toBeVisible()
  expect(screen.queryByText(/\.PAT/)).not.toBeInTheDocument()
})
