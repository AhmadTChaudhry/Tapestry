import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const editorCss = readFileSync('src/editor/editor.css', 'utf8')
const indexCss = readFileSync('src/index.css', 'utf8')

it('keeps import controls and in-editor alerts within reliable touch and viewport rules', () => {
  expect(editorCss).toMatch(/\.editor-import-back\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s)
  expect(editorCss).toMatch(/\.editor-action-alert\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*2;/s)
  expect(indexCss).toMatch(/\.chart-photo-chooser\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s)
})
