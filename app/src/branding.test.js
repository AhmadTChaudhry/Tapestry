import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const html = readFileSync('index.html', 'utf8')
const manifest = readFileSync('public/manifest.webmanifest', 'utf8')

it('uses Stitches branding in browser and install metadata', () => {
  expect(html).toMatch(/<title>Stitches<\/title>/)
  expect(html).toMatch(/apple-mobile-web-app-title" content="Stitches"/)
  expect(html).toMatch(/apple-touch-icon[^>]+stitches-icon\.svg/)
  expect(manifest).toMatch(/"name": "Stitches — Tapestry Crochet Charts"/)
  expect(manifest).toMatch(/"short_name": "Stitches"/)
  expect(manifest).toMatch(/"src": "stitches-icon\.svg"/)
})
