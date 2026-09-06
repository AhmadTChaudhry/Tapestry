import { useMemo } from 'react'
import { rankLabel } from '../../lib/chart'
import { quantizeToGrid } from '../../lib/quantize'
import { createDraftImage } from '../model'

/** The palette the chart will actually be worked in, so yarn can be chosen
 *  against the real colours rather than a guess at them — and what part
 *  each one plays (Background / Foreground / Accent), so there's a sensible
 *  name to hand a yarn to before anyone's typed one in. */
const paletteForDraft = (image, draft) => {
  if (!image) return null
  try {
    const colorCount = draft.image?.colorCount ?? createDraftImage().colorCount
    const { colors, roles } = quantizeToGrid(image, draft.grid.columns, colorCount, {
      rows: draft.grid.rows,
      draft,
    })
    return { colors, roles }
  } catch {
    return null
  }
}

export default function YarnStage({ draft, dispatch, image }) {
  const { grid, transform, fitMode } = draft
  const adjustments = draft.image
  const palette = useMemo(
    () => paletteForDraft(image, draft),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [image, grid.columns, grid.rows, grid.gauge, fitMode, transform, adjustments],
  )
  const overrides = draft.yarns || []

  if (!palette) {
    return <p className="editor-note">The palette appears once the photo has been sampled.</p>
  }

  return (
    <div className="editor-controls">
      <p className="editor-note">
        Each colour starts out named for the part it plays in the photo — rename it
        to the yarn you're actually using, and nudge the swatch if that yarn sits
        away from the photo.
      </p>

      <ul className="editor-yarn-list">
        {palette.colors.map((photoHex, index) => {
          const override = overrides[index] || {}
          const hex = override.hex || photoHex
          const fallback = rankLabel(index)
          const role = palette.roles[index]
          const name = override.label ?? role

          return (
            <li className="editor-yarn" key={index}>
              <span className="editor-yarn-rank mono" aria-hidden="true">{fallback}</span>
              <label className="editor-yarn-swatch" style={{ '--swatch': hex }}>
                <span className="editor-visually-hidden">{`Colour for yarn ${fallback}`}</span>
                <input
                  type="color"
                  value={hex}
                  onChange={(event) => dispatch({
                    type: 'yarn/patch',
                    index,
                    patch: { hex: event.target.value },
                  })}
                />
              </label>
              <label className="editor-yarn-name">
                <span className="editor-visually-hidden">{`Name for yarn ${fallback}`}</span>
                <input
                  type="text"
                  value={name}
                  placeholder={role}
                  maxLength={24}
                  onChange={(event) => dispatch({
                    type: 'yarn/patch',
                    index,
                    patch: { label: event.target.value },
                  })}
                />
              </label>
              <button
                className="editor-yarn-revert press"
                type="button"
                hidden={!override.hex}
                aria-label={`Use the photo colour for yarn ${fallback}`}
                onClick={() => dispatch({ type: 'yarn/patch', index, patch: { hex: null } })}
              >
                ⟲
              </button>
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
