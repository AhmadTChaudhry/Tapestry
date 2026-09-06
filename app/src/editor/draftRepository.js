import { validateDraft } from './model'

const DB_NAME = 'tapestry-crochet-editor'
const DB_VERSION = 1
let dbPromise

function openDatabase() {
  if (dbPromise) return dbPromise

  const pending = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('drafts')) {
        const drafts = db.createObjectStore('drafts', { keyPath: 'id' })
        drafts.createIndex('updatedAt', 'updatedAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'))
    request.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })

  // Never cache a failure: a blocked or transiently refused open would
  // otherwise make every later save reject for the rest of the session.
  const attempt = pending.catch((error) => {
    if (dbPromise === attempt) dbPromise = null
    throw error
  })
  dbPromise = attempt

  return attempt
}

async function transact(storeName, mode, operation) {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    let result

    transaction.oncomplete = () => resolve(result)
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'))

    try {
      const request = operation(transaction.objectStore(storeName), transaction)
      request.onsuccess = () => {
        result = request.result
      }
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed'))
    } catch (error) {
      transaction.abort()
      reject(error)
    }
  })
}

export async function saveAsset(blob, dimensions) {
  const asset = {
    id: `asset-${crypto.randomUUID()}`,
    blob,
    width: dimensions.width,
    height: dimensions.height,
    mimeType: blob.type || 'application/octet-stream',
  }

  await transact('assets', 'readwrite', (store) => store.put(asset))
  return asset
}

export const getAsset = (id) => transact('assets', 'readonly', (store) => store.get(id))

export async function saveDraft(draft) {
  const checked = validateDraft(draft)
  if (!checked.ok) throw new Error(checked.reason)

  await transact('drafts', 'readwrite', (store) => store.put(draft))
  return draft
}

export const getDraft = (id) => transact('drafts', 'readonly', (store) => store.get(id))
export const deleteDraft = (id) => transact('drafts', 'readwrite', (store) => store.delete(id))

export async function getLatestDraft() {
  const drafts = await transact('drafts', 'readonly', (store) => store.getAll())
  const updatedAt = (draft) => {
    const timestamp = Date.parse(draft?.updatedAt)
    return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY
  }
  return drafts.sort((a, b) => updatedAt(b) - updatedAt(a))[0] || null
}

export async function __resetDatabase() {
  if (dbPromise) {
    const db = await dbPromise
    db.close()
  }
  dbPromise = null

  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = resolve
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('database deletion blocked'))
  })
}
