# Photo-to-Chart Editor Design

Date: 2026-08-18

## Summary

Replace the current single-page import form with a hybrid mobile editor that keeps a live chart preview visible while grouping controls into five focused stages: Frame, Grid, Image, Yarn, and Review.

The editor must support both crop-to-fit and stretch-to-fit image handling. Users create a manual inventory of yarn colors they already own, and the app maps the edited image to that inventory. A single conversion control balances visual similarity against crochet simplicity. Editing is non-destructive and saved as a recoverable draft.

## Goals

- Make image-to-chart conversion understandable, reversible, and visually immediate.
- Give users meaningful control over framing, dimensions, image cleanup, palette reduction, and yarn mapping.
- Map chart colors to yarn the user owns rather than inventing an unrestricted digital palette.
- Reduce isolated stitches and excessive color changes without silently destroying important image detail.
- Prevent large images and repeated conversion from freezing the interface.
- Preserve enough editor state to reopen and revise a generated chart.

## Non-goals for the first release

- A remote catalog of yarn brands, product lines, or purchasable shades.
- Guaranteed physical color accuracy from an uncalibrated screen or camera.
- Cloud synchronization or collaborative editing.
- Automatic yarn ordering.
- Full photographic background segmentation comparable to specialist image-editing software. A simple assisted background-removal tool may be added after the core editor is stable.

## Product approach

Use a hybrid editor rather than a linear wizard or dense professional canvas.

The live preview occupies the upper portion of the screen. The lower portion is a stage-specific sheet. A compact stage rail provides direct access to Frame, Grid, Image, Yarn, and Review. Advanced controls are collapsed by default. Preview modes, undo, redo, and comparison remain accessible across stages.

This keeps the app approachable for a first-time maker while allowing experienced users to revise earlier decisions without walking backward through a wizard.

## Editor layout

### Header

- Back control with unsaved-draft protection.
- Editable project name.
- Undo and redo.
- Reset for the current stage, with a separate explicit reset-all action.

### Persistent preview

- Displays the current crop, grid, palette, and stitch simulation.
- Supports source-image, reduced-image, and stitch-simulation views.
- Offers press-and-hold or split comparison with the source image.
- Supports pinch-to-zoom and drag when the current tool permits them.
- Shows grid dimensions and active fit mode as compact overlays.
- Never applies night-mode tinting to yarn colors.

### Stage navigation

- Five horizontally scrollable stage chips: Frame, Grid, Image, Yarn, Review.
- Each stage reports incomplete, complete, or warning state without relying on color alone.
- Users may revisit any completed stage.
- Generate remains unavailable until required inputs exist and blocking errors are resolved.

### Bottom sheet

- Shows one stage at a time.
- Keeps primary controls visible and places advanced controls in a disclosure section.
- Can expand for detailed editing or collapse to maximize preview space.

## Stage 1: Frame

### Fit modes

- **Crop to fit:** Preserve the source image proportions and let the user position and scale it inside the output grid. Areas outside the output frame are excluded.
- **Stretch to fit:** Use the entire source image and resample it into the selected chart dimensions, even when proportions differ.

The selected fit mode is explicit and reversible.

### Controls

- Drag to position.
- Pinch or slider to scale.
- Rotate in 90-degree steps.
- Horizontal and vertical flip.
- Recenter.
- Free crop plus common aspect presets.
- Stage reset.

The crop rectangle and excluded area must be visually unambiguous. All transformations are stored as parameters; the source image is never destructively rewritten.

## Stage 2: Grid

### Controls

- Stitches wide and rows high, each directly editable.
- Optional dimension lock that derives one dimension from the crop and stitch gauge.
- Aran-gauge and square-grid preview modes.
- User gauge input expressed as stitches and rows per physical measurement.
- Finished width and height calculated from chart dimensions and user gauge.
- Grid opacity.
- Working method: in the round or turned rows.

### Diagnostics

- Total stitch count.
- Estimated color count after mapping.
- Estimated number of color-run transitions.
- Resolution warning when the source crop has insufficient pixels for the chosen grid.
- Complexity indication that updates with dimensions and conversion settings.

## Stage 3: Image

### Primary controls

- Brightness.
- Contrast.
- Saturation.
- Exposure.
- Smoothing.
- Sharpening or edge emphasis.
- Target number of source-color regions before yarn mapping.
- Crochet simplicity control.

