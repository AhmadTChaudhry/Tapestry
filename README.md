# Handoff: Tapestry Crochet Chart App

## Overview
A mobile app that turns any photo into a tapestry-crochet stitch chart. Core job: the maker props the phone next to their work and always knows which row and which stitch runs come next. Secondary job: preview the same chart in a different yarn colorway/weight before buying.

Five screens are designed:
1. My charts (project list)
2. Import & grid setup (photo -> grid)
3. Chart + row marker (the hero screen, interactive in the prototype)
4. Yarn swap sheet (interactive)
5. Night mode chart

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing intended look and behaviour, **not production code to copy**. `Tapestry Crochet App.dc.html` uses a bespoke streaming-template runtime (`support.js`) and a throwaway iPhone bezel (`ios-frame.jsx`); neither belongs in a shipping app.

The task is to **recreate these designs in the target codebase's own environment** (React Native, SwiftUI, Kotlin/Compose, Flutter, React web…) using its established patterns, component library and navigation. If no codebase exists yet, pick the framework that best fits a phone-first, canvas-heavy app — React Native or SwiftUI are both reasonable — and implement there. The device bezel in the mock is presentation chrome only: build real screens, not framed cards.

Open the HTML file in a browser to interact with it: the +/- stepper and row taps move the marker, and the yarn cards recolor every chart on the canvas.

## Fidelity
**High-fidelity.** Colors, type, spacing and interactions are final-intent. Recreate pixel-closely, but substitute the codebase's own primitives (buttons, sheets, list rows) where they already exist.

## Screens / Views

### 1. My charts
**Purpose:** resume a project or start a new one.
**Layout:** full-bleed `#F7F3EC` background; 20px horizontal padding; 66px top inset (below status bar); vertical stack, 22px gap.
- Header row, baseline-aligned space-between: title "Charts" 32px/600, `-0.02em`, `#1E1B18`; right label "3 ACTIVE" mono 12px `#A2988C`.
- Project cards, 12px gap. Card: `#FFFFFF`, 1px `#E6DFD4`, radius 14px, padding 14px, flex row, 14px gap, center-aligned.
  - Thumbnail 64x64, radius 8px, 1px `#E6DFD4`, overflow hidden — a 16x16 grid of 4x4px cells rendered from the chart data (a real mini chart, not an image).
  - Text column: name 17px/600 `#1E1B18`; meta mono 11px `#A2988C` — format `ROW 42 / 96 · 44%`; progress bar 4px tall, track `#EDE6DB`, fill accent `#B4553C`, radius 999px.
  - Sample content: "Fox & Ferns" row 42/96; "Zigzag tote" row 78/96; "Mountain pillow" row 12/96.
- Pinned to bottom (margin-top auto), 10px gap: primary pill button, height 54px, radius 999px, accent bg, white 17px/600, label "+ New chart from a photo"; below it centered mono 11px `#B2A899` "OR IMPORT A .PAT / .PNG CHART".

### 2. Import & grid setup
**Purpose:** choose stitch count, color reduction and working method before generating the chart.
**Layout:** same paper bg / paddings; 20px gap stack.
- Back affordance: 34px circle `#EDE6DB` with a chevron; title "Set up the grid" 20px/600.
- Photo area: radius 12px, 1px `#E6DFD4`, height 210px. In production this is the user's cropped photo; in the mock it's a diagonal-stripe placeholder with a mono caption "DROP YOUR PHOTO HERE". Over it: a **grid overlay** drawn with two 1px `rgba(30,27,24,0.14)` line gradients at `background-size: 14px 11px` (i.e. cells are wider than tall — real tapestry gauge). Bottom-right chip: mono 10px white on `rgba(30,27,24,0.72)`, radius 4px, "24 × 96 STITCHES".
- "Stitches wide" control: label 15px/600 with mono accent value on the right; slider track 4px `#EDE6DB`, fill accent to 46%, knob 26px white circle, 1px `#DED6C9`, shadow `0 2px 6px rgba(30,27,24,0.14)`. Range 8–60 stitches, default 24.
- "Reduce to" color-count chips: 4 equal chips (2/3/4/6 colors), radius 10px, 13px/600; selected = accent bg + white text, unselected = white bg, `#6E655C` text, 1px `#E6DFD4`.
- "Working method" segmented control: container `#EDE6DB`, radius 10px, 3px padding; active segment white, radius 8px, shadow `0 1px 3px rgba(30,27,24,0.1)`, 14px/600. Options: "In the round" (default) / "Turned rows". This flag flips the reading direction of even rows in the chart.
- Bottom primary pill: "Generate chart", 54px, accent.

