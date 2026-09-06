import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore, useWakeLock, tick } from '../store'
import ProjectTools from '../components/ProjectTools'
import { clampRow, completedRowNumbers, completeRowPatch, editCells, gaugeAspect, hasStarted, percentDone, rankLabel, rowDirection, runsForRow, yarnLabel } from '../lib/chart'
import './chart-reader.css'

/** Kept for existing callers. */
export { rankLabel as colorLabel } from '../lib/chart'

export default function ChartScreen({ projectId, onBack, onOpen, onEdit }) {
  const store = useStore()
  const project = store.projects.find((p) => p.id === projectId)
  useWakeLock(!!project)
  return project ? <Reader key={project.id} project={project} store={store} onBack={onBack} onOpen={onOpen} onEdit={onEdit} /> : null
}

function Reader({ project, store, onBack, onOpen, onEdit }) {
  const [zoom, setZoom] = useState(24)
  const [overview, setOverview] = useState(false)
  const [symbols, setSymbols] = useState(false)
  const [square, setSquare] = useState(store.gauge === 'square')
  const [gaps, setGaps] = useState(store.gaps !== false)
  const [browseRow, setBrowseRow] = useState(clampRow(project, project.currentRow))
  const [target, setTarget] = useState({ row: clampRow(project, project.currentRow) })
  const [followCurrent, setFollowCurrent] = useState(true)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [history, setHistory] = useState(null)
  const [selected, setSelected] = useState({ row: 1, column: 1 })
  const [paintColor, setPaintColor] = useState(0)
  const [tool, setTool] = useState('paint')
  const [notice, setNotice] = useState('')
  const [saveError, setSaveError] = useState('')
  const [savedVersion, setSavedVersion] = useState(null)
  const currentRow = clampRow(project, project.currentRow)
  const draftId = project.editorDraftId || project.sourceDraftId
  const runs = runsForRow(project, currentRow)
  const currentRun = Math.max(0, Math.min(runs.length - 1, Math.floor(Number(project.currentRun) || 0)))
  const completed = completedRowNumbers(project)
  const editing = !!history
  const dirty = editing && history.present !== history.base
  const mustVersion = hasStarted(project) || (editing && project.grid !== history.base)
  const patch = (values) => store.patchProject(project.id, values)
  useEffect(() => {
    if (followCurrent) {
      setBrowseRow(currentRow)
      setTarget({ row: currentRow })
    }
  }, [currentRow, followCurrent])
  const navigate = (n) => {
    const next = clampRow(project, n)
    // Freeze legacy progress before moving; navigation never completes work.
    patch({ currentRow: next, currentRun: 0, completedRows: completed, chartStarted: hasStarted(project) || next > 1 })
    tick()
  }
  const returnTo = (row) => {
    setBrowseRow(row)
    setOverview(false)
    setTarget({ row })
    setFollowCurrent(row === currentRow)
    setNotice('')
  }
  const startEdit = () => {
    setOptionsOpen(false)
    setSaveError('')
    setHistory({ base: project.grid, present: project.grid, past: [], future: [] })
    setOverview(false)
    setNotice('Select a cell, then apply paint or fill. Changes are a draft until saved.')
  }
  const applyEdit = () => {
    if (!Number.isInteger(paintColor) || !project.colors[paintColor]) return
    const next = editCells(history.present, selected.row - 1, selected.column - 1, paintColor, tool)
    if (next === history.present) { setNotice('That cell already uses this colour.'); return }
    setHistory({ ...history, past: [...history.past, history.present].slice(-50), present: next, future: [] })
    setNotice(`${tool === 'fill' ? 'Connected area filled' : 'Cell painted'}. Save when ready.`)
  }
  const undo = () => setHistory((h) => ({ ...h, present: h.past.at(-1), past: h.past.slice(0, -1), future: [h.present, ...h.future] }))
  const redo = () => setHistory((h) => ({ ...h, present: h.future[0], past: [...h.past, h.present], future: h.future.slice(1) }))
  const saveDraft = () => {
    if (!dirty) return
    if (mustVersion) {
      const version = {
        ...project, id: crypto.randomUUID(), name: `${project.name.slice(0, 180)} — edited version`,
        grid: history.present, currentRow: 1, currentRun: 0, completedRows: [],
        chartStarted: false, sourceDraftId: draftId || undefined, archived: false,
        versionOf: project.id, createdAt: new Date().toISOString(),
      }
      delete version.startedAt
      delete version.editorDraftId
      if (!draftId) delete version.sourceDraftId
      store.addProject(version)
      setSavedVersion(version.id)
      setNotice('Saved a new version in My Charts. Your original chart and progress are preserved.')
      setHistory(null)
      onOpen?.(version.id)
    } else {
      patch({ grid: history.present })
      setHistory(null)
      setNotice('Chart edits saved.')
    }
  }
  const save = () => {
    setSaveError('')
    try { saveDraft() }
    catch (error) { setSaveError(`Could not save: ${error.message || 'Please try again.'} Your edit draft is still available.`) }
  }

  return <div className="screen chart-reader">
    <header className="cr-header">
      <button onClick={onBack} disabled={dirty} aria-label="Back to charts">←</button>
      <div className="cr-heading"><h1>{project.name}</h1><span>{percentDone(project)}% complete</span></div>
      <button onClick={store.toggleTheme} aria-label="Toggle night mode">☾</button>
    </header>
    <div className="cr-toolbar cr-view-controls" aria-label="Chart view controls">
      <button onClick={() => { setOverview(true); setFollowCurrent(false); setNotice('Overview shows the whole chart. Zoom in to read individual stitches.') }} disabled={editing}>Fit overview</button>
      <button aria-label="Zoom out" disabled={overview || zoom <= 12} onClick={() => { setOverview(false); setZoom((z) => Math.max(12, z / 1.4)) }}>−</button>
      <button aria-label="Zoom in" disabled={!overview && zoom >= 96} onClick={() => { setOverview(false); setZoom((z) => Math.min(96, z * 1.4)) }}>+</button>
      <button onClick={() => returnTo(currentRow)}>Return current row</button>
      <button aria-pressed={symbols} aria-label={symbols ? 'Hide symbols' : 'Show symbols'} onClick={() => { setSymbols(!symbols); setOverview(false) }}>Symbols</button>
      <button aria-expanded={optionsOpen} aria-controls="cr-options" disabled={editing} onClick={() => setOptionsOpen(!optionsOpen)}>Options</button>
      {!editing && <button onClick={startEdit}>Edit cells</button>}
      {!editing && draftId && <button disabled={!onEdit} onClick={() => onEdit?.(draftId)}>Edit photo setup</button>}
    </div>
    <section id="cr-options" className="cr-options" hidden={!optionsOpen} aria-label="Chart options">
      <div className="cr-toolbar">
        <label>Browse row <input aria-label="Browse row" type="number" inputMode="numeric" min="1" max={project.totalRows} value={browseRow} onChange={(e) => returnTo(clampRow(project, e.target.value))} /></label>
        <span className="cr-help">Browse freely. Your working row stays saved.</span>
      </div>
      <details className="cr-settings"><summary>Reading settings & colour key</summary>
        <div className="cr-toolbar">
          <label>Handedness <select value={project.handedness || 'right'} onChange={(e) => patch({ handedness: e.target.value, startDirection: undefined, currentRun: 0 })}><option value="right">Right-handed</option><option value="left">Left-handed</option></select></label>
          <label>First row direction <select value={project.startDirection || ''} onChange={(e) => patch({ startDirection: e.target.value || undefined, currentRun: 0 })}><option value="">Use handedness</option><option value="rtl">Right to left</option><option value="ltr">Left to right</option></select></label>
          <label>Working method <select value={project.workingMethod === 'flat' ? 'turned' : project.workingMethod || 'round'} onChange={(e) => patch({ workingMethod: e.target.value, currentRun: 0 })}><option value="round">In the round</option><option value="turned">Flat / turned rows</option></select></label>
          <button aria-pressed={square} onClick={() => setSquare(!square)}>Square display</button>
          <button aria-pressed={gaps} onClick={() => setGaps(!gaps)}>Cell gaps</button>
        </div>
        <GaugeForm project={project} patch={patch} />
        <p className="cr-help">Display settings never reshape the saved grid. Swatch measurements are per 10 cm.</p>
        <div className="cr-key">{project.colors.map((hex, i) => <span key={i}><span className="cr-swatch" style={{ background: hex }} />{rankLabel(i)} · {yarnLabel(i, project)}</span>)}</div>
      </details>
      <ProjectTools project={project} onOpen={onOpen} />
    </section>
    <ChartViewport project={project} grid={history?.present || project.grid} zoom={zoom} overview={overview} symbols={symbols} square={square} gaps={gaps} editing={editing} selected={selected} onSelect={setSelected} target={target} />
    <section className="cr-panel" aria-label={editing ? 'Editing chart' : 'Working row'}>
      <p className="cr-notice" role="status">{notice}</p>
      {saveError && <p role="alert">{saveError}</p>}
      {savedVersion && !onOpen && <p>New version saved. Open it from My Charts to continue.</p>}
      {editing ? <section aria-label="Manual chart edits" className="cr-edit">
        <p>{mustVersion ? 'Saving creates a new version with fresh progress.' : 'Editing this unstarted chart.'} Column 1 is the leftmost cell.</p>
        <div className="cr-toolbar">
          <label>Cell row <input aria-label="Cell row" type="number" min="1" max={project.totalRows} value={selected.row} onChange={(e) => setSelected({ ...selected, row: clampRow(project, e.target.value) })} /></label>
          <label>Column <input aria-label="Cell column" type="number" min="1" max={project.stitchesWide} value={selected.column} onChange={(e) => setSelected({ ...selected, column: Math.max(1, Math.min(project.stitchesWide, Math.floor(Number(e.target.value) || 1))) })} /></label>
          <button onClick={() => returnTo(selected.row)}>Show selected row</button>
          <label>Paint colour <select aria-label="Paint colour" value={paintColor} onChange={(e) => setPaintColor(Number(e.target.value))}>{project.colors.map((hex, i) => <option key={i} value={i}>{rankLabel(i)} · {yarnLabel(i, project)} ({hex})</option>)}</select></label>
          <label>Tool <select value={tool} onChange={(e) => setTool(e.target.value)}><option value="paint">Single cell</option><option value="fill">Connected flood fill</option></select></label>
        </div>
        <p>Selected: row {selected.row}, column {selected.column}, {yarnLabel(history.present[selected.row - 1]?.[selected.column - 1], project)}.</p>
        <div className="cr-toolbar">
          <button onClick={applyEdit}>{tool === 'paint' ? 'Apply paint' : 'Apply fill'}</button>
          <button disabled={!history.past.length} onClick={undo}>Undo</button>
          <button disabled={!history.future.length} onClick={redo}>Redo</button>
          <button className="cr-primary" disabled={!dirty} onClick={save}>{mustVersion ? 'Save new version' : 'Save edits'}</button>
          <button onClick={() => { setHistory(null); setSaveError(''); setNotice('Draft edits discarded.') }}>Discard edits</button>
        </div>
      </section> : <>
        <div className="cr-row-title" aria-live="polite"><strong>Row {currentRow} / {project.totalRows}</strong><span>{rowDirection(project, currentRow) === 'rtl' ? '← Right to left' : 'Left to right →'}{completed.includes(currentRow) ? ' · Completed' : ''}</span></div>
        <p className="cr-help cr-run-summary">{runs.reduce((n, run) => n + run.count, 0)} stitches. Follow runs in order, starting with run {currentRun + 1} of {runs.length}.</p>
        <ol className="cr-runs" aria-label="Row instructions">{runs.map((run, i) => <li key={i}><button aria-current={i === currentRun ? 'step' : undefined} onClick={() => patch({ currentRun: i, chartStarted: true })}><span className="cr-swatch" style={{ background: project.colors[run.index] }} /><span>{i + 1}. {run.count} × {yarnLabel(run.index, project)}</span></button></li>)}</ol>
        <div className="cr-navigation">
          <button aria-label="Previous row" disabled={currentRow <= 1} onClick={() => navigate(currentRow - 1)}>Previous</button>
          <button className="cr-primary" onClick={() => { patch(completeRowPatch(project)); tick(); setNotice(`Row ${currentRow} completed.`) }}>Complete row</button>
          <button aria-label="Next row" disabled={currentRow >= project.totalRows} onClick={() => navigate(currentRow + 1)}>Next</button>
        </div>
        {completed.includes(currentRow) && <button onClick={() => patch({ completedRows: completed.filter(row => row !== currentRow) })}>Mark this row incomplete</button>}
      </>}
    </section>
  </div>
}

