import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { StoreProvider, useStore } from '../store'
import { parseBackup } from '../lib/backup'
import ChartScreen from './ChartScreen'

const KEY = 'tapestry-crochet/v1'
const original = {
  id: 'original', name: 'Store integration chart', stitchesWide: 3, totalRows: 2,
  colors: ['#ffffff', '#000000'], colorCount: 2, grid: [[0, 0, 1], [0, 1, 1]],
  currentRow: 2, currentRun: 1, completedRows: [1], chartStarted: true,
  startedAt: '2026-09-06T00:00:00.000Z', workingMethod: 'round',
  handedness: 'right', startDirection: 'rtl', gauge: 'true',
}
let store
function Probe() { store = useStore(); return null }
function mount(onOpen) {
  return render(<StoreProvider><Probe /><ChartScreen projectId="original" onOpen={onOpen} /></StoreProvider>)
}

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

it.each([undefined, 'editorDraftId', 'sourceDraftId'])('saves and reloads a version via real addProject with draft metadata %s', (field) => {
  const source = { ...original, ...(field ? { [field]: 'real-draft' } : {}) }
  localStorage.setItem(KEY, JSON.stringify({ projects: [source] }))
  const onOpen = vi.fn()
  const view = mount(onOpen)
  const before = structuredClone(store.projects[0])
  fireEvent.click(screen.getByRole('button', { name: 'Edit cells' }))
  fireEvent.change(screen.getByLabelText('Paint colour'), { target: { value: '1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply paint' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save new version' }))

  expect(screen.queryByRole('alert')).toBeNull()
  expect(store.projects).toHaveLength(2)
  const version = store.projects.find(p => p.id !== 'original')
  expect(version).toMatchObject({ versionOf: 'original', currentRow: 1, currentRun: 0, completedRows: [], chartStarted: false, grid: [[1, 0, 1], [0, 1, 1]] })
  expect(version.startedAt).toBeUndefined()
  expect(version.editorDraftId).toBeUndefined()
  expect(version.sourceDraftId).toBe(field ? 'real-draft' : undefined)
  expect(store.projects.find(p => p.id === 'original')).toEqual(before)
  expect(onOpen).toHaveBeenCalledWith(version.id)
  const saved = parseBackup(localStorage.getItem(KEY)).find(p => p.id === version.id)
  expect(saved.startedAt).toBeUndefined()
  expect(saved.editorDraftId).toBeUndefined()
  expect(saved.sourceDraftId).toBe(field ? 'real-draft' : undefined)
  view.unmount()
  mount()
  expect(store.projects.find(p => p.id === version.id)).toMatchObject({ grid: version.grid, completedRows: [] })
  expect(screen.queryByRole('alert')).toBeNull()
})

it.each(['round', 'turned'])('changing handedness replaces a stale direction override for %s work', workingMethod => {
  localStorage.setItem(KEY, JSON.stringify({ projects: [{ ...original, currentRow: 1, completedRows: [], workingMethod }] }))
  const view = mount()
  fireEvent.click(screen.getByRole('button', { name: 'Options' }))
  fireEvent.click(screen.getByText('Reading settings & colour key'))
  fireEvent.change(screen.getByLabelText('Handedness'), { target: { value: 'left' } })
  expect(screen.getByText('Left to right →')).toBeInTheDocument()
  expect(within(screen.getByRole('list', { name: 'Row instructions' })).getAllByRole('button')[0]).toHaveTextContent('2 × A')
  expect(store.projects[0].currentRun).toBe(0)
  view.unmount()
  mount()
  expect(screen.getByText('Left to right →')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Next row' }))
  expect(screen.getByText(workingMethod === 'round' ? 'Left to right →' : '← Right to left')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Options' }))
  fireEvent.click(screen.getByText('Reading settings & colour key'))
  fireEvent.change(screen.getByLabelText('Handedness'), { target: { value: 'right' } })
  expect(screen.getByText(workingMethod === 'round' ? '← Right to left' : 'Left to right →')).toBeInTheDocument()
})
