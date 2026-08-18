# Tapestry Crochet Chart — React implementation

Implementation of the five screens in the handoff (`../README.md`), built as a
phone-first React web app with Vite. Real full-viewport screens, no device bezel.

```bash
npm install
npm run dev     # http://localhost:5183
```

Open it at a phone width (375×812 is what it was built against).

## Layout

| Path | What it is |
| --- | --- |
| `src/index.css` | Design tokens as CSS variables; night mode is `[data-theme="dark"]` |
| `src/store.jsx` | App state, localStorage persistence, wake lock, haptic tick |
| `src/lib/quantize.js` | Photo → stitch grid (canvas resample + median cut) |
| `src/lib/chart.js` | Derived values: cell geometry, run-length groups, percent, row window, turned rows |
| `src/lib/seed.js` | Three stand-in projects so the list isn't empty on first run |
| `src/screens/` | 1 My charts, 2 Import & grid setup, 3 Chart + row marker |

## What's implemented

- **Photo → chart, on device.** The image is drawn into a canvas resampled to
  `stitchesWide × rows`, median-cut into the chosen colour count, and stored as
  colour *ranks* (0 = darkest) plus the actual colours those ranks came from.
  Row count comes from the image aspect corrected by stitch gauge, so the motif
  isn't squashed. Grids are row-major with row 1 first, matching the handoff's
  state shape. Typical run: 1–35 ms.
- **The chart is in the photo's own colours.** Each project carries its own
  `colors` array, averaged over the quantiser's clusters and ordered dark →
  light, labelled A/B/C… the way a written pattern keys its yarns. There is no
  yarn-colorway swap — screen 4 of the handoff is deliberately not built.
- **Marker.** Stepper (clamped 1..totalRows), tap-a-row to jump, vertical swipe
  when the ↕ toggle is on, auto-scroll keeps the current row centred, and a
  haptic tick via the Vibration API where the platform has one.
- **Persistence.** Written to localStorage on every state change, not on exit.
- **Gap toggle** (▦ / ■ in the bottom row) closes the separation between
  stitches so the chart reads as continuous fabric — useful for judging the
  picture rather than counting cells. Cell size is unchanged either way: closing
  the gaps grows each cell into the space the gap occupied, so proportions hold.
- **Night mode**, gauge toggle (aran / square), zoom, run-length
  legend for the current row, and the three states the handoff called for but
  didn't draw: generating, empty, and import failure.

## Keeping proportions honest

Two things used to distort the picture, and both are fixed:

- **The sampler cropped.** It cover-cropped the photo into a grid that is
  deliberately taller in cells than the photo is in pixels, which sliced ~18%
  off the sides. It now stretches the whole photo onto the grid; drawing each
  cell as a wide-and-short stitch undoes the stretch exactly.
- **Cells were rounded to whole pixels** and capped at 11px. On wide charts the
  cell height hit its floor while the 1px gap stayed fixed, so 60 stitches came
  out 22% too tall — and narrow charts didn't fill the screen. `cellMetrics()`
  now sizes a row to span the full usable width at any stitch count, with
  fractional cells and a row pitch derived from the column pitch.
- **The row itself added height.** Each row strip carried 2px of padding, so
  every row was 4px taller than its cells and rows drifted apart: measured in
  the DOM, square-grid mode rendered a 1.487 row/column pitch ratio where it
  should be 1.000. The row is now exactly one cell tall, gutters use
  `line-height: 1` with overflow visible, and the current-row ring is an
  `outline` so it stays out of layout.

**Verify by measuring the DOM, not `cellMetrics()`.** The padding bug survived a
round of checking because the numbers were read off the geometry function rather
than off rendered elements. The check that matters is the ratio of the rendered
row pitch to the rendered column pitch: it should be 0.8182 (9/11) at aran gauge
and 1.0000 at square grid. It currently measures 0.8172–0.8182 and 1.0000, with
gaps both open and closed. Colour count has never affected geometry.

The one place proportions change on purpose is **square-grid mode**, which draws
each stitch as a square — that is what the toggle is for, and it makes the
picture ~22% taller than the finished fabric. Aran gauge is the true view.

## Decisions and deviations worth knowing

- **System fonts.** Per your call: exact hex values and measurements, but the
  platform's system sans and mono rather than Hanken Grotesk / IBM Plex Mono.
  The sans/mono split is preserved everywhere.
- **A third header pill.** The handoff draws two (◫ and gauge) in light mode and
  a ☾ in night mode. All three are present at once; to fit them on a 375px
  screen the night-mode meta line reads `NIGHT MODE · SCREEN ON` rather than
  `… SCREEN STAYS ON`.
- **No yarn colorways.** The handoff's screen 4 (try other yarn) is not built —
  charts show the photo's own colours instead. The knock-on is that nothing maps
  a chart colour to a purchasable yarn; if that matters later, the place to add
  it is a per-colour "match to yarn" step, not a whole-chart colorway swap.
- **The chart sits on the canvas token**, a shade deeper than the page, because
  photo colours can be very pale and the lightest ones stopped reading as cells
  against paper. The handoff drew this area as paper.
- **Web platform limits.** "Screen stays on" uses the Screen Wake Lock API
  (Chrome/Edge/Safari 16.4+; not Firefox) and silently no-ops elsewhere.
  Haptics are the Vibration API — Android only. Both are native on iOS/Android
  if this moves to React Native or SwiftUI later.
- **Virtualisation** renders a window of current+35 … current−25 rows rather
  than all 96. Scrolling beyond that window walks with the marker; a chart
  taller than the window can't be browsed end to end by scrolling alone.
- **Deleting a project** has no designed entry point, so `removeProject` in the
  store has no UI attached. The empty state it leads to is implemented.
- The sample motifs in `seed.js` are original stand-ins, not ports of the
  prototype's generator.
