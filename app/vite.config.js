import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'

function offlineBuild() {
  let config
  return {
    name: 'crochet-offline',
    apply: 'build',
    configResolved(value) { config = value },
    generateBundle: { order: 'post', handler(_, bundle) {
      const assets = Object.keys(bundle)
      const hash = createHash('sha256')
      for (const item of Object.values(bundle)) hash.update(item.code ?? item.source)
      if (config.publicDir) {
        const walk = dir => {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const path = resolve(dir, entry.name)
            if (entry.isDirectory()) walk(path)
            else { assets.push(relative(config.publicDir, path).split('\\').join('/')); hash.update(readFileSync(path)) }
          }
        }
        walk(config.publicDir)
      }
      const version = hash.digest('hex').slice(0, 16)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const ROOT = new URL('./', self.location.href);
const PREFIX = 'crochet-offline-' + ROOT.pathname + '-';
const CACHE = PREFIX + '${version}';
const ASSETS = ${JSON.stringify(assets)}.map(path => new URL(path, ROOT).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  // Deliberately no skipWaiting: an open pattern stays on its current build.
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(new URL('index.html', ROOT).href)).then(hit => hit || fetch(event.request)));
  } else if (ASSETS.includes(url.href)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request)).then(hit => hit || fetch(event.request)));
  }
});
` })
    } },
  }
}

export default defineConfig({
  plugins: [react(), offlineBuild()],
  server: { port: 5183, host: true },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    restoreMocks: true,
  },
})