function GaugeForm({ project, patch }) {
  const [stitches, setStitches] = useState(project.swatch?.stitches ?? '')
  const [rows, setRows] = useState(project.swatch?.rows ?? '')
  const [message, setMessage] = useState('')
  return <form className="cr-toolbar" onSubmit={(e) => {
    e.preventDefault()
    if (!(Number(stitches) > 0 && Number(stitches) <= 100 && Number(rows) > 0 && Number(rows) <= 100)) { setMessage('Enter positive stitch and row counts up to 100 per 10 cm.'); return }
    patch({ gauge: 'true', swatch: { stitches: Number(stitches), rows: Number(rows) } })
    setMessage('Project swatch saved.')
  }}>
    <label>Project gauge <select value={project.gauge || 'true'} onChange={(e) => patch({ gauge: e.target.value })}><option value="true">Stitch / swatch proportions</option><option value="square">Square proportions</option></select></label>
    <label>Stitches / 10 cm <input type="number" min="0.1" max="100" step="any" required value={stitches} onChange={(e) => setStitches(e.target.value)} /></label>
    <label>Rows / 10 cm <input type="number" min="0.1" max="100" step="any" required value={rows} onChange={(e) => setRows(e.target.value)} /></label>
    <button type="submit">Save swatch</button><span role="status">{message}</span>
  </form>
}

