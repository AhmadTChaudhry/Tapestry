import { useEffect, useRef, useState } from 'react'
import { loadImageFile, revokeImage } from '../lib/quantize'
import { useStore } from '../store'
import ChartEditor from './ChartEditor'
import { getAsset, getDraft, getLatestDraft, saveAsset, saveDraft } from './draftRepository'
import { createDraft, hydrateDraft, validateDraft } from './model'
import './editor.css'
import { buildDraftChart } from '../lib/conversion'
import { hasStarted } from '../lib/chart'

const restoreError = 'Your saved draft could not be restored.'

export default function EditorRoute({ initialFile, initialDraftId, onBack, onGenerated }) {
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
      if (file.size > 30 * 1024 * 1024) throw new Error('Choose an image smaller than 30 MB. A resized copy is enough for a stitch chart.')
      loaded = await loadImageFile(file)
      if (loaded.width * loaded.height > 40_000_000) throw new Error('This photo is larger than 40 megapixels. Resize a copy before importing.')
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
    if (initialDraftId && !startedRecovery.current) {
      startedRecovery.current = true
      getDraft(initialDraftId).then(saved => {
        if (!mountedRef.current) return
        if (!saved || !validateDraft(saved).ok) { setError(restoreError); return }
        void resumeDraft(saved)
      }).catch(() => { if (mountedRef.current) setError(restoreError) })
      return
    }
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
  }, [initialFile, initialDraftId])

  const generate = (currentDraft) => {
    try {
      setError(null)
      if (!image) throw new Error('The source image is no longer available.')
      const result = buildDraftChart(image, currentDraft)
      // Preview and saved pattern consume the identical conversion result.
      const colors = result.colors
      const yarnLabels = result.yarnLabels
      const existing = projects?.find((p) => p.editorDraftId === currentDraft.id)
      const started = existing && hasStarted(existing)
      const project = {
        id: started ? `p-${crypto.randomUUID()}` : existing?.id || `p-${crypto.randomUUID()}`,
        editorDraftId: started ? undefined : currentDraft.id,
        sourceDraftId: currentDraft.id,
        versionOf: started ? existing.id : undefined,
        name: started ? `${currentDraft.name} · revised` : currentDraft.name,
        stitchesWide: currentDraft.grid.columns,
        totalRows: currentDraft.grid.rows,
        colorCount: result.colors.length,
        workingMethod: currentDraft.grid.workingMethod,
        gauge: currentDraft.grid.gauge,
        swatch: currentDraft.grid.swatch || null,
        handedness: currentDraft.grid.handedness || 'right',
        startDirection: currentDraft.grid.startDirection || (currentDraft.grid.handedness === 'left' ? 'ltr' : 'rtl'),
        colors,
        yarnLabels,
        grid: result.grid,
        currentRow: 1,
        completedRows: 0,
        currentRun: 0,
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
    <main className="screen photo-start">
      <button className="editor-import-back" type="button" onClick={onBack} aria-label="Back">‹</button>
      <div className="photo-start-art" aria-hidden="true"><svg viewBox="0 0 160 160"><rect x="19" y="24" width="110" height="110" rx="20" fill="var(--sunken)" transform="rotate(-8 74 79)" /><rect x="32" y="16" width="110" height="120" rx="18" fill="var(--surface)" stroke="var(--border)" /><path d="M46 107L72 70L90 90L111 62L129 107Z" fill="#B8CBC1" /><circle cx="64" cy="45" r="11" fill="#F2B89F" /><path d="M100 31V120M75 31V120M50 31V120M43 55H129M43 80H129M43 105H129" stroke="var(--accent)" opacity=".14" /></svg></div>
      <h1>Start a chart from a photo</h1>
      <p>Choose a clear image, then frame it and set the stitch grid.</p>
      {error && <p role="alert">{error}</p>}
      <button className="pill-primary" type="button" onClick={() => fileRef.current?.click()}>
        Choose a photo
      </button>
      {resumable && (
        <button className="photo-resume press" type="button" onClick={() => void resumeDraft(resumable)}>
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
