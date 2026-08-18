import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { seedProjects } from './lib/seed'
import { clampRow } from './lib/chart'

const KEY = 'tapestry-crochet/v1'

const greyRamp = (n) =>
  Array.from({ length: n }, (_, i) => {
    const v = Math.round((i / Math.max(1, n - 1)) * 220 + 20)
    return '#' + v.toString(16).padStart(2, '0').repeat(3).toUpperCase()
  })

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // an empty list is a valid saved state — only fall back to seeds when
    // there is nothing usable stored at all
    if (!Array.isArray(parsed?.projects)) return null
    // Projects saved before colours moved onto the project itself (they used to
    // point at a shared yarn colorway) get a neutral ramp so they still open.
    return {
      ...parsed,
      projects: parsed.projects.map((p) =>
        Array.isArray(p.colors) ? p : { ...p, colors: greyRamp(p.colorCount || 4) },
      ),
    }
  } catch {
    return null
  }
}

const initial = () =>
  load() || {
    projects: seedProjects,
    gauge: 'true', // 'true' (aran) | 'square'
    gaps: true, // false draws the chart as continuous fabric, no cell separation
    theme: 'light',
  }

const Ctx = createContext(null)

export function StoreProvider({ children }) {
  const [state, setState] = useState(initial)

  // Persist on every change — the current row is the most important state in
  // the app and must survive a kill, not wait for an exit hook.
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* quota / private mode — the chart still works for this session */
    }
  }, [state])

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', state.theme === 'dark' ? '#14120F' : '#F7F3EC')
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
      setGauge: (gauge) => setState((s) => ({ ...s, gauge })),
      toggleGaps: () => setState((s) => ({ ...s, gaps: s.gaps === false })),
      toggleTheme: () =>
        setState((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setRow: (id, n) =>
        patchProject(id, (p) => ({
          currentRow: clampRow(p, typeof n === 'function' ? n(p.currentRow) : n),
        })),
      addProject: (project) =>
        setState((s) => ({ ...s, projects: [project, ...s.projects] })),
      removeProject: (id) =>
        setState((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== id) })),
    }),
    [state, patchProject],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
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
