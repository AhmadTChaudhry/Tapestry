import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { saveDraft } from './draftRepository'
import { editorReducer } from './model'

const EditorContext = createContext(null)

export function EditorProvider({ initialDraft, children }) {
  const [draft, dispatch] = useReducer(editorReducer, initialDraft)
  const [saveState, setSaveState] = useState('idle')
  const saveRevision = useRef(0)

  useEffect(() => {
    let cancelled = false
    const revision = ++saveRevision.current

    setSaveState('saving')
    const timer = setTimeout(() => {
      saveDraft(draft)
        .then(() => {
          if (!cancelled && revision === saveRevision.current) setSaveState('saved')
        })
        .catch(() => {
          if (!cancelled && revision === saveRevision.current) setSaveState('error')
        })
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [draft])

  const value = useMemo(() => ({ draft, dispatch, saveState }), [draft, saveState])
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

export function useEditor() {
  const value = useContext(EditorContext)
  if (!value) throw new Error('useEditor must be used inside EditorProvider')
  return value
}
