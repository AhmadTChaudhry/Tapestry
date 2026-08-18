import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { saveDraft } from './draftRepository'
import { editorReducer } from './model'

const EditorContext = createContext(null)

export function EditorProvider({ initialDraft, children }) {
  const [draft, dispatch] = useReducer(editorReducer, initialDraft)
  const [saveState, setSaveState] = useState('idle')
  const saveRevision = useRef(0)
  const saveTimer = useRef(null)
  const saveChain = useRef(Promise.resolve())

  const queueSave = useCallback((nextDraft) => {
    const save = saveChain.current.then(() => saveDraft(nextDraft))
    saveChain.current = save.catch(() => {})
    return save
  }, [])

  useEffect(() => {
    let cancelled = false
    const revision = ++saveRevision.current

    setSaveState('saving')
    const timer = setTimeout(() => {
      if (saveTimer.current === timer) saveTimer.current = null
      queueSave(draft)
        .then(() => {
          if (!cancelled && revision === saveRevision.current) setSaveState('saved')
        })
        .catch(() => {
          if (!cancelled && revision === saveRevision.current) setSaveState('error')
        })
    }, 300)
    saveTimer.current = timer

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (saveTimer.current === timer) saveTimer.current = null
    }
  }, [draft, queueSave])

  const flushDraft = useCallback(() => {
    const revision = ++saveRevision.current
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    setSaveState('saving')
    return queueSave(draft)
      .then(() => {
        if (revision === saveRevision.current) setSaveState('saved')
        return draft
      })
      .catch((error) => {
        if (revision === saveRevision.current) setSaveState('error')
        throw error
      })
  }, [draft, queueSave])

  const value = useMemo(() => ({ draft, dispatch, saveState, flushDraft }), [draft, saveState, flushDraft])
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

export function useEditor() {
  const value = useContext(EditorContext)
  if (!value) throw new Error('useEditor must be used inside EditorProvider')
  return value
}
