import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import MyCharts from './MyCharts'

const store = vi.hoisted(() => ({ projects: [], importProjects: vi.fn() }))
vi.mock('../store', () => ({ useStore: () => store }))
beforeEach(() => { store.projects = []; store.importProjects.mockReset() })

it('offers images only and does not imply unsupported .pat parsing', () => {
  const { container } = render(<MyCharts onOpen={() => {}} onNew={() => {}} onImportFile={() => {}} />)

  expect(container.querySelector('input[type="file"]')).toHaveAttribute('accept', 'image/*')
  expect(screen.getByRole('button', { name: 'Choose an existing photo' })).toHaveClass('chart-photo-chooser')
  expect(screen.getByText('Library tools').closest('details')).not.toHaveAttribute('open')
  expect(screen.queryByText(/\.PAT/)).not.toBeInTheDocument()
})

it('keeps archives accessible through library tools and opens the selected chart', () => {
  const p = { id: 'archived', name: 'Saved flowers', archived: true, stitchesWide: 1, totalRows: 1, currentRow: 1, colors: ['#ffffff'], grid: [[0]] }
  store.projects = [p]
  const onOpen = vi.fn()
  render(<MyCharts onOpen={onOpen} onNew={vi.fn()} onImportFile={vi.fn()} />)
  expect(screen.queryByText('Saved flowers')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Library tools'))
  expect(screen.getByRole('button', { name: 'Back up whole library' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Show archived charts' }))
  fireEvent.click(screen.getByRole('button', { name: /Saved flowers/ }))
  expect(onOpen).toHaveBeenCalledWith('archived')
  expect(screen.getByText('Manage Saved flowers')).toBeVisible()
})

it('imports backup files through the existing store API and reports the outcome', async () => {
  store.importProjects.mockReturnValue([{ id: 'new' }])
  render(<MyCharts onOpen={vi.fn()} onNew={vi.fn()} onImportFile={vi.fn()} />)
  const raw = '{"projects":[]}'
  fireEvent.change(screen.getByLabelText('Import chart backup'), { target: { files: [{ size: raw.length, text: async () => raw }] } })
  expect(await screen.findByRole('status')).toHaveTextContent('Imported 1 charts as separate copies')
  expect(store.importProjects).toHaveBeenCalledWith(raw)
})
