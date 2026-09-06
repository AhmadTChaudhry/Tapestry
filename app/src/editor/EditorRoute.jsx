import { useEffect, useRef, useState } from 'react'
import { loadImageFile, quantizeToGrid, revokeImage } from '../lib/quantize'
import { useStore } from '../store'
import ChartEditor from './ChartEditor'
import { getAsset, getLatestDraft, saveAsset, saveDraft } from './draftRepository'
import { createDraft, createDraftImage, hydrateDraft, validateDraft } from './model'
import './editor.css'

const restoreError = 'Your saved draft could not be restored.'

export default function EditorRoute({ initialFile, onBack, onGenerated }) {
  const { projects, upsertProject } = useStore()
  const [draft, setDraft] = useState(null)
  const [image, setImage] = useState(null)
  const [error, setError] = useState(null)
  const [resumable, setResumable] = useState(null)
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

  // Only look for a draft worth offering — restoring one unasked would mean
  // "New chart from a photo" silently reopened the last chart instead of
  // letting the user choose a photo.
  const probeResumableDraft = async () => {
    try {
      const saved = await getLatestDraft()
      if (!mountedRef.current || !saved || !validateDraft(saved).ok) return

      const asset = await getAsset(saved.assetId)
      if (!mountedRef.current || !asset?.blob) return

      setResumable(saved)
    } catch {
      /* nothing offerable — the import screen stands on its own */
    }
  }

  const resumeDraft = async (saved) => {
    const request = ++requestRef.current
    let loaded = null
    let adopted = false
    if (mountedRef.current) setError(null)

    try {
      const asset = await getAsset(saved.assetId)
      if (!asset?.blob) throw new Error('missing asset')

      loaded = await loadImageFile(asset.blob)
      if (!currentRequest(request)) return revokeImage(loaded)

      setEditorImage(loaded)
      adopted = true
      setDraft(hydrateDraft(saved))
    } catch {
      if (loaded && !adopted) revokeImage(loaded)
      if (currentRequest(request)) {
        setResumable(null)
        setError(restoreError)
      }
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
      void probeResumableDraft()
    }
  }, [initialFile])

  const generate = (currentDraft) => {
    try {
      setError(null)
      if (!image) throw new Error('The source image is no longer available.')
      const colorCount = currentDraft.image?.colorCount ?? createDraftImage().colorCount
      const result = quantizeToGrid(image, currentDraft.grid.columns, colorCount, {
        rows: currentDraft.grid.rows,
        draft: currentDraft,
      })
      // Yarn choices override the sampled colour and its name; anything the
      // maker never renamed still shows what part it plays in the photo
      // (Background / Foreground / Accent) rather than a bare rank letter.
      const overrides = currentDraft.yarns || []
      const colors = result.colors.map((hex, i) => overrides[i]?.hex || hex)
      const yarnLabels = result.colors.map((_, i) => overrides[i]?.label || result.roles[i] || null)
      const existing = projects?.find((p) => p.editorDraftId === currentDraft.id)
      const project = {
        id: existing?.id || `p-${Date.now()}`,
        editorDraftId: currentDraft.id,
        name: currentDraft.name,
        stitchesWide: currentDraft.grid.columns,
        totalRows: currentDraft.grid.rows,
        colorCount: result.colors.length,
        workingMethod: currentDraft.grid.workingMethod,
        colors,
        yarnLabels,
        grid: result.grid,
        currentRow: 1,
      }
      upsertProject(project)
      onGenerated?.(project.id)
    } catch (reason) {
      setError(reason?.message || 'The chart could not be generated.')
    }
  }

  const leaveEditor = (_currentDraft) => {
    onBack?.()
  }

  const reportPersistError = () => {
    setError('Changes could not be saved. Please try again before leaving.')
  }

  if (draft && image) {
    return (
      <ChartEditor
        draft={draft}
        error={error}
        image={image}
        onBack={leaveEditor}
        onGenerate={generate}
        onPersistError={reportPersistError}
      />
    )
  }

  return (
    <main className="screen pad" style={{ paddingTop: 66 }}>
      <button className="editor-import-back" type="button" onClick={onBack} aria-label="Back">‹</button>
      <h1>Start a chart from a photo</h1>
      <p>Choose a clear image, then frame it and set the stitch grid.</p>
      {error && <p role="alert">{error}</p>}
      <button className="pill-primary" type="button" onClick={() => fileRef.current?.click()}>
        Choose a photo
      </button>
      {resumable && (
        <button className="mono press" type="button" onClick={() => void resumeDraft(resumable)}>
          {`Resume “${resumable.name}”`}
        </button>
      )}
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
