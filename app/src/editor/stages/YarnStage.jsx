import { useMemo } from 'react'
import { rankLabel } from '../../lib/chart'
import { quantizeToGrid } from '../../lib/quantize'
import { createDraftImage } from '../model'
import { matchedYarns, buildDraftChart } from '../../lib/conversion'

/** The palette the chart will actually be worked in, so yarn can be chosen
 *  against the real colours rather than a guess at them — and what part
 *  each one plays (Background / Foreground / Accent), so there's a sensible
 *  name to hand a yarn to before anyone's typed one in. */
const paletteForDraft = (image, draft) => {
  if (!image) return null
  try {
    const colorCount = draft.image?.colorCount ?? createDraftImage().colorCount
    const { colors, roles, counts } = quantizeToGrid(image, draft.grid.columns, colorCount, {
      rows: draft.grid.rows,
      draft,
      lockedColors: (draft.yarns || []).filter(y => y?.locked).map(y => y.sourceHex || y.hex).filter(Boolean),
    })
    return { colors, roles, counts }
  } catch {
    return null
  }
}

export default function YarnStage({ draft, dispatch, image, onHighlight }) {
  const { grid, transform, fitMode } = draft
  const adjustments = draft.image
  const palette = useMemo(
    () => paletteForDraft(image, draft),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [image, grid, fitMode, transform, adjustments, draft.yarns],
  )
  const overrides = draft.yarns || []
  const matches = palette ? matchedYarns(palette.colors, overrides) : []

  if (!palette) {
    return <p className="editor-note">The palette appears once the photo has been sampled.</p>
  }

  return (
    <div className="editor-controls">
      <p className="editor-note">
        Give each colour a yarn name. Tap its letter to locate its stitches. Lock an important photo colour to preserve it during palette reduction. Assign the same swatch to merge groups in the finished chart.
      </p>
      <label className="editor-control">Colour mapping<select aria-label="Colour mapping" value={draft.paletteMode || 'photo'} onChange={e => dispatch({ type: 'settings/patch', patch: { paletteMode: e.target.value } })}><option value="photo">Recolour existing groups</option><option value="yarn">Match image to these yarns</option></select></label>
      {overrides.some(y => y?.locked) && <p className="editor-note">Locked colours take priority and may exceed the requested palette size. Review shows the actual count.</p>}

      <ul className="editor-yarn-list">
        {palette.colors.map((photoHex, index) => {
          const override = matches[index] || {}
          const slot = matches[index] ? overrides.indexOf(matches[index]) : overrides[index] ? overrides.length : index
          const update = patch => dispatch({ type: 'yarn/patch', index: slot, patch: { ...patch, sourceHex: photoHex } })
          const hex = override.hex || photoHex
          const fallback = rankLabel(index)
          const role = palette.roles[index]
          const name = override.label ?? fallback

          return (
            <li className="editor-yarn" key={index}>
              <button type="button" className="editor-yarn-rank mono" aria-label={`Highlight yarn ${fallback}`} onClick={() => {
                try {
                  const chart = buildDraftChart(image, draft)
                  const finalIndex = chart.colors.findIndex(c => c.toUpperCase() === hex.toUpperCase())
                  onHighlight?.(finalIndex >= 0 ? finalIndex : null)
                } catch { onHighlight?.(null) }
              }}>{fallback}</button>
              <label className="editor-yarn-swatch" style={{ '--swatch': hex }}>
                <span className="editor-visually-hidden">{`Colour for yarn ${fallback}`}</span>
                <input
                  type="color"
                  value={hex}
                  onChange={(event) => update({ hex: event.target.value })}
                />
              </label>
              <label className="editor-yarn-name">
                <span className="editor-visually-hidden">{`Name for yarn ${fallback}`}</span>
                <input
                  type="text"
                  value={name}
                  placeholder={role}
                  maxLength={24}
                  onChange={(event) => update({ label: event.target.value })}
                />
              </label>
              <button
                className="editor-yarn-revert press"
                type="button"
                hidden={!override.hex}
                aria-label={`Use the photo colour for yarn ${fallback}`}
                onClick={() => update({ hex: null })}
              >
                ⟲
              </button>
              <label className="yarn-lock"><input type="checkbox" checked={!!override.locked} onChange={e => update({ locked: e.target.checked })} />Lock {fallback}</label>
              <small>{palette.counts?.[index]?.toLocaleString() ?? '—'} source stitches · {role}</small>
            </li>
          )
        })}
      </ul>

      <div className="editor-actions">
        <button
          className="press"
          type="button"
          disabled={overrides.every((entry) => !entry)}
          onClick={() => dispatch({ type: 'yarn/reset' })}
        >
          Clear yarn choices
        </button>
      </div>
    </div>
  )
}