### Crochet simplicity control

The control is continuous and has three labelled regions:

- **Photo:** Preserve small regions and fine detail, accepting more color changes.
- **Balanced:** Remove isolated noise while retaining important boundaries.
- **Crochet:** Prefer larger connected regions and longer same-color runs.

The setting affects cleanup after initial color mapping. It must never change a locked yarn mapping or overwrite manual stitch edits.

### Manual cleanup tools

- Replace-color brush for individual stitches or small regions.
- Region fill.
- Eraser that removes a manual override and returns the cell to automatic conversion.
- Simple background-color replacement.

Manual cleanup is represented as an override layer rather than modifying the automatically generated grid.

## Stage 4: My Yarn

### Yarn inventory

Users manually add colors they own. Each entry contains:

- Stable identifier.
- User-facing color name.
- Display color in a perceptual color space plus a stored sRGB value.
- Optional hex entry.
- Optional color sampled from a photo or camera image.
- Optional yarn weight.
- Optional quantity available.
- Optional notes.

The first release does not require brand or commercial shade catalogs.

### Mapping workflow

- Automatic mapping assigns each source color to the perceptually nearest owned yarn.
- Users can lock a yarn so recalculation cannot remove it from the palette.
- Selecting a mapping highlights all affected stitches.
- Users can replace an automatic assignment with another owned yarn.
- Remapping updates the preview immediately.
- Unused owned yarn remains visible but clearly separated.
- Nearly duplicate yarn colors are flagged because they may add complexity without visible benefit.

### Match quality

Use a perceptual color-difference metric rather than direct RGB distance. Every automatic mapping receives a user-facing rating:

- Good match.
- Noticeable difference.
- Poor match.

The interface must state that physical yarn matching is an estimate affected by lighting, camera capture, display calibration, fiber, and dye lot. Ratings provide guidance, not a guarantee.

### Yarn demand

The first release reports each yarn's stitch count and percentage of the chart. It reports estimated length or skein quantity only when the user has supplied gauge, stitch dimensions, yarn weight, and skein metadata. Otherwise, precise quantity fields are omitted rather than inferred.

## Stage 5: Review

### Views

- Source image.
- Adjusted and reduced image.
- Final mapped grid.
- Fabric-style stitch simulation.
- Color-key legend with yarn names.

### Diagnostics

- Isolated one-stitch regions.
- Excessive single-stitch color runs.
- Poor yarn matches.
- Low contrast between adjacent mapped yarns.
- Empty or underspecified yarn inventory.
- Potential yarn shortage when quantity data exists.
- Excessive chart dimensions or complexity.

Warnings are actionable and link back to the relevant stage. Blocking errors prevent generation. Non-blocking warnings may be acknowledged before generation.

### Completion

- Save editable draft.
- Generate chart.
- Generated projects retain a link to their editor configuration so they can be revised later.

## Conversion pipeline

1. Decode the source image and normalize orientation.
2. Apply non-destructive frame transformations.
3. Resample into the selected stitch grid using crop or stretch semantics.
4. Apply tonal and image-cleanup adjustments.
5. Build a temporary source palette.
6. Map source colors to the user's owned-yarn palette using perceptual color distance.
7. Apply simplicity cleanup to reduce isolated regions and unnecessary transitions.
8. Apply locked mappings.
9. Apply manual cell and region overrides.
10. Calculate diagnostics, complexity, stitch counts, and match confidence.

Every stage is deterministic for the same source, settings, inventory, and conversion version.

## Draft and project data

An editor draft contains:

- Draft identifier and schema version.
- Source image stored as a local IndexedDB asset and referenced by a stable asset identifier.
- Project name.
- Source dimensions and normalized orientation.
- Fit mode and transformation parameters.
- Stitch dimensions, gauge, and working method.
- Image adjustment settings.
- Simplicity setting.
- Owned-yarn inventory snapshot.
- Automatic yarn mappings and locked assignments.
- Manual grid overrides.
- Latest derived grid and diagnostics, treated as regenerable cache.
- Conversion algorithm version.
- Created and updated timestamps.

Only source inputs and user decisions are authoritative. Derived previews and grids may be regenerated.

Source images, drafts, derived preview caches, and yarn inventory are stored in IndexedDB because image assets and expanded project data are not suitable for localStorage quotas. Lightweight interface preferences may remain in localStorage.

