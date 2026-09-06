import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const config = JSON.parse(readFileSync('../vercel.json', 'utf8'))

it('builds the nested Vite app and serves its SPA routes', () => {
  expect(config.installCommand).toBe('npm --prefix app ci')
  expect(config.buildCommand).toBe('npm --prefix app run build')
  expect(config.outputDirectory).toBe('app/dist')
  expect(config.rewrites).toEqual([
    { source: '/(.*)', destination: '/index.html' },
  ])
})
