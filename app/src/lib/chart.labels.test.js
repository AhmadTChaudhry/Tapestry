import { describe, expect, it } from 'vitest'
import { rankLabel, yarnLabel } from './chart'

describe('yarn labels', () => {
  it('falls back to the pattern rank letter', () => {
    expect(rankLabel(0)).toBe('A')
    expect(yarnLabel(2, { colors: [] })).toBe('C')
    expect(yarnLabel(0, undefined)).toBe('A')
  })

  it('prefers the yarn name chosen in the editor', () => {
    const project = { yarnLabels: ['Rust aran', null, '   '] }

    expect(yarnLabel(0, project)).toBe('Rust aran')
    expect(yarnLabel(1, project)).toBe('B')
    expect(yarnLabel(2, project)).toBe('C')
  })
})
