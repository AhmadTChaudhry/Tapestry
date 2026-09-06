import { COLOR_COUNTS, IMAGE_LIMITS, createDraftImage } from '../model'

const SLIDERS = [
  { field: 'brightness', label: 'Brightness' },
  { field: 'contrast', label: 'Contrast' },
  { field: 'saturation', label: 'Saturation' },
]

// Sliders read as a signed nudge from neutral rather than a raw multiplier,
// which is what "a bit brighter" actually means to someone framing a photo.
const readout = (value) => {
  const shift = Math.round((value - 1) * 100)
  if (shift === 0) return 'Neutral'
  return `${shift > 0 ? '+' : '−'}${Math.abs(shift)}%`
}

const fillPercent = (value, [min, max]) => `${((value - min) / (max - min)) * 100}%`

export default function ImageStage({ draft, dispatch }) {
  const image = { ...createDraftImage(), ...draft.image }
  const untouched = SLIDERS.every(({ field }) => image[field] === 1)

  return (
    <div className="editor-controls">
      {SLIDERS.map(({ field, label }) => (
        <label className="editor-control" key={field}>
          <span className="editor-field-label">{label}</span>
          <output className="editor-field-value mono">{readout(image[field])}</output>
          <input
            className="stitch-slider"
            type="range"
            min={IMAGE_LIMITS[field][0]}
            max={IMAGE_LIMITS[field][1]}
            step="0.01"
            value={image[field]}
            aria-label={label}
            style={{ '--fill': fillPercent(image[field], IMAGE_LIMITS[field]) }}
            onChange={(event) => dispatch({
              type: 'image/patch',
              patch: { [field]: Number(event.target.value) },
            })}
          />
        </label>
      ))}

      <fieldset className="editor-group">
        <legend className="editor-field-label">Reduce to</legend>
        <div className="editor-segmented">
          {COLOR_COUNTS.map((count) => (
            <label className="editor-choice" key={count}>
              <input
                type="radio"
                name="colorCount"
                checked={image.colorCount === count}
                onChange={() => dispatch({ type: 'image/patch', patch: { colorCount: count } })}
              />
              <span>{count} colours</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="editor-actions">
        <button
          className="press"
          type="button"
          disabled={untouched}
          onClick={() => dispatch({ type: 'image/reset' })}
        >
          Reset adjustments
        </button>
      </div>
    </div>
  )
}
