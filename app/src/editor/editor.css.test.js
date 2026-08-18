import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const editorCss = readFileSync(`${process.cwd()}/src/editor/editor.css`, 'utf8')

describe('editor compact viewport CSS', () => {
  it('keeps the sheet scrollable and reduces fixed preview space at short heights', () => {
    expect(editorCss).toMatch(/\.editor-sheet\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/)
    expect(editorCss).toMatch(/@media\s*\(max-height:\s*640px\)\s*\{[\s\S]*?\.editor-preview\s*\{[\s\S]*?min-height:\s*120px;/)
  })
})
