import { useRef } from 'react'
import { useStore } from '../store'
import { percentDone } from '../lib/chart'
import MiniChart from '../components/MiniChart'

export default function MyCharts({ onOpen, onNew, onImportFile }) {
  const { projects } = useStore()
  const fileRef = useRef(null)

  return (
    <div className="screen">
      <div
        className="pad no-bar"
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingTop: 'max(66px, calc(env(safe-area-inset-top) + 22px))',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
            }}
          >
            Charts
          </h1>
          <span className="mono" style={{ fontSize: 12, color: 'var(--faint)' }}>
            {projects.length} ACTIVE
          </span>
        </header>

        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onClick={() => onOpen(p.id)} />
            ))}
          </div>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="pill-primary press" onClick={onNew}>
            + New chart from a photo
          </button>
          <button
            className="mono press"
            onClick={() => fileRef.current?.click()}
            style={{
              fontSize: 11,
              color: 'var(--faint-2)',
              textAlign: 'center',
              letterSpacing: '0.04em',
            }}
          >
            OR IMPORT A .PAT / .PNG CHART
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pat"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) onImportFile(f)
            }}
          />
        </div>
      </div>
    </div>
  )
}

function ProjectCard({ project, onClick }) {
  const pct = percentDone(project)
  return (
    <button
      className="press"
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 14,
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        textAlign: 'left',
        width: '100%',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <MiniChart project={project} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {project.name}
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--faint)' }}>
          ROW {project.currentRow} / {project.totalRows} · {pct}%
        </div>
        <div
          style={{
            height: 4,
            borderRadius: 999,
            background: 'var(--sunken)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: 'var(--accent)',
              borderRadius: 999,
            }}
          />
        </div>
      </div>
    </button>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        border: '1px dashed var(--border-strong)',
        borderRadius: 14,
        padding: '32px 20px',
        textAlign: 'center',
        color: 'var(--body)',
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
        No charts yet
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.45 }}>
        Start with a photo — a bold, high-contrast one turns into the clearest chart.
      </div>
    </div>
  )
}
