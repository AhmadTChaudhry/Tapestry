import { useRef, useState } from 'react'
import { useStore } from '../store'
import { percentDone } from '../lib/chart'
import MiniChart from '../components/MiniChart'
import ProjectTools from '../components/ProjectTools'
import { downloadFile, serializeBackup, MAX_BACKUP_BYTES } from '../lib/backup'
import { PhotoIcon } from './Home'
import './home-library.css'

export default function MyCharts({ onOpen, onNew, onImportFile }) {
  const { projects: library, importProjects } = useStore()
  const [archived, setArchived] = useState(false)
  const [notice, setNotice] = useState('')
  const backupRef = useRef(null)
  const fileRef = useRef(null)
  const projects = library.filter(p => Boolean(p.archived) === archived)
  return <main className="screen screen--tab library-screen">
    <div className="library-scroll">
      <header className="library-heading"><h1>Your charts</h1><p>{projects.length} {archived ? 'archived' : 'active'} {projects.length === 1 ? 'project' : 'projects'}</p></header>
      <details className="library-advanced">
        <summary><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 7h16M4 17h16" strokeLinecap="round" /><circle cx="9" cy="7" r="3" fill="var(--paper)" /><circle cx="15" cy="17" r="3" fill="var(--paper)" /></svg><span>Library tools</span><svg className="disclosure-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m8 10 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg></summary>
        <div className="library-advanced-actions">
          <button type="button" aria-pressed={archived} onClick={() => setArchived(value => !value)}>{archived ? 'Show active charts' : 'Show archived charts'}</button>
          <button type="button" onClick={() => {
            try { downloadFile('crochet-library.json', serializeBackup(library)); setNotice('Backup downloaded.') }
            catch (error) { setNotice(error.message) }
          }}>Back up whole library</button>
          <button type="button" onClick={() => backupRef.current?.click()}>Import JSON backup</button>
          <p>Backups include all your charts and row progress. Photo-editor drafts stay on this device.</p>
        </div>
      </details>
      {notice && <p className="library-notice" role="status">{notice}</p>}
      {projects.length ? <div className="library-project-list">
        {projects.map(project => <article className="library-project" key={project.id}>
          <button className="library-project-open" type="button" onClick={() => onOpen(project.id)}>
            <MiniChart project={project} size={80} />
            <span className="library-project-info"><span className="library-project-name">{project.name}</span><span className="project-row">Row {project.currentRow} of {project.totalRows}</span><span className="project-progress" aria-hidden="true"><span style={{ width: `${percentDone(project)}%` }} /></span><span className="library-project-completion">{percentDone(project)}% complete</span></span>
            <svg className="library-open-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <ProjectTools project={project} onOpen={onOpen} />
        </article>)}
      </div> : <div className="library-empty library-empty--charts"><h2>{archived ? 'No archived charts' : 'A little room for inspiration'}</h2><p>{archived ? 'Charts you archive will be kept here, ready to restore whenever you like.' : 'Start with a photo, or bring your charts back with a library backup.'}</p></div>}
    </div>
    <div className="library-bottom-action">
      <button className="library-new-photo" type="button" onClick={onNew}><PhotoIcon />New chart from a photo</button>
      <button className="chart-photo-chooser library-photo-link" type="button" onClick={() => fileRef.current?.click()}>Choose an existing photo</button>
    </div>
    <input ref={fileRef} type="file" accept="image/*" aria-label="Choose a photo" hidden onChange={event => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (file) onImportFile(file)
    }} />
    <input ref={backupRef} type="file" accept=".json,application/json" aria-label="Import chart backup" hidden onChange={async event => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      try {
        if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup exceeds 20 MB.')
        const imported = importProjects(await file.text())
        setNotice(`Imported ${imported.length} charts as separate copies. Photo-editor drafts are not included. Source and version metadata are retained.`)
      } catch (error) { setNotice(`Import failed: ${error.message}`) }
    }} />
  </main>
}
