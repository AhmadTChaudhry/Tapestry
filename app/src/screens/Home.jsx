import { useRef } from 'react'
import { useStore } from '../store'
import { percentDone } from '../lib/chart'
import MiniChart from '../components/MiniChart'

export default function Home({ onOpen, onNew, onImportFile, onSeeAll }) {
  const { projects } = useStore()
  const fileRef = useRef(null)
  const [current, ...rest] = projects

  return (
    <div className="screen screen--tab">
      <div
        className="pad no-bar"
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingTop: 'max(66px, calc(env(safe-area-inset-top) + 22px))',
          paddingBottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 26,
        }}
      >
        <header>
          <h1
            style={{
              margin: 0,
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
            }}
          >
            Home
          </h1>
          <span className="mono" style={{ fontSize: 12, color: 'var(--faint)' }}>
            {projects.length > 0
              ? `${projects.length} IN PROGRESS`
              : 'NO CHARTS YET'}
          </span>
        </header>

        {current ? (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 className="home-eyebrow">Continue</h2>
            <ContinueCard project={current} onClick={() => onOpen(current.id)} />
          </section>
        ) : (
          <EmptyState />
        )}

        <button className="pill-primary press" onClick={onNew}>
          + New chart from a photo
        </button>

        {rest.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 className="home-eyebrow">Other charts</h2>
              <button
                className="mono press"
                type="button"
                onClick={onSeeAll}
                style={{ fontSize: 11, color: 'var(--faint-2)', letterSpacing: '0.04em' }}
              >
                SEE ALL
              </button>
            </div>
            <div
              className="no-bar"
              style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 2 }}
            >
              {rest.map((project) => (
                <OtherChartCard key={project.id} project={project} onClick={() => onOpen(project.id)} />
              ))}
            </div>
          </section>
        )}

        {projects.length === 0 && (
          <button
            className="chart-photo-chooser mono press"
            onClick={() => fileRef.current?.click()}
            style={{
              fontSize: 11,
              color: 'var(--faint-2)',
              textAlign: 'center',
              letterSpacing: '0.04em',
            }}
          >
            OR CHOOSE AN EXISTING PHOTO
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) onImportFile(f)
          }}
        />
      </div>
    </div>
  )
}

function ContinueCard({ project, onClick }) {
  const pct = percentDone(project)
  return (
    <button
      className="press"
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 16,
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        textAlign: 'left',
        width: '100%',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <MiniChart project={project} size={72} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div
          style={{
            fontSize: 18,
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
        <div style={{ height: 4, borderRadius: 999, background: 'var(--sunken)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 999 }} />
        </div>
      </div>
      <span aria-hidden="true" style={{ color: 'var(--faint)', fontSize: 20, flexShrink: 0 }}>›</span>
    </button>
  )
}

function OtherChartCard({ project, onClick }) {
  const pct = percentDone(project)
  return (
    <button
      className="press"
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        textAlign: 'left',
        width: 108,
        flexShrink: 0,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <MiniChart project={project} size={88} />
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--ink)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {project.name}
      </div>
      <span className="mono" style={{ fontSize: 10, color: 'var(--faint)' }}>{pct}%</span>
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
        Nothing in progress yet
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.45 }}>
        Start with a photo — a bold, high-contrast one turns into the clearest chart.
      </div>
    </div>
  )
}
