import { useEffect, useRef, useState } from 'react'
import { loadImageFile, quantizeToGrid, revokeImage, rowsForImage } from '../lib/quantize'
import { useStore } from '../store'

const COLOR_COUNTS = [2, 3, 4, 6]
const DEFAULT_ROWS = 96

export default function ImportGrid({ initialFile, onBack, onGenerated }) {
  const { addProject } = useStore()
  const [img, setImg] = useState(null)
  const [src, setSrc] = useState(null)
  const [stitches, setStitches] = useState(24)
  const [colorCount, setColorCount] = useState(4)
  const [method, setMethod] = useState('round')
  const [name, setName] = useState('New chart')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const pick = async (file) => {
    setError(null)
    try {
      const loaded = await loadImageFile(file)
      setImg((prev) => {
        revokeImage(prev)
        return loaded
      })
      setSrc(loaded.src)
      // seed the project name from the file so the list isn't full of "New chart"
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
      if (base) setName(base.charAt(0).toUpperCase() + base.slice(1))
    } catch (e) {
      setImg((prev) => {
        revokeImage(prev)
        return null
      })
      setSrc(null)
      setError(e.message || "That file couldn't be imported.")
    }
  }

  useEffect(() => {
    if (initialFile) pick(initialFile)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile])

  // release the last preview URL when the screen goes away
  const imgRef = useRef(null)
  imgRef.current = img
  useEffect(() => () => revokeImage(imgRef.current), [])

  const rows = img ? rowsForImage(img.width, img.height, stitches) : DEFAULT_ROWS

  const generate = async () => {
    if (!img) return
    setBusy(true)
    setError(null)
    // yield a frame so the button shows its working state before we block
    await new Promise((r) => setTimeout(r, 16))
    try {
      const { grid, rows: total, colors } = quantizeToGrid(img, stitches, colorCount)
      const project = {
        id: `p-${Date.now()}`,
        name,
        stitchesWide: stitches,
        totalRows: total,
        colorCount,
        workingMethod: method,
        colors,
        grid,
        currentRow: 1,
      }
      addProject(project)
      onGenerated(project.id)
    } catch (e) {
      setError(e.message || 'The chart could not be generated. Try another photo.')
    } finally {
      setBusy(false)
    }
  }

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
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="press"
            onClick={onBack}
            aria-label="Back"
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              background: 'var(--sunken)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 17,
              color: 'var(--ink)',
              flexShrink: 0,
            }}
          >
            ‹
          </button>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Set up the grid</h1>
        </div>

        <button
          className="press"
          onClick={() => fileRef.current?.click()}
          style={{
            position: 'relative',
            height: 210,
            borderRadius: 12,
            border: '1px solid var(--border)',
            overflow: 'hidden',
            width: '100%',
            display: 'grid',
            placeItems: 'center',
            background: src
              ? 'var(--canvas)'
              : 'repeating-linear-gradient(45deg, var(--canvas) 0 6px, var(--paper) 6px 12px)',
          }}
        >
          {/* The whole photo, uncropped — what you see here is what gets
              charted. The overlay draws the actual stitch grid, so moving the
              slider shows the real cell density. */}
          <span
            style={{
              position: 'relative',
              display: 'block',
              height: src ? '100%' : 0,
              aspectRatio: img ? `${img.width} / ${img.height}` : '1',
              maxWidth: '100%',
              background: src ? `center/100% 100% no-repeat url(${src})` : 'none',
            }}
          >
            <span
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage:
                  'linear-gradient(to right, rgba(30,27,24,0.28) 1px, transparent 1px),' +
                  'linear-gradient(to bottom, rgba(30,27,24,0.28) 1px, transparent 1px)',
                backgroundSize: `${100 / stitches}% ${100 / rows}%`,
              }}
            />
          </span>
          {!src && (
            <span
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage:
                  'linear-gradient(to right, rgba(30,27,24,0.14) 1px, transparent 1px),' +
                  'linear-gradient(to bottom, rgba(30,27,24,0.14) 1px, transparent 1px)',
                backgroundSize: '14px 11px',
              }}
            />
          )}
          {!src && (
            <span
              className="mono"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                letterSpacing: '0.1em',
                color: 'var(--body)',
              }}
            >
              <span style={{ background: 'var(--paper)', padding: '6px 10px', borderRadius: 4 }}>
                DROP YOUR PHOTO HERE
              </span>
            </span>
          )}
          <span
            className="mono"
            style={{
              position: 'absolute',
              right: 10,
              bottom: 10,
              fontSize: 10,
              color: '#fff',
              background: 'rgba(30,27,24,0.72)',
              borderRadius: 4,
              padding: '4px 6px',
              letterSpacing: '0.06em',
            }}
          >
            {stitches} × {rows} STITCHES
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) pick(f)
          }}
        />

        {error && (
          <div
            role="alert"
            style={{
              background: 'rgba(180,85,60,0.08)',
              border: '1px solid var(--accent)',
              color: 'var(--accent-readout)',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <Field label="Stitches wide" value={stitches}>
          <input
            type="range"
            min={8}
            max={60}
            value={stitches}
            onChange={(e) => setStitches(Number(e.target.value))}
            aria-label="Stitches wide"
            className="stitch-slider"
            style={{ '--fill': `${((stitches - 8) / 52) * 100}%` }}
          />
        </Field>

        <Field label="Reduce to">
          <div style={{ display: 'flex', gap: 8 }}>
            {COLOR_COUNTS.map((n) => {
              const on = n === colorCount
              return (
                <button
                  key={n}
                  className="press"
                  onClick={() => setColorCount(n)}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    background: on ? 'var(--accent)' : 'var(--surface)',
                    color: on ? '#fff' : 'var(--body)',
                    border: on ? '1px solid var(--accent)' : '1px solid var(--border)',
                  }}
                >
                  {n} colors
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Working method">
          <div
            style={{
              display: 'flex',
              background: 'var(--sunken)',
              borderRadius: 10,
              padding: 3,
            }}
          >
            {[
              ['round', 'In the round'],
              ['turned', 'Turned rows'],
            ].map(([id, label]) => {
              const on = method === id
              return (
                <button
                  key={id}
                  className="press"
                  onClick={() => setMethod(id)}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    background: on ? 'var(--surface)' : 'transparent',
                    color: on ? 'var(--ink)' : 'var(--muted)',
                    boxShadow: on ? '0 1px 3px rgba(30,27,24,0.1)' : 'none',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </Field>

        <div style={{ marginTop: 'auto', paddingTop: 20 }}>
          <button className="pill-primary press" onClick={generate} disabled={!img || busy}>
            {busy ? 'Generating…' : img ? 'Generate chart' : 'Choose a photo first'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
        {value !== undefined && (
          <span className="mono" style={{ fontSize: 13, color: 'var(--accent-readout)' }}>
            {value}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
