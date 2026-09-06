// Run after `npm run build`: node verify-offline.mjs
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('./dist/sw.js', import.meta.url), 'utf8')
const handlers = {}
let precached = []
const root = 'https://crochet.test/patterns/'
const context = {
  URL,
  self: { location: { href: root + 'sw.js' }, addEventListener: (name, handler) => { handlers[name] = handler } },
  caches: { open: async () => ({ addAll: async urls => { precached = urls }, match: async url => precached.includes(url) ? 'cached-shell' : undefined }) },
  fetch: () => { throw new Error('Network is offline') },
}
vm.runInNewContext(source, context)
let pending
handlers.install({ waitUntil: promise => { pending = promise } })
await pending
assert(precached.includes(root + 'index.html'), 'Offline cache must include index.html')
for (const url of precached) {
  assert(url.startsWith(root), 'Only this app is precached')
  assert(existsSync(new URL('./dist/' + url.slice(root.length), import.meta.url)), `Missing asset ${url}`)
}
assert(precached.some(url => /assets\/.*\.js$/.test(url)))
assert(precached.some(url => /assets\/.*\.css$/.test(url)))
let response
handlers.fetch({ request: { url: root + 'chart/123', method: 'GET', mode: 'navigate' }, respondWith: p => { response = p } })
assert.equal(await response, 'cached-shell', 'Offline navigation serves precached shell')
for (const url of ['https://other.test/image.png', 'https://crochet.test/unrelated']) {
  handlers.fetch({ request: { url, method: 'GET', mode: 'navigate' }, respondWith: () => assert.fail('Intercepted out-of-scope URL') })
}
assert(!/self\.skipWaiting\(|clients\.claim\(/.test(source), 'Updates must wait for app tabs to close')
console.log(`Offline verification passed: ${precached.length} assets, offline shell, origin/scope isolation, safe updates.`)
