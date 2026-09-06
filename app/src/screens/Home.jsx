import { useRef } from 'react'
import { useStore } from '../store'
import { percentDone } from '../lib/chart'
import MiniChart from '../components/MiniChart'
import './home-library.css'

export default function Home({ onOpen, onNew, onImportFile, onSeeAll }) {
  const { projects: library } = useStore()
  const projects = library.filter(p => !p.archived)
  const [current, ...rest] = projects
  const fileRef = useRef(null)
  return (
    <main className="screen screen--tab library-screen">
      <div className="library-scroll">
        <header className="library-heading">
          <h1>Tapestry</h1>
          <p>{projects.length ? `${projects.length} ${projects.length === 1 ? 'project' : 'projects'} in your library` : 'Your next project starts here'}</p>
        </header>
        {current ? (
          <section className="home-continue" aria-labelledby="continue-heading">
            <h2 id="continue-heading">Pick up where you left off</h2>
            <button className="continue-project" type="button" onClick={() => onOpen(current.id)}>
              <div className="continue-preview"><MiniChart project={current} size={196} /></div>
              <div className="continue-description">
                <span className="continue-project-name">{current.name}</span>
                <span className="project-row">Row {current.currentRow} of {current.totalRows}</span>
                <span className="project-progress" aria-hidden="true"><span style={{ width: `${percentDone(current)}%` }} /></span>
                <span className="continue-footer"><span>{percentDone(current)}% complete</span><span className="continue-link">Continue chart <Chevron /></span></span>
              </div>
            </button>
          </section>
        ) : <div className="library-empty"><EmptyStitches /><h2>Nothing in progress yet</h2><p>Turn a photo you love into a chart you can make, one row at a time.</p></div>}
        {rest.length > 0 && (
          <section className="other-projects" aria-labelledby="other-heading">
            <div className="library-section-heading"><h2 id="other-heading">Other charts</h2><button type="button" onClick={onSeeAll}>See all</button></div>
            <div className="other-projects-rail">
              {rest.map(project => <button className="other-project" key={project.id} type="button" onClick={() => onOpen(project.id)}>
                <div className="other-project-preview"><MiniChart project={project} size={104} /></div>
                <span className="other-project-name">{project.name}</span><span>{percentDone(project)}% complete</span>
              </button>)}
            </div>
          </section>
        )}
      </div>
      <div className="library-bottom-action">
        <button className="library-new-photo" type="button" onClick={onNew}><PhotoIcon />New chart from a photo</button>
        {!projects.length && <button className="chart-photo-chooser library-photo-link" type="button" onClick={() => fileRef.current?.click()}>Choose an existing photo</button>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" aria-label="Choose a photo" hidden onChange={event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file) onImportFile(file)
      }} />
    </main>
  )
}

function Chevron() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

export function PhotoIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="4" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 17 5-5 4 4 3-3 5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function EmptyStitches() {
  return <svg className="empty-stitches" aria-hidden="true" viewBox="0 0 100 100" fill="none" strokeWidth="8" strokeLinecap="round"><path stroke="#B8CBC1" d="m22 25 12 12 12-12m8 0 12 12 12-12m-56 20 12 12 12-12" /><path stroke="#F2B89F" d="m54 45 12 12 12-12m-56 20 12 12 12-12" /><path stroke="#724C80" d="m54 65 12 12 12-12" /></svg>
}
