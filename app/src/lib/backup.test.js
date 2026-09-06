import { describe, expect, it } from 'vitest'
import { parseBackup, serializeBackup, printableChart, normalizeProject, saveLibrary } from './backup'
import { rankLabel } from './chart'

const project = () => ({ id: 'p', name: '<img src=x onerror=alert(1)>', stitchesWide: 3, totalRows: 2, currentRow: 2, colors: ['#ffffff', '#123456'], colorCount: 2, grid: [[0, 0, 1], [1, 0, 1]], workingMethod: 'turned', yarnLabels: ['<script>bad</script>', 'Blue'] })

describe('backups', () => {
  it('round trips projects and migrates legacy progress', () => {
    const p = normalizeProject(project())
    expect(p.completedRows).toBe(1)
    expect(parseBackup(serializeBackup([p]))).toEqual([p])
    expect(normalizeProject(project(), { fresh: true }).completedRows).toBe(0)
  })
  it.each([
    { grid: [[0], [1]] }, { grid: [[0, 0, 9], [0, 0, 0]] },
    { totalRows: 1000000 }, { completedRows: -1 }, { currentRow: 99 },
    { colors: ['red; background:url(x)'] }, { colorCount: 9 },
    { swatch: { stitches: 0, rows: 20 } }, { handedness: 'other' },
  ])('rejects malformed project %j', (patch) => {
    expect(() => parseBackup(JSON.stringify({ projects: [{ ...project(), ...patch }] }))).toThrow()
  })
  it('rejects unsupported formats and excessive project counts', () => {
    expect(() => parseBackup('{')).toThrow()
    expect(() => parseBackup(JSON.stringify({ version: 99, projects: [] }))).toThrow()
    expect(() => parseBackup(JSON.stringify({ projects: Array(201).fill(project()) }))).toThrow()
  })
  it('escapes names and produces every written row with symbols and numbering', () => {
    const html = printableChart(normalizeProject(project()))
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script>bad')
    expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;')
    expect(html).toContain('Row 1')
    expect(html).toContain('Row 2')
    expect(html).toContain('window.print()')
  })
  it('surfaces failed storage and refuses stale writes', () => {
    const storage = { getItem: () => 'newer', setItem: () => { throw Error('quota') } }
    expect(() => saveLibrary(storage, 'key', {}, 'older')).toThrow(/another tab/i)
    expect(() => saveLibrary(storage, 'key', {}, 'newer')).toThrow('quota')
  })
  it('accepts an unmeasured swatch and preserves completed row numbers', () => {
    const p = normalizeProject({ ...project(), completedRows: [2], swatch: null })
    expect(parseBackup(serializeBackup([p]))[0].completedRows).toEqual([2])
    expect(printableChart(p)).toContain('1 rows complete')
  })
  it('prints asymmetric runs in the actual working direction on alternating rows', () => {
    const p = { ...project(), name: 'Pattern', yarnLabels: ['Cream', 'Blue'], grid: [[0, 0, 1], [0, 0, 1]], startDirection: 'rtl' }
    const html = printableChart(p)
    expect(html).toContain('Row 1 (right to left)</strong>: 1 Blue [B], 2 Cream [A]')
    expect(html).toContain('Row 2 (left to right)</strong>: 2 Cream [A], 1 Blue [B]')
  })
  it('round trips all 64 colors and source/version identity', () => {
    const colors = Array.from({ length: 64 }, (_, i) => '#' + i.toString(16).padStart(6, '0'))
    const p = normalizeProject({ ...project(), colors, colorCount: 64, stitchesWide: 64, totalRows: 1, currentRow: 1,
      grid: [Array.from({ length: 64 }, (_, i) => i)], sourceDraftId: 'draft-1', versionOf: 'original' })
    expect(parseBackup(serializeBackup([p]))[0]).toEqual(p)
    const doc = new DOMParser().parseFromString(printableChart(p), 'text/html')
    const symbols = [...doc.querySelectorAll('td span')].map(cell => cell.textContent)
    expect(new Set(symbols).size).toBe(64)
    expect(symbols).toEqual(colors.map((_, i) => rankLabel(i)))
  })
  it('tiles large charts into readable indexed pages and includes every written row', () => {
    const p = { ...project(), stitchesWide: 120, totalRows: 81, grid: Array.from({ length: 81 }, () => Array(120).fill(0)) }
    const doc = new DOMParser().parseFromString(printableChart(p), 'text/html')
    const tiles = [...doc.querySelectorAll('.chart-tile')]
    expect(tiles).toHaveLength(12)
    for (const tile of tiles) {
      expect(tile.querySelectorAll('tbody tr').length).toBeLessThanOrEqual(40)
      expect(tile.querySelectorAll('tbody tr:first-child td').length).toBeLessThanOrEqual(30)
      expect(tile.querySelectorAll('thead th').length).toBe(32)
      expect(tile.querySelectorAll('tbody tr:first-child th').length).toBe(2)
    }
    expect(doc.querySelectorAll('td')).toHaveLength(120 * 81)
    expect(doc.querySelectorAll('.written-rows li')).toHaveLength(81)
  })
  it('migrates null yarn labels and preserves local draft associations', () => {
    const p = normalizeProject({ ...project(), yarnLabels: [null, 'Blue'], editorDraftId: 'draft-1', sourceDraftId: 'draft-1', startedAt: null })
    expect(p.yarnLabels).toEqual(['', 'Blue'])
    expect(parseBackup(serializeBackup([p]))[0].editorDraftId).toBe('draft-1')
  })
})