### 3. Chart + row marker  (hero)
**Purpose:** read the chart while crocheting; move the marker without looking hard.
**Layout:** column, full height, no horizontal padding on the scroller's parent.
- **Header** (padding 6/20/12, bottom border 1px `#EAE3D8`): project name 19px/600; under it mono 11px `#A2988C` `ROW 42 / 96 · 44% DONE`. Right: two pills, 36px tall, `#EDE6DB`, radius 999px — a layout/zoom toggle (◫) and a gauge toggle showing "ARAN GAUGE" / "SQUARE GRID".
- **Chart scroller** (flex 1, overflow auto, padding 14/16, 1px gap between rows, centered): one row per chart row, **highest row number at top, row 1 at the bottom** (work grows upward).
  - Row = [row-number gutter 20px, mono 10px, right-aligned, `#B2A899`; shown only every 4th row and on the current row] + [cell strip] + [24px right gutter holding the mono 10px accent label "NOW" on the current row].
  - Cell strip: flex, 1px gap, 2px padding, radius 4px. Cells 11x9px (11x11 in square-grid mode) — sized so a full 24-stitch row plus gutters fits inside 370px of usable width, radius 1px, background = palette color for that stitch.
  - **Worked rows** (number < current) render at `opacity 0.34`. Upcoming rows are full strength.
  - **Current row**: strip gets `background: accent @ 14%` and `inset 0 0 0 2px accent`.
  - Tapping any row jumps the marker to it.
  - Render a window of rows around the marker (mock uses current+16 down to current-10) rather than all 96 — keep it virtualised.
- **Bottom control block** (`#FFFFFF`, top border 1px `#EAE3D8`, padding 12/16/8, 12px gap):
  - **Run-length legend for the current row**: chips, 6px gap, single horizontally scrollable line (cap at 4 chips + a "+n more" label), `#F7F3EC`, radius 8px, padding 6/9 — an 11px color dot + mono 12px text like "6 bone", "3 rust". Computed by run-length-encoding the current row left→right (reverse for turned rows on wrong-side rows).
  - **Stepper**: minus block 68x62, radius 16px, `#EDE6DB`, 28px glyph "−"; center column with mono 10px `ROW` (letter-spacing .1em, `#A2988C`) over the row number in mono 34px/500 accent; plus block 68x62 radius 16px accent bg, white "+". Both are far above the 44px minimum target on purpose — they get hit with a hook in hand. Clamp 1..96.
  - **Secondary row**: "Try other yarn" outline pill (flex 1, 44px, radius 999px, 1px `#E0D8CB`, 14px/600) preceded by the 4 palette dots (9px circles, 3px gap); plus a 44px square-ish icon pill "↕" for the swipe/auto-advance settings.

### 4. Yarn swap sheet
**Purpose:** see the chart in another colorway or weight.
**Layout:** the chart screen behind, `blur(1px)` + `opacity .5`, under a `rgba(30,27,24,0.28)` scrim. Sheet pinned bottom: `#FFFFFF`, radius 22px top, padding 14/20/44, 16px gap, shadow `0 -12px 40px rgba(30,27,24,0.18)`, 42x4 grab handle `#E0D8CB`.
- Title "Try other yarn" 22px/600; sub 14px `#7C736A`: "Preview the whole chart in a different colorway or weight before you buy."
- Colorway cards (8px gap): row, 12px gap, padding 12, radius 12; border 1.5px `#E6DFD4` (selected: 1.5px accent + accent @ 6% bg). Left: four 18px swatches, radius 5px, 5px gap. Middle: name 15px/600 + mono 11px `#A2988C` meta. Right: 22px circle, accent bg + white ✓ when selected.
  - Terracotta Wool — "ARAN · 4 SKEINS · 3 IN STASH" — `#EFE7DA #B4553C #2C2823 #C9964F`
  - Sea Glass Cotton — "DK · 4 SKEINS · ORDER ALL" — `#E9EAE3 #3E6B57 #232F35 #9DB29B`
  - Undyed Stash — "WORSTED · FROM MY STASH" — `#E8DFD1 #8A6E52 #3A342E #C7B79C`
- Fabric preview block: `#F7F3EC`, radius 12px, padding 12; mono 10px caption `FABRIC PREVIEW · ARAN GAUGE`; then 6 rows of 16 stitch-shaped cells — 14x10px, `border-radius: 6px 6px 4px 4px`, `inset 0 -2px 3px rgba(0,0,0,0.12)`, 2px gaps, **alternate rows offset 6px** to read as staggered stitches. This is the "what will it look like in real yarn" view; a texture-mapped render would be better still.
- Footer: "Cancel" outline pill (flex 1) + "Use this yarn" accent pill (flex 2), both 52px, radius 999px, 16px/600.
- Selecting a colorway recolors every chart everywhere (project thumbnails included) — it is global preview state, applied on "Use this yarn".