Drafts autosave after meaningful changes. Leaving the editor preserves the draft. Reopening an unfinished draft restores the last stable state. Schema migrations must preserve older saved projects where practical.

## Application architecture

Refactor the current import screen into bounded units:

- `ChartEditor`: owns navigation, draft lifecycle, and orchestration.
- `ImageCanvas`: renders image transformations, overlays, and gestures.
- `GridControls`: manages dimensions, gauge, finished size, and working method.
- `ImageAdjustments`: manages tonal controls and simplicity configuration.
- `YarnInventory`: creates and edits owned yarn.
- `ColorMapping`: manages automatic, locked, and manual mappings.
- `StitchCleanup`: manages cell and region overrides.
- `ReviewPanel`: presents final previews and diagnostics.
- `ConversionWorker`: performs resampling, quantization, remapping, cleanup, and analysis off the main thread.
- `DraftRepository`: stores, migrates, and restores editor drafts.

Components communicate through a versioned editor-draft model and explicit conversion requests. Conversion internals remain independent from React UI components.

## Runtime behavior

- Lightweight visual changes update immediately where possible.
- Expensive conversion requests are debounced.
- Conversion runs in a Web Worker to keep gestures and controls responsive.
- Each request carries a monotonically increasing revision identifier.
- Results from superseded revisions are ignored.
- A conversion failure preserves the last successful preview and offers retry.
- Progress appears when work lasts long enough to be perceptible; very fast operations do not flash a loading state.

## Error and recovery states

- Unsupported, corrupt, or undecodable image.
- Source image too small for the requested grid.
- Very large source exceeding safe browser memory limits.
- Missing owned-yarn colors.
- Too few distinct owned colors for the requested mapping.
- Poor or ambiguous color matches.
- Insufficient contrast between adjacent mapped yarns.
- Worker failure or cancelled conversion.
- Browser storage quota or write failure.
- Recovery of an unfinished or older-version draft.

Errors must explain what happened, preserve user work, and provide a direct recovery action. Storage failures must be made visible because silent failure would create a false expectation that the draft is safe.

## Accessibility

- Minimum 44-pixel interactive targets.
- Text or pattern indicators in addition to color.
- Labels for all controls and yarn mappings.
- Keyboard controls for operations otherwise available as gestures.
- Numeric inputs alongside sliders where precision matters.
- Logical focus order when the bottom sheet expands or changes stage.
- Reduced-motion behavior.
- Sufficient contrast in light and dark themes without altering displayed yarn colors.

## Testing strategy

### Unit tests

- Crop and stretch coordinate transformations.
- Dimension locking and gauge calculations.
- Orientation normalization.
- Perceptual color distance and confidence thresholds.
- Locked-yarn behavior.
- Simplicity cleanup at representative settings.
- Preservation and removal of manual overrides.
- Complexity and diagnostic calculations.
- Draft serialization and schema migration.
- Revision handling that rejects stale worker results.

### Integration tests

- Conversion pipeline with fixed source fixtures and expected grids.
- Autosave and recovery after simulated interruption.
- Worker failure while retaining the last stable preview.
- Remapping after inventory edits.
- Regeneration after changing crop, dimensions, or working method.

### Browser tests

- Import, crop, stretch, adjust, add yarn, map, review, and generate.
- Reopen an unfinished draft.
- Reopen a generated project in the editor.
- Phone-size interaction, bottom-sheet behavior, keyboard operation, and reduced motion.
- Visual regression snapshots for each stage in light and dark modes.

## Delivery sequence

The design should be implemented incrementally:

1. Draft model, editor shell, persistent preview, crop/stretch, grid controls, and autosave.
2. Worker-based conversion and image adjustments.
3. Manual yarn inventory, perceptual mapping, locks, and confidence ratings.
4. Simplicity cleanup and manual grid overrides.
5. Review diagnostics, fabric preview, accessibility hardening, and end-to-end tests.

This sequence produces a useful editor before advanced cleanup tools are complete while keeping the data model compatible with later stages.

## Approved decisions

- Hybrid editor with persistent preview and staged bottom sheet.
- Both crop-to-fit and stretch-to-fit.
- Manual owned-yarn inventory for the first release.
- Adjustable balance between photo fidelity and crochet simplicity.
- Perceptual color matching with transparent confidence ratings.
- Non-destructive editing and recoverable drafts.
- Worker-based conversion for responsiveness.
