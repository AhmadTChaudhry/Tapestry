import { runsForRow, yarnLabel, rowDirection, rankLabel } from './chart'

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024
export const MAX_PROJECTS = 200
const fail = (message) => { throw new Error(message) }
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max
const text = (s, max = 200) => typeof s === 'string' && s.length <= max
const oneOf = (v, choices) => choices.includes(v)

export function normalizeProject(value, { fresh = false, gauge = 'true', legacy = false } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Invalid project.')
  const p = { ...value }
  if (!text(p.id) || !p.id || !text(p.name) || !p.name.trim()) fail('Project needs a name and ID (up to 200 characters).')
  if (!integer(p.stitchesWide, 1, 120) || !integer(p.totalRows, 1, 400)) fail('Chart dimensions must be 1–120 stitches wide and 1–400 rows.')
  if (legacy && p.colors === undefined) {
    if (!integer(p.colorCount, 1, 64)) fail('Invalid legacy color count.')
    p.colors = Array.from({ length: p.colorCount }, (_, i) => '#' + Math.round(20 + i * 220 / Math.max(1, p.colorCount - 1)).toString(16).padStart(2, '0').repeat(3))
  }
  if (!Array.isArray(p.colors) || !integer(p.colors.length, 1, 64) || p.colors.some(c => typeof c !== 'string' || !/^#[\da-f]{6}$/i.test(c))) fail('Use 1–64 six-digit hex colors.')
  if (p.colorCount !== undefined && p.colorCount !== p.colors.length) fail('Color count does not match palette.')
  if (!Array.isArray(p.grid) || p.grid.length !== p.totalRows || p.grid.some(row => !Array.isArray(row) || row.length !== p.stitchesWide || row.some(v => !integer(v, 0, p.colors.length - 1)))) fail('Grid dimensions or color indices are invalid.')
  const currentRow = p.currentRow === undefined ? 1 : p.currentRow
  const completedRows = p.completedRows === undefined ? (fresh ? 0 : currentRow - 1) : p.completedRows
  const validCompleted = Array.isArray(completedRows)
    ? completedRows.length <= p.totalRows && new Set(completedRows).size === completedRows.length && completedRows.every(n => integer(n, 1, p.totalRows))
    : integer(completedRows, 0, p.totalRows)
  if (!integer(currentRow, 1, p.totalRows) || !validCompleted) fail('Row progress is outside the chart.')
  if (p.currentRun !== undefined && !integer(p.currentRun, 0, p.stitchesWide - 1)) fail('Invalid stitch-run progress.')
  const workingMethod = p.workingMethod ?? 'round'
  const handedness = p.handedness ?? 'right'
  const startDirection = p.startDirection ?? (handedness === 'left' ? 'ltr' : 'rtl')
  const projectGauge = p.gauge ?? gauge
  if (!oneOf(workingMethod, ['round', 'turned']) || !oneOf(handedness, ['right', 'left']) || !oneOf(startDirection, ['rtl', 'ltr']) || !oneOf(projectGauge, ['true', 'square'])) fail('Invalid chart preferences.')
  if (p.swatch != null && (typeof p.swatch !== 'object' || ![p.swatch.stitches, p.swatch.rows].every(n => Number.isFinite(n) && n > 0 && n <= 1000))) fail('Swatch stitches and rows per 10 cm must be positive (up to 1000).')
  if (p.archived !== undefined && typeof p.archived !== 'boolean') fail('Invalid archive status.')
  if (p.yarnLabels != null && (!Array.isArray(p.yarnLabels) || p.yarnLabels.length > p.colors.length || p.yarnLabels.some(s => s !== null && !text(s)))) fail('Invalid yarn labels.')
  // Whitelist chart data. Draft IDs are metadata, never embedded image assets.
  const result = { id: p.id, name: p.name.trim(), stitchesWide: p.stitchesWide, totalRows: p.totalRows, colorCount: p.colors.length, colors: [...p.colors], grid: p.grid.map(row => [...row]), currentRow, completedRows, workingMethod, handedness, startDirection, gauge: projectGauge, archived: p.archived ?? false }
  if (p.swatch) result.swatch = { stitches: p.swatch.stitches, rows: p.swatch.rows }
  if (p.yarnLabels) result.yarnLabels = p.yarnLabels.map(label => label ?? '')
  if (p.currentRun !== undefined) result.currentRun = p.currentRun
  if (p.chartStarted !== undefined) {
    if (typeof p.chartStarted !== 'boolean') fail('Invalid started status.')
    result.chartStarted = p.chartStarted
  }
  for (const field of ['editorDraftId', 'sourceDraftId', 'versionOf', 'startedAt']) {
    if (p[field] !== undefined) {
      if (p[field] !== null && !text(p[field])) fail(`Invalid ${field}.`)
      result[field] = p[field]
    }
  }
  return result
}

export function parseBackup(raw, options = {}) {
  if (typeof raw !== 'string' || raw.length > MAX_BACKUP_BYTES || new Blob([raw]).size > MAX_BACKUP_BYTES) fail('Backup exceeds 20 MB.')
  let data
  try { data = JSON.parse(raw) } catch { fail('This file is not valid JSON.') }
  if (!data || (data.version !== undefined && data.version !== 1 && data.version !== 2) || (data.format !== undefined && data.format !== 'tapestry-crochet')) fail('Unsupported backup version or format.')
  if (!Array.isArray(data.projects) || data.projects.length > MAX_PROJECTS) fail('Backup must contain at most 200 projects.')
  let cells = 0
  const ids = new Set()
  return data.projects.map(value => {
    cells += (value?.stitchesWide || 0) * (value?.totalRows || 0)
    if (cells > 2000000) fail('Library exceeds two million stitches.')
    const p = normalizeProject(value, { ...options, gauge: data.gauge ?? 'true' })
    if (ids.has(p.id)) fail('Duplicate project IDs in backup.')
    ids.add(p.id)
    return p
  })
}

export const serializeBackup = projects => JSON.stringify({ format: 'tapestry-crochet', version: 2, projects: projects.map(p => normalizeProject(p)) })
export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const symbol = i => escapeHTML(rankLabel(i))

export function printableChart(value) {
  const p = normalizeProject(value)
  const e = escapeHTML
  const direction = row => rowDirection(p, row) === 'rtl' ? 'right to left' : 'left to right'
  const completedCount = Array.isArray(p.completedRows) ? p.completedRows.length : p.completedRows
  const tiles = []
  for (let top = p.totalRows; top > 0; top -= 40) {
    const bottom = Math.max(1, top - 39)
    for (let left = 0; left < p.stitchesWide; left += 30) {
      const right = Math.min(p.stitchesWide, left + 30)
      const columns = Array.from({ length: right - left }, (_, i) => `<th scope="col">${left + i + 1}</th>`).join('')
      const rows = []
      for (let row = top; row >= bottom; row--) {
        rows.push(`<tr><th scope="row">${row}</th>${p.grid[row - 1].slice(left, right).map(v => `<td style="background:${p.colors[v]}"><span>${symbol(v)}</span></td>`).join('')}<th>${row}</th></tr>`)
      }
      tiles.push(`<section class="chart-tile"><h2>${e(p.name)} · Tile ${tiles.length + 1}</h2><p>Columns ${left + 1}–${right} · Rows ${bottom}–${top}. Row 1 is at the bottom of the complete chart.</p><table><thead><tr><th>Row</th>${columns}<th>Row</th></tr></thead><tbody>${rows.join('')}</tbody><tfoot><tr><th>Row</th>${columns}<th>Row</th></tr></tfoot></table></section>`)
    }
  }
  const written = p.grid.map((_, i) => `<li><strong>Row ${i + 1} (${direction(i + 1)})</strong>: ${runsForRow(p, i + 1).map(run => `${run.count} ${e(yarnLabel(run.index, p))} [${symbol(run.index)}]`).join(', ')}.</li>`).join('')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${e(p.name)}</title>
<style>
@page{size:A4 portrait;margin:12mm}
*{box-sizing:border-box}
body{font:12pt system-ui;margin:24px;color:#111;background:white}
h1{font-size:22pt}h2{font-size:14pt}p{line-height:1.4}
button{padding:10px}
.legend{columns:2;column-gap:24px;padding-left:24px}
.legend li,.written-rows li{margin:6px 0;break-inside:avoid}
.chart-tile{margin:28px 0;overflow:auto}
.chart-tile p{font-size:10pt}
table{border-collapse:collapse;width:auto;table-layout:fixed}
td,th{border:1px solid #888;width:5.2mm;min-width:5.2mm;height:5.2mm;padding:0;text-align:center;font:9pt monospace}
th{background:white}td span{background:white;color:black}
@media print{
 body{margin:0;font-size:11pt}
 button{display:none}
 .chart-tile{break-before:page;break-inside:avoid;margin:0;overflow:visible}
 .chart-tile h2{margin:0 0 3mm}.chart-tile p{margin:0 0 4mm}
 .written-rows{break-before:page}
 *{print-color-adjust:exact;-webkit-print-color-adjust:exact}
}
</style></head><body>
<h1>${e(p.name)}</h1><button onclick="window.print()">Print chart</button>
<p>${p.stitchesWide} stitches × ${p.totalRows} rows · ${e(p.workingMethod)} · ${e(p.handedness)} handed · ${completedCount} rows complete</p>
${p.swatch ? `<p>Gauge per 10 cm: ${p.swatch.stitches} stitches × ${p.swatch.rows} rows</p>` : ''}
<p>The chart is tiled into ${tiles.length} pages of at most 30 columns × 40 rows. Match row and column numbers to join tiles. Symbols match the legend and written rows.</p>
<h2>Legend</h2><ul class="legend">${p.colors.map((c, i) => `<li><b>${symbol(i)}</b> — ${e(yarnLabel(i, p))} (${c})</li>`).join('')}</ul>
${tiles.join('')}
<section class="written-rows"><h2>Written rows</h2><p>Work rows from 1 upward; follow each row’s direction.</p><ol>${written}</ol></section>
</body></html>`
}

export function downloadFile(name, content, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name.replace(/[^a-z0-9._-]/gi, '_')
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export function saveLibrary(storage, key, state, expected) {
  if (storage.getItem(key) !== expected) fail('Another tab changed this library. Export your work, then load the saved library.')
  const raw = JSON.stringify(state)
  storage.setItem(key, raw)
  return raw
}
