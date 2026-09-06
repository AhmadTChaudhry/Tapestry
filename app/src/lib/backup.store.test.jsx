import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StoreProvider, useStore } from '../store'
import Home from '../screens/Home'
import ProjectTools from '../components/ProjectTools'

const KEY = 'tapestry-crochet/v1'
const project = { id: 'p', name: 'Test chart', stitchesWide: 2, totalRows: 2, colors: ['#ffffff'], colorCount: 1, grid: [[0, 0], [0, 0]], currentRow: 2, gauge: 'square' }
let store
function Probe() { store = useStore(); return <div>{store.projects.map(p => <span key={p.id}>{p.name}</span>)}</div> }
beforeEach(() => localStorage.setItem(KEY, JSON.stringify({ projects: [project] })))
afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })

it('migrates progress and persists project-specific preferences', () => {
  render(<StoreProvider><Probe /></StoreProvider>)
  expect(store.projects[0].completedRows).toBe(1)
  act(() => store.patchProject('p', { swatch: { stitches: 18, rows: 22 }, handedness: 'left', startDirection: 'ltr' }))
  expect(JSON.parse(localStorage.getItem(KEY)).projects[0]).toMatchObject({ gauge: 'square', swatch: { stitches: 18, rows: 22 }, handedness: 'left' })
})

it('shows failed persistence, preserves session edits and retries successfully', () => {
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded') })
  render(<StoreProvider><Probe /></StoreProvider>)
  expect(screen.getByRole('alert')).toHaveTextContent('Quota exceeded')
  act(() => store.patchProject('p', { name: 'Unsaved progress' }))
  expect(store.projects[0].name).toBe('Unsaved progress')
  expect(screen.getByRole('button', { name: 'Export current library' })).toBeVisible()
  write.mockRestore()
  fireEvent.click(screen.getByRole('button', { name: 'Retry saving / loading' }))
  expect(screen.queryByRole('alert')).toBeNull()
  expect(JSON.parse(localStorage.getItem(KEY)).projects[0].name).toBe('Unsaved progress')
})

it('refuses to overwrite another tab and can explicitly load its saved state', () => {
  render(<StoreProvider><Probe /></StoreProvider>)
  const newer = JSON.stringify({ projects: [{ ...project, name: 'Other tab' }] })
  localStorage.setItem(KEY, newer)
  act(() => store.patchProject('p', { name: 'This tab' }))
  expect(localStorage.getItem(KEY)).toBe(newer)
  expect(screen.getByRole('alert')).toHaveTextContent('Another tab')
  fireEvent.click(screen.getByRole('button', { name: /Load saved library/ }))
  expect(store.projects[0].name).toBe('Other tab')
})

it('keeps corrupt saved data untouched', () => {
  localStorage.setItem(KEY, '{bad')
  render(<StoreProvider><Probe /></StoreProvider>)
  act(() => store.addProject({ ...project, id: 'new' }))
  expect(localStorage.getItem(KEY)).toBe('{bad')
  expect(screen.getByRole('button', { name: 'Download original saved data' })).toBeVisible()
})

it('imports copies atomically and starts new projects at zero', () => {
  render(<StoreProvider><Probe /></StoreProvider>)
  act(() => store.importProjects(JSON.stringify({ projects: [project] })))
  expect(store.projects).toHaveLength(2)
  expect(store.projects[0].id).not.toBe('p')
  expect(() => store.importProjects('{bad')).toThrow()
  expect(store.projects).toHaveLength(2)
  act(() => store.addProject({ ...project, id: 'new' }))
  expect(store.projects[0].completedRows).toBe(0)
})

it('preserves local draft links but detaches imported copies and remaps versions', () => {
  localStorage.setItem(KEY, JSON.stringify({ projects: [{ ...project, editorDraftId: 'draft', sourceDraftId: 'draft', yarnLabels: [null] }] }))
  render(<StoreProvider><Probe /></StoreProvider>)
  expect(store.projects[0]).toMatchObject({ editorDraftId: 'draft', sourceDraftId: 'draft', yarnLabels: [''] })
  let imported
  act(() => { imported = store.importProjects(JSON.stringify({ projects: [
    { ...project, editorDraftId: 'draft', sourceDraftId: 'draft' },
    { ...project, id: 'revision', versionOf: 'p', sourceDraftId: 'draft' },
  ] })) })
  expect(imported[0].editorDraftId).toBeUndefined()
  expect(imported[0].sourceDraftId).toBe('draft')
  expect(imported[1].versionOf).toBe(imported[0].id)
  expect(store.projects.find(p => p.id === 'p').editorDraftId).toBe('draft')
})

it('leaves version decisions to the editor and rejects invalid additions synchronously', () => {
  render(<StoreProvider><Probe /></StoreProvider>)
  act(() => {
    store.patchProject('p', { editorDraftId: 'draft', completedRows: [1] })
    store.upsertProject({ ...project, id: 'revised', editorDraftId: 'draft', versionOf: 'p', completedRows: 0 })
  })
  expect(store.projects).toHaveLength(2)
  expect(store.projects.find(p => p.id === 'p').completedRows).toEqual([1])
  expect(() => store.upsertProject({ ...project, id: 'bad', grid: [] })).toThrow()
  expect(store.projects).toHaveLength(2)
})

it('archives and restores through project tools and hides archives on Home', () => {
  function Tools() { const { projects } = useStore(); return <ProjectTools project={projects[0]} /> }
  render(<StoreProvider><Probe /><Tools /><Home onOpen={() => {}} onNew={() => {}} /></StoreProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
  expect(store.projects[0].archived).toBe(true)
  expect(screen.getByText('Nothing in progress yet')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
  expect(store.projects[0].archived).toBe(false)
})
