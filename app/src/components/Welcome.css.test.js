import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const welcomeCss = readFileSync('src/components/Welcome.css', 'utf8')

it('gives the splash hero a subtle floating loop with reduced-motion support', () => {
  expect(welcomeCss).toMatch(/\.welcome-art\s*\{[^}]*animation:\s*hero-float\s+/s)
  expect(welcomeCss).toMatch(/@keyframes\s+hero-float\s*\{/)
  expect(welcomeCss).toMatch(/transform:\s*translateY\(0\)/)
  expect(welcomeCss).toMatch(/transform:\s*translateY\(-10px\)/)
  expect(welcomeCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  expect(welcomeCss).toMatch(/\.welcome-art,\s*\.stitch-tulip\s*\{\s*animation:\s*none;/)
})
