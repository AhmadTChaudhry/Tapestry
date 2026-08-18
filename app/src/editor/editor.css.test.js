import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const editorCss = readFileSync('src/editor/editor.css', 'utf8')
const indexCss = readFileSync('src/index.css', 'utf8')

it('keeps import controls and in-editor alerts within reliable touch and viewport rules', () => {
  expect(editorCss).toMatch(/\.editor-import-back\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s)
  expect(editorCss).toMatch(/\.editor-action-alert\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*2;/s)
  expect(indexCss).toMatch(/\.chart-photo-chooser\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s)
})

it('keeps the editor sheet scrollable and reduces fixed preview space at short heights', () => {
  expect(editorCss).toMatch(/\.editor-sheet\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/)
  expect(editorCss).toMatch(/@media\s*\(max-height:\s*640px\)\s*\{[\s\S]*?\.editor-preview\s*\{[\s\S]*?min-height:\s*120px;/)
})
