import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorProvider, useEditor } from './EditorContext'
import { createDraft } from './model'
import { saveDraft } from './draftRepository'

vi.mock('./draftRepository', () => ({ saveDraft: vi.fn(() => Promise.resolve()) }))

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

const createWrapper = () => {
  const draft = createDraft({ id: 'asset-1', width: 800, height: 600, mimeType: 'image/png' })
  return ({ children }) => <EditorProvider initialDraft={draft}>{children}</EditorProvider>
}

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('EditorProvider', () => {
  it('autosaves the newest revision after a debounce', async () => {
    vi.useFakeTimers()
    const wrapper = createWrapper()
    const { result } = renderHook(() => useEditor(), { wrapper })
    act(() => result.current.dispatch({ type: 'fit/set', value: 'stretch' }))
    await act(() => vi.advanceTimersByTimeAsync(350))
    expect(result.current.saveState).toBe('saved')
    expect(saveDraft).toHaveBeenCalledTimes(1)
    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({ fitMode: 'stretch' }))
  })

  it('keeps saving when an older save succeeds after a newer revision', async () => {
    vi.useFakeTimers()
    const olderSave = deferred()
    const newerSave = deferred()
    vi.mocked(saveDraft)
      .mockImplementationOnce(() => olderSave.promise)
      .mockImplementationOnce(() => newerSave.promise)
    const { result } = renderHook(() => useEditor(), { wrapper: createWrapper() })

    await act(() => vi.advanceTimersByTimeAsync(300))
    act(() => result.current.dispatch({ type: 'fit/set', value: 'stretch' }))
    await act(async () => {
      olderSave.resolve()
      await Promise.resolve()
    })

    expect(result.current.saveState).toBe('saving')
    await act(() => vi.advanceTimersByTimeAsync(300))
    expect(saveDraft).toHaveBeenLastCalledWith(expect.objectContaining({ fitMode: 'stretch' }))
    await act(async () => {
      newerSave.resolve()
      await Promise.resolve()
    })
    expect(result.current.saveState).toBe('saved')
  })

  it('keeps saving when an older save fails after a newer revision', async () => {
    vi.useFakeTimers()
    const olderSave = deferred()
    const newerSave = deferred()
    vi.mocked(saveDraft)
      .mockImplementationOnce(() => olderSave.promise)
      .mockImplementationOnce(() => newerSave.promise)
    const { result } = renderHook(() => useEditor(), { wrapper: createWrapper() })

    await act(() => vi.advanceTimersByTimeAsync(300))
    act(() => result.current.dispatch({ type: 'fit/set', value: 'stretch' }))
    await act(async () => {
      olderSave.reject(new Error('disk full'))
      await Promise.resolve()
    })

    expect(result.current.saveState).toBe('saving')
    await act(() => vi.advanceTimersByTimeAsync(300))
    await act(async () => {
      newerSave.resolve()
      await Promise.resolve()
    })
    expect(result.current.saveState).toBe('saved')
  })

  it('reports an error when the newest save fails', async () => {
    vi.useFakeTimers()
    vi.mocked(saveDraft).mockRejectedValueOnce(new Error('disk full'))
    const { result } = renderHook(() => useEditor(), { wrapper: createWrapper() })

    await act(() => vi.advanceTimersByTimeAsync(300))

    expect(result.current.saveState).toBe('error')
  })

  it('cancels a pending save when unmounted', async () => {
    vi.useFakeTimers()
    const { unmount } = renderHook(() => useEditor(), { wrapper: createWrapper() })

    unmount()
    await act(() => vi.advanceTimersByTimeAsync(350))

    expect(saveDraft).not.toHaveBeenCalled()
  })
})