function ChartViewport({ project, grid, zoom, overview, symbols, square, gaps, editing, selected, onSelect, target }) {
  const ref = useRef(null)
  const [size, setSize] = useState({ width: 375, height: 400 })
  const aspect = square ? 1 : gaugeAspect(project)
  // Overview can shrink to fit; reading and editing have floors in both axes.
  const minimum = editing ? 44 : symbols ? 18 : 12
  const fit = Math.min(Math.max(1, size.width - 72) / project.stitchesWide, Math.max(1, size.height - 24) / (grid.length * aspect))
  const pitch = overview ? fit : Math.max(zoom, minimum, minimum / aspect)
  const rowHeight = pitch * aspect
  const width = project.stitchesWide * pitch
  const height = grid.length * rowHeight
  const current = clampRow(project, project.currentRow)
  const completedRows = new Set(completedRowNumbers(project))
  useLayoutEffect(() => {
    const el = ref.current
    const measure = () => setSize({ width: el.clientWidth || 375, height: el.clientHeight || 400 })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const el = ref.current
    el.scrollTo?.({ top: overview ? 0 : Math.max(0, (grid.length - target.row + 0.5) * rowHeight - el.clientHeight / 2), left: overview ? 0 : el.scrollLeft, behavior: 'auto' })
    // Only explicit browse/return requests move the viewport, never progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, overview])
  return <div ref={ref} className="cr-viewport" tabIndex={0} role="region" aria-label="Full chart, scroll to browse">
    <svg width={width + 64} height={height + 16} role="img" aria-label={`Full chart: ${project.stitchesWide} columns, ${grid.length} rows. Row 1 at bottom; column 1 at left. ${editing ? 'Tap a cell to select it, then apply your edit using the controls.' : 'Reading direction changes instructions only.'}`}>
      <ChartCells grid={grid} colors={project.colors} pitch={pitch} rowHeight={rowHeight} gaps={gaps} symbols={symbols && !overview} completedRows={completedRows} />
      {grid.map((_, r) => (r + 1 === current || (r + 1) % Math.max(1, Math.ceil(15 / rowHeight)) === 0) && <text key={r} x="27" y={(grid.length - r - 0.5) * rowHeight + 8} textAnchor="end" dominantBaseline="central" className="cr-row-number" fontSize="10">{r + 1}</text>)}
      <rect x="32" y={(grid.length - current) * rowHeight + 8} width={width} height={rowHeight} fill="none" stroke="var(--accent-readout)" strokeWidth="2" pointerEvents="none" />
      {editing && <rect x={32 + (selected.column - 1) * pitch} y={(grid.length - selected.row) * rowHeight + 8} width={pitch} height={rowHeight} fill="none" stroke="var(--ink)" strokeDasharray="4 2" strokeWidth="3" pointerEvents="none" />}
      {editing && <rect x="32" y="8" width={width} height={height} fill="transparent" onClick={(e) => {
        const bounds = e.currentTarget.ownerSVGElement.getBoundingClientRect()
        const column = Math.floor((e.clientX - bounds.left - 32) / pitch) + 1
        const row = grid.length - Math.floor((e.clientY - bounds.top - 8) / rowHeight)
        if (row >= 1 && row <= grid.length && column >= 1 && column <= project.stitchesWide) onSelect({ row, column })
      }} />}
    </svg>
  </div>
}

const ChartCells = memo(function ChartCells({ grid, colors, pitch, rowHeight, gaps, symbols, completedRows }) {
  const gap = gaps ? Math.min(1, pitch * 0.08, rowHeight * 0.08) : 0
  return grid.map((row, r) => <g key={r} data-testid={`chart-row-${r + 1}`} opacity={completedRows.has(r + 1) ? 0.3 : undefined} transform={`translate(32, ${(grid.length - 1 - r) * rowHeight + 8})`}>
    {row.map((color, c) => <g key={c}>
      <rect x={c * pitch} y="0" width={pitch - gap} height={rowHeight - gap} fill={colors[color] || 'transparent'} />
      {symbols && <text x={(c + 0.5) * pitch} y={rowHeight / 2} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(16, pitch * 0.65, rowHeight * 0.65)} fill="#111" stroke="#fff" strokeWidth="2" paintOrder="stroke">{rankLabel(color)}</text>}
    </g>)}
  </g>)
})