### 5. Night mode
Same structure as screen 3, dark surfaces: page `#14120F`, dividers `#2A2620`, control fill `#241F1A`, primary text `#F0EAE0`, secondary `#7E7568`, row numbers `#6E6559`, row number readout `#D9764F` (accent lightened for dark bg), plus button stays `#B4553C`. Header meta reads "NIGHT MODE · SCREEN STAYS ON" — this mode should also hold a wake lock. Worked rows dim to `opacity 0.3`. Yarn colors themselves are never darkened — the chart must stay color-true.

## Interactions & Behavior
- **Marker up/down:** +/- stepper (clamped 1..96), tap-a-row to jump. Intended additions not drawn: vertical swipe on the chart to nudge the marker, and haptic tick on each change.
- **Auto-scroll:** the chart scroller keeps the current row centered when the marker moves.
- **Gauge toggle:** switches cells between 13x10 (true aran gauge) and 13x13 (square grid). Purely visual; stitch data unchanged.
- **Yarn sheet:** slides up over a scrim; palette pick is instant-preview; "Use this yarn" commits, "Cancel" reverts.
- **Persistence:** the current row per project must survive app kill — it is the single most important piece of state in the app. Persist on every change, not on exit.
- **Night mode:** manual toggle plus screen-awake while a chart is open.
- Transitions in the mock are plain state swaps; use the platform's standard sheet/press animations (~200ms ease-out) rather than inventing new ones.
- No loading/error/empty states were designed. At minimum you will need: chart-generating progress, an empty "no charts yet" state, and an import failure state.

## State Management
Per project: `{ id, name, stitchesWide, totalRows, colorCount, workingMethod: 'round'|'turned', paletteId, grid: number[][] /* palette indices, row-major, row 1 first */, currentRow }`.
App/session: `selectedPaletteId` (preview), `gauge: 'true'|'square'`, `theme: 'light'|'dark'`, `sheetOpen`.
Derived (never stored): percent complete, run-length groups for the current row, the visible row window.
Data: image quantisation (photo -> N colors -> grid of palette indices) runs on-device; yarn colorways come from a bundled/remote color-card catalogue keyed by brand + weight.

## Design Tokens
Colors — paper `#F7F3EC`, canvas `#E7E1D7`, surface `#FFFFFF`, sunken `#EDE6DB`, hairline `#EAE3D8`, border `#E6DFD4`, border-strong `#E0D8CB`, ink `#1E1B18`, body `#6E655C`, muted `#8A8177`, faint `#A2988C` / `#B2A899`, accent `#B4553C`, accent-dark-bg `#D9764F`.
Dark — bg `#14120F`, raised `#241F1A`, divider `#2A2620`, text `#F0EAE0`, muted `#7E7568`.
Spacing — 2, 4, 6, 8, 10, 12, 14, 16, 20, 22, 44, 66 (px).
Radius — 1 (cell), 4, 5, 8, 10, 12, 14, 16, 22 (sheet), 999 (pill).
Type — UI: Hanken Grotesk 700/600/500/400 at 40/32/22/20/19/17/15/14/13px; numeric & labels: IBM Plex Mono 500/400 at 34/13/12/11/10px, letter-spacing .02–.1em on uppercase labels. Substitute the codebase's own sans + mono if it has them; keep the sans/mono split — every count, row number and gauge label is mono on purpose.
Shadows — card `0 1px 3px rgba(30,27,24,0.1)`, knob `0 2px 6px rgba(30,27,24,0.14)`, sheet `0 -12px 40px rgba(30,27,24,0.18)`, stitch inner `inset 0 -2px 3px rgba(0,0,0,0.12)`.
Minimum touch target 44px; stepper blocks are 68x62.

## Assets
None. No images, no icon set — the glyphs used (‹ − + ↕ ◫ ☾ ✓) are text characters and should be replaced with the codebase's icon library. The photo area is a placeholder; the user supplies the image. All chart artwork is generated from data.

## Files
- `Tapestry Crochet App.dc.html` — all five screens (the design reference; open in a browser)
- `support.js` — prototype runtime, **do not port**
- `ios-frame.jsx` — iPhone bezel used for presentation only, **do not port**

## Note on the sample motif
The chart pattern in the mock is a generated diamond-and-stripe motif standing in for a real quantised photo. Don't port the generator — it exists only so the grid looks plausible.

## Screenshots
`screens/all-screens.png` — all five screens in one sheet (light 01–04, night 05), captured from the prototype at 1x. Use it as the visual source of truth alongside the measurements above.
