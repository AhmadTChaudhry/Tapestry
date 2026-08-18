import { useEffect, useRef, useState } from 'react'
import { loadImageFile, quantizeToGrid, revokeImage } from '../lib/quantize'
import { useStore } from '../store'
import ChartEditor from './ChartEditor'
import { getAsset, getLatestDraft, saveAsset, saveDraft } from './draftRepository'
import { createDraft, validateDraft } from './model'

const restoreError = 'Your saved draft could not be restored.'

export default function EditorRoute({ initialFile, onBack, onGenerated }) {
  const { addProject } = useStore()
  const [draft, setDraft] = useState(null)
  const [image, setImage] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)
  const imageRef = useRef(null)
  const requestRef = useRef(0)
  const mountedRef = useRef(true)
  const handledInitialFile = useRef(null)
  const startedRecovery = useRef(false)

  const currentRequest = (request) => mountedRef.current && request === requestRef.current

  const setEditorImage = (nextImage) => {
    if (imageRef.current && imageRef.current !== nextImage) revokeImage(imageRef.current)
    imageRef.current = nextImage
    setImage(nextImage)
  }

  const openFile = async (file) => {
    const request = ++requestRef.current
    let loaded = null
    let adopted = false
    if (mountedRef.current) setError(null)

    try {
      loaded = await loadImageFile(file)
      if (!currentRequest(request)) return revokeImage(loaded)

      const asset = await saveAsset(file, { width: loaded.width, height: loaded.height })
      if (!currentRequest(request)) return revokeImage(loaded)

      const base = file.name?.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'New chart'
      const next = createDraft(asset, base.charAt(0).toUpperCase() + base.slice(1))
      await saveDraft(next)
      if (!currentRequest(request)) return revokeImage(loaded)

      setEditorImage(loaded)
      adopted = true
      setDraft(next)
    } catch (reason) {
      if (loaded && !adopted) revokeImage(loaded)
      if (currentRequest(request)) setError(reason?.message || 'That image could not be opened.')
    }
  }

  const recoverLatestDraft = async () => {
    const request = ++requestRef.current
    let loaded = null
    let adopted = false

    try {
      const saved = await getLatestDraft()
      if (!currentRequest(request) || !saved) return
      if (!validateDraft(saved).ok) throw new Error('invalid draft')

      const asset = await getAsset(saved.assetId)
      if (!asset?.blob) throw new Error('missing asset')

      loaded = await loadImageFile(asset.blob)
      if (!currentRequest(request)) return revokeImage(loaded)

      setEditorImage(loaded)
      adopted = true
      setDraft(saved)
    } catch {
      if (loaded && !adopted) revokeImage(loaded)
      if (currentRequest(request)) setError(restoreError)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (imageRef.current) revokeImage(imageRef.current)
      imageRef.current = null
    }
  }, [])

  useEffect(() => {
    if (initialFile) {
      if (handledInitialFile.current !== initialFile) {
        handledInitialFile.current = initialFile
        void openFile(initialFile)
      }
      return
    }

    if (!startedRecovery.current) {
      startedRecovery.current = true
      void recoverLatestDraft()
    }
  }, [initialFile])

  const generate = (currentDraft) => {
    try {
      if (!image) throw new Error('The source image is no longer available.')
      const result = quantizeToGrid(image, currentDraft.grid.columns, 4, {
        rows: currentDraft.grid.rows,
        draft: currentDraft,
      })
      const project = {
        id: `p-${Date.now()}`,
        editorDraftId: currentDraft.id,
        name: currentDraft.name,
        stitchesWide: currentDraft.grid.columns,
        totalRows: currentDraft.grid.rows,
        colorCount: result.colors.length,
        workingMethod: currentDraft.grid.workingMethod,
        colors: result.colors,
        grid: result.grid,
        currentRow: 1,
      }
      addProject(project)
      onGenerated?.(project.id)
    } catch (reason) {
      setError(reason?.message || 'The chart could not be generated.')
    }
  }

  if (draft && image) {
    return (
      <>
        <ChartEditor draft={draft} image={image} onBack={onBack} onGenerate={generate} />
        {error && <p role="alert">{error}</p>}
      </>
    )
  }

  return (
    <main className="screen pad" style={{ paddingTop: 66 }}>
      <button type="button" onClick={onBack} aria-label="Back">‹</button>
      <h1>Start a chart from a photo</h1>
      <p>Choose a clear image, then frame it and set the stitch grid.</p>
      {error && <p role="alert">{error}</p>}
      <button className="pill-primary" type="button" onClick={() => fileRef.current?.click()}>
        Choose a photo
      </button>
      <input
        ref={fileRef}
        hidden
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void openFile(file)
        }}
      />
    </main>
  )
}
