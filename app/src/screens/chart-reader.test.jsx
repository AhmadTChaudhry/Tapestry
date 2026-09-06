import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import ChartScreen from './ChartScreen'

let store
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  HTMLElement.prototype.scrollTo = vi.fn()
})
vi.mock('../store', () => ({ useStore: () => store, useWakeLock: () => {}, tick: () => {} }))
const base = { id: 'original', name: 'Asymmetric chart', grid: [[0, 1, 0, 1, 0, 2], [0, 0, 1, 1, 2, 2]], colors: ['#ffffff', '#000000', '#ff0000'], currentRow: 1, totalRows: 2, stitchesWide: 6, workingMethod: 'turned' }
function Harness({ project = base, onOpen = vi.fn(), onEdit }) {
  const [projects, setProjects] = useState([project])
  store = {
    projects, gauge: 'true', gaps: true,
    patchProject: vi.fn((id, patch) => setProjects((ps) => ps.map((p) => p.id === id ? { ...p, ...patch } : p))),
    addProject: vi.fn((p) => setProjects((ps) => [...ps, p])),
    toggleTheme: vi.fn(),
  }
  return <ChartScreen projectId={project.id} onBack={() => {}} onOpen={onOpen} onEdit={onEdit} />
}

describe('chart reader interactions', () => {
  it('keeps browsing behind Options and working controls in the bottom dock', () => {
    render(<Harness />)
    expect(screen.queryByRole('spinbutton', { name: 'Browse row' })).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Working row' })).getByRole('button', { name: 'Complete row' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Options' }))
    expect(screen.getByRole('spinbutton', { name: 'Browse row' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Options' }))
    expect(screen.queryByRole('spinbutton', { name: 'Browse row' })).toBeNull()
  })
  it('keeps readable cells at minimum zoom and enlarges cells for touch editing', () => {
    render(<Harness />)
    for (let i = 0; i < 8; i++) fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    const cell = screen.getByTestId('chart-row-1').querySelector('rect')
    expect(Number(cell.getAttribute('width'))).toBeGreaterThanOrEqual(11)
    expect(Number(cell.getAttribute('height'))).toBeGreaterThanOrEqual(11)
    fireEvent.click(screen.getByRole('button', { name: 'Edit cells' }))
    expect(Number(cell.getAttribute('width'))).toBeGreaterThanOrEqual(43)
    expect(Number(cell.getAttribute('height'))).toBeGreaterThanOrEqual(43)
  })
  it('keeps the edit draft recoverable if saving a version fails', () => {
    render(<Harness project={{ ...base, currentRow: 2 }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit cells' }))
    fireEvent.change(screen.getByLabelText('Paint colour'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply paint' }))
    store.addProject.mockImplementationOnce(() => { throw new Error('Library limit reached') })
    fireEvent.click(screen.getByRole('button', { name: 'Save new version' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Library limit reached')
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()
    expect(store.projects[0].grid).toEqual(base.grid)
  })
  it('follows the working row until the user browses away', () => {
    render(<Harness />)
    const scroll = HTMLElement.prototype.scrollTo
    scroll.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Next row' }))
    expect(scroll).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Options' }))
    fireEvent.change(screen.getByLabelText('Browse row'), { target: { value: '1' } })
    scroll.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Previous row' }))
    expect(scroll).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Return current row' }))
    expect(scroll).toHaveBeenCalled()
  })
  it('can undo a row marked complete without changing the chart', () => {
    render(<Harness project={{ ...base, currentRow: 2, completedRows: [2] }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark this row incomplete' }))
    expect(store.projects[0].completedRows).toEqual([])
    expect(store.projects[0].grid).toEqual(base.grid)
  })
  it.each(['editorDraftId', 'sourceDraftId'])('opens photo setup using %s', (key) => {
    const onEdit = vi.fn()
    render(<Harness project={{ ...base, [key]: 'draft-123' }} onEdit={onEdit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit photo setup' }))
    expect(onEdit).toHaveBeenCalledWith('draft-123')
  })
  it('fills a connected area, discards safely, and clears redo after a new edit', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit cells' }))
    fireEvent.change(screen.getByLabelText('Paint colour'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Tool'), { target: { value: 'fill' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply fill' }))
    expect(screen.getByTestId('chart-row-2').querySelector('rect')).toHaveAttribute('fill', '#ff0000')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    fireEvent.change(screen.getByLabelText('Paint colour'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply fill' }))
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Discard edits' }))
    expect(store.projects[0].grid).toEqual(base.grid)
  })
  it('saves project swatch and changes display without modifying the grid', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Options' }))
    fireEvent.click(screen.getByText('Reading settings & colour key'))
    fireEvent.change(screen.getByLabelText('Stitches / 10 cm'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('Rows / 10 cm'), { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save swatch' }))
    expect(store.projects[0].swatch).toEqual({ stitches: 20, rows: 25 })
    fireEvent.click(screen.getByRole('button', { name: 'Square display' }))
    expect(store.projects[0].gauge).toBe('true')
    expect(store.projects[0].grid).toEqual(base.grid)
  })
  it('shows every run and persists the selected run', () => {
    render(<Harness />)
    const runs = screen.getByRole('list', { name: 'Row instructions' })
    expect(within(runs).getAllByRole('button')).toHaveLength(6)
    fireEvent.click(within(runs).getAllByRole('button')[4])
    expect(store.projects[0].currentRun).toBe(4)
  })
  it('navigation never completes rows, including legacy projects without completedRows', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Next row' }))
    expect(store.projects[0]).toMatchObject({ currentRow: 2, currentRun: 0, completedRows: [] })
    expect(screen.getByText('0% complete')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Complete row' }))
    expect(store.projects[0]).toMatchObject({ currentRow: 2, currentRun: 0, completedRows: [2] })
    expect(screen.getByText('50% complete')).toBeInTheDocument()
  })
  it('browses the full chart without moving the working row and offers symbols', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Options' }))
    fireEvent.change(screen.getByLabelText('Browse row'), { target: { value: '2' } })
    expect(store.projects[0].currentRow).toBe(1)
    expect(screen.getByTestId('chart-row-2').querySelector('rect')).toHaveAttribute('fill', '#ffffff')
    fireEvent.click(screen.getByRole('button', { name: 'Show symbols' }))
    expect(screen.getByTestId('chart-row-2').querySelector('text')).toBeTruthy()
  })
  it('stages paint with undo/redo and duplicates a started chart on save', () => {
    const onOpen = vi.fn()
    render(<Harness project={{ ...base, currentRow: 2 }} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit cells' }))
    fireEvent.change(screen.getByLabelText('Paint colour'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply paint' }))
    expect(store.projects[0].grid[0][0]).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('button', { name: 'Save new version' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save new version' }))
    expect(store.projects).toHaveLength(2)
    expect(store.projects[0].grid).toEqual(base.grid)
    expect(store.projects[1]).toMatchObject({ versionOf: 'original', currentRow: 1, currentRun: 0, completedRows: [], grid: [[2, 1, 0, 1, 0, 2], [0, 0, 1, 1, 2, 2]] })
    expect(onOpen).toHaveBeenCalledWith(store.projects[1].id)
  })
  it('saves an unstarted chart in place and can discard edits', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit cells' }))
    fireEvent.change(screen.getByLabelText('Paint colour'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply paint' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save edits' }))
    expect(store.projects).toHaveLength(1)
    expect(store.projects[0].grid[0][0]).toBe(1)
  })
})
