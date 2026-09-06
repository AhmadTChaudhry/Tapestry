import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const manifest = document.createElement('link')
  manifest.rel = 'manifest'
  manifest.href = `${import.meta.env.BASE_URL}manifest.webmanifest`
  document.head.append(manifest)
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(registration => {
      const announce = message => {
        const notice = document.createElement('aside')
        notice.className = 'persistence-warning offline-notice'
        notice.setAttribute('role', 'status')
        notice.textContent = message
        const close = document.createElement('button')
        close.textContent = 'Dismiss'
        close.onclick = () => notice.remove()
        notice.append(close)
        document.body.append(notice)
      }
      if (registration.waiting) announce('An update is ready. Close all app tabs and reopen when you are ready to update.')
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') announce(navigator.serviceWorker.controller
            ? 'An update is ready. Close all app tabs and reopen when you are ready to update.'
            : 'The app is ready for offline use. Your projects are saved on this device; download backups regularly.')
        })
      })
    }).catch(() => {
      // Offline setup is optional; normal online operation remains available.
      const notice = document.createElement('aside')
      notice.className = 'persistence-warning offline-notice'
      notice.setAttribute('role', 'status')
      notice.textContent = 'Offline setup failed. Reopen while online to try again.'
      const close = document.createElement('button')
      close.textContent = 'Dismiss'
      close.onclick = () => notice.remove()
      notice.append(close)
      document.body.append(notice)
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
