import { useState } from 'react'
import { useStore } from '../store'
import { downloadFile, printableChart, serializeBackup } from '../lib/backup'
import './ProjectTools.css'

export default function ProjectTools({ project, onOpen }) {
  const { patchProject, addProject } = useStore()
  const [name, setName] = useState(project.name)
  const [error, setError] = useState('')
  const act = fn => { try { fn(); setError('') } catch (reason) { setError(reason.message) } }
  return <details className="project-tools">
    <summary>Manage {project.name}</summary>
    <form onSubmit={event => { event.preventDefault(); act(() => {
      if (!name.trim()) throw new Error('Enter a project name.')
      patchProject(project.id, { name: name.trim() })
    }) }}>
      <label>Project name<input aria-label={`Rename ${project.name}`} maxLength={200} value={name} onChange={event => setName(event.target.value)} /></label>
      <button type="submit">Rename</button>
    </form>
    <div className="project-tools-actions">
      <button onClick={() => act(() => {
        const copy = { ...project, id: crypto.randomUUID(), name: `${project.name.slice(0, 190)} (copy)`, archived: false, completedRows: 0, currentRow: 1, currentRun: 0, chartStarted: false }
        delete copy.editorDraftId
        delete copy.startedAt
        addProject(copy)
        onOpen?.(copy.id)
      })}>Duplicate</button>
      <button onClick={() => patchProject(project.id, { archived: !project.archived })}>{project.archived ? 'Restore' : 'Archive'}</button>
      <button onClick={() => act(() => downloadFile(`${project.name}.json`, serializeBackup([project])))}>Download JSON backup</button>
      <button onClick={() => act(() => downloadFile(`${project.name}.html`, printableChart(project), 'text/html'))}>Download printable chart</button>
    </div>
    {error && <p role="alert">{error}</p>}
  </details>
}
