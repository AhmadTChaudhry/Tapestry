import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { seedProjects } from './lib/seed'
import { clampRow } from './lib/chart'
import { normalizeProject, parseBackup, serializeBackup, downloadFile, saveLibrary, MAX_PROJECTS } from './lib/backup'
import './components/ProjectTools.css'

const KEY = 'tapestry-crochet/v1'

function load() {
  let raw = null
  try {
    raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const projects = raw ? parseBackup(raw, { legacy: true }).map((p, i) => ({ ...parsed.projects[i], ...p })) : seedProjects.map(p => normalizeProject(p))
    return { raw, state: { gauge: 'true', gaps: true, theme: 'light', ...parsed, projects }, error: null }
  } catch (error) {
    return { raw, state: { projects: [], gauge: 'true', gaps: true, theme: 'light' }, error: `Saved library could not be loaded: ${error.message}` }
  }
}

const Ctx = createContext(null)

export function StoreProvider({ children }) {
  const [loaded] = useState(load)
  const [state, setRenderedState] = useState(loaded.state)
  const [persistenceError, setPersistenceError] = useState(loaded.error)
  const expected = useRef(loaded.raw)
  const blockedLoad = useRef(Boolean(loaded.error))
  const stateRef = useRef(state)
  const setState = useCallback(update => {
    const next = typeof update === 'function' ? update(stateRef.current) : update
    stateRef.current = next
    setRenderedState(next)
  }, [])
  const persist = useCallback(() => {
    const write = () => {
      if (blockedLoad.current) return
      try {
        expected.current = saveLibrary(localStorage, KEY, stateRef.current, expected.current)
        setPersistenceError(null)
      } catch (error) {
        setPersistenceError(error.message || 'Device storage is unavailable.')
      }
    }
    // Cooperating tabs serialize comparison + write where Web Locks is available.
    // Older browsers still compare the full saved snapshot before each write.
    if (navigator.locks?.request) navigator.locks.request(KEY, write).catch(error => setPersistenceError(error.message))
    else write()
  }, [])

  // Persist on every change — the current row is the most important state in
  // the app and must survive a kill, not wait for an exit hook.
  useEffect(() => {
    persist()
  }, [state, persist])

  useEffect(() => {
    const onStorage = (event) => {
      if ((event.key === KEY || event.key === null) && event.newValue !== expected.current) {
        setPersistenceError('Another tab changed this library. Export your work, then load the saved library.')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const reloadSaved = () => {
    const next = load()
    if (next.error) { setPersistenceError(next.error); return }
    expected.current = next.raw
    blockedLoad.current = false
    setState(next.state)
    setPersistenceError(null)
  }
  const addProject = useCallback((project) => {
    const normalized = { ...project, ...normalizeProject(project, { fresh: true }) }
    if (stateRef.current.projects.length >= MAX_PROJECTS) throw new Error('Library limit is 200 projects.')
    if (stateRef.current.projects.some(p => p.id === normalized.id)) throw new Error('Project ID already exists.')
    parseBackup(serializeBackup([normalized, ...stateRef.current.projects]))
    setState(s => ({ ...s, projects: [normalized, ...s.projects] }))
    return normalized
  }, [])
  const importProjects = useCallback((input) => {
    const parsed = parseBackup(typeof input === 'string' ? input : JSON.stringify({ projects: input }))
    const ids = new Map(parsed.map(p => [p.id, crypto.randomUUID()]))
    const projects = parsed.map(p => {
      const copy = { ...p, id: ids.get(p.id) }
      // The backup contains charts, not the local IndexedDB photo/draft assets.
      delete copy.editorDraftId
      if (ids.has(copy.versionOf)) copy.versionOf = ids.get(copy.versionOf)
      return copy
    })
    // Validate combined bounds before making an atomic, additive import.
    parseBackup(serializeBackup([...projects, ...stateRef.current.projects]))
    setState(s => ({ ...s, projects: [...projects, ...s.projects] }))
    return projects
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', state.theme === 'dark' ? '#241E2D' : '#F3F0FA')
  }, [state.theme])

  const patchProject = useCallback((id, patch) => {
    setState((s) => ({
      ...s,
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p,
      ),
    }))
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      patchProject,
      addProject,
      importProjects,
      persistenceError,
      retryPersistence: persist,
      setGauge: (gauge) => setState((s) => ({ ...s, gauge })),
      toggleGaps: () => setState((s) => ({ ...s, gaps: s.gaps === false })),
      toggleTheme: () =>
        setState((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setRow: (id, n) =>
        patchProject(id, (p) => ({
          currentRow: clampRow(p, typeof n === 'function' ? n(p.currentRow) : n),
        })),
      // The editor chooses whether a regeneration retains its ID or becomes
      // a new version. Only that exact project may be replaced here.
      upsertProject: (project) =>
        setState((s) => {
          const index = s.projects.findIndex(p => p.id === project.id)
          if (index === -1) {
            const projects = [{ ...project, ...normalizeProject(project, { fresh: true }) }, ...s.projects]
            parseBackup(serializeBackup(projects))
            return { ...s, projects }
          }

          const existing = s.projects[index]
          const merged = { ...existing, ...project, id: existing.id }
          merged.currentRow = clampRow(merged, project.currentRow ?? existing.currentRow)
          Object.assign(merged, normalizeProject(merged))
          const projects = [...s.projects]
          projects[index] = merged
          return { ...s, projects }
        }),
      removeProject: (id) =>
        setState((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== id) })),
    }),
    [state, patchProject, addProject, importProjects, persistenceError, persist],
  )

  return <Ctx.Provider value={value}>{persistenceError && <aside className="persistence-warning" role="alert">
    <strong>Your changes may not be saved.</strong><span>{persistenceError}</span>
    <button onClick={blockedLoad.current ? reloadSaved : persist}>Retry saving / loading</button>
    <button onClick={() => downloadFile('crochet-library.json', serializeBackup(state.projects))}>Export current library</button>
    {loaded.raw && <button onClick={() => downloadFile('crochet-original-storage.json', loaded.raw)}>Download original saved data</button>}
    <button onClick={reloadSaved}>Load saved library (discard session changes)</button>
  </aside>}{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)

/** Keep the screen awake while a chart is open (night mode especially). */
export function useWakeLock(active) {
  const ref = useRef(null)
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let cancelled = false
    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) lock.release()
        else ref.current = lock
      } catch {
        /* denied, or tab not visible — nothing to do */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') request()
    }
    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      ref.current?.release().catch(() => {})
      ref.current = null
    }
  }, [active])
}

/** Haptic tick on marker change, where the platform has one. */
export const tick = () => navigator.vibrate?.(8)
