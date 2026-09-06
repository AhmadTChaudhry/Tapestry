import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImageCanvas from './ImageCanvas'

const drawStitchPreview = vi.hoisted(() => vi.fn())

vi.mock('./geometry', async (importOriginal) => ({
  ...await importOriginal(),
  drawStitchPreview,
}))

const source = { width: 1200, height: 800 }
const context = { canvas: null }

const createDraft = (overrides = {}) => ({
  fitMode: 'crop',
  source,
  transform: { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipX: false, flipY: false },
  grid: { columns: 24, rows: 20, gauge: 'square' },
  ...overrides,
})

beforeEach(() => {
  drawStitchPreview.mockReset()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
})

it('offers keyboard positioning in crop mode', async () => {
  const user = userEvent.setup()
  const dispatch = vi.fn()
  const draft = createDraft()

  render(<ImageCanvas image={{ src: 'blob:preview' }} draft={draft} dispatch={dispatch} />)

  await user.click(screen.getByRole('application', { name: 'Position source image' }))
  await user.keyboard('{ArrowRight}')

  expect(dispatch).toHaveBeenCalledWith({ type: 'transform/patch', patch: { offsetX: 0.02, offsetY: 0 } })
})

it('converts a crop drag into bounded normalized offsets', () => {
  const dispatch = vi.fn()
  const draft = createDraft({ transform: { offsetX: 0.95, offsetY: 0, scale: 1, rotation: 0, flipX: false, flipY: false } })

  render(<ImageCanvas image={{ src: 'blob:preview' }} draft={draft} dispatch={dispatch} />)

  const canvas = screen.getByRole('application', { name: 'Position source image' })
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 100 })
  fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0 })
  fireEvent.pointerMove(canvas, { clientX: 20, clientY: 10 })

  expect(dispatch).toHaveBeenCalledWith({ type: 'transform/patch', patch: { offsetX: 1, offsetY: 0.2 } })
})

it('releases its pointer capture and stops dragging when a crop gesture is cancelled', () => {
  const dispatch = vi.fn()
  render(<ImageCanvas image={{ src: 'blob:preview' }} draft={createDraft()} dispatch={dispatch} />)

  const canvas = screen.getByRole('application', { name: 'Position source image' })
  canvas.setPointerCapture = vi.fn()
  canvas.releasePointerCapture = vi.fn()
  fireEvent.pointerDown(canvas, { pointerId: 7, clientX: 10, clientY: 10 })
  fireEvent.pointerCancel(canvas, { pointerId: 7 })
  fireEvent.pointerMove(canvas, { clientX: 30, clientY: 30 })

  expect(canvas.setPointerCapture).toHaveBeenCalledWith(7)
  expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7)
  expect(dispatch).not.toHaveBeenCalled()
})

it('does not offer image positioning in stretch mode', async () => {
  const user = userEvent.setup()
  const dispatch = vi.fn()
  const draft = createDraft({ fitMode: 'stretch' })

  render(<ImageCanvas image={{ src: 'blob:preview' }} draft={draft} dispatch={dispatch} />)

  await user.click(screen.getByRole('application', { name: 'Position source image' }))
  await user.keyboard('{ArrowRight}')

  expect(dispatch).not.toHaveBeenCalled()
})

it('paints the persisted draft geometry into a canvas source preview', () => {
  const draft = createDraft({ transform: { offsetX: 0.25, offsetY: -0.5, scale: 2, rotation: 0, flipX: false, flipY: false } })

  render(<ImageCanvas image={{ src: 'blob:preview' }} draft={draft} dispatch={vi.fn()} />)

  const preview = screen.getByRole('img', { name: 'Source preview' })
  fireEvent.load(screen.getByTestId('source-image'))

  expect(preview.tagName).toBe('CANVAS')
  expect(drawStitchPreview).toHaveBeenLastCalledWith(context, screen.getByTestId('source-image'), draft, expect.anything())
})

it.each([
  ['square', 36, 24, 36, 24, 1.5],
  ['true', 36, 24, 396, 216, 11 / 6],
])('sizes the %s gauge preview frame with its physical grid aspect', (gauge, columns, rows, width, height, aspect) => {
  const draft = createDraft({ grid: { columns, rows, gauge } })

  render(<ImageCanvas image={{ src: 'blob:preview' }} draft={draft} dispatch={vi.fn()} />)

  const frame = screen.getByRole('application', { name: 'Position source image' })
  const preview = screen.getByRole('img', { name: 'Source preview' })
  expect(frame.style.getPropertyValue('--frame-aspect')).toBe(String(aspect))
  expect(preview).toHaveAttribute('width', String(width))
  expect(preview).toHaveAttribute('height', String(height))
})

it.each([90, 270])('redraws a %i degree quarter-turn through reviewed canvas geometry without CSS transforms', (rotation) => {
  const draft = createDraft({
    grid: { columns: 36, rows: 24, gauge: 'true' },
    transform: { offsetX: 0, offsetY: 0, scale: 1, rotation, flipX: false, flipY: false },
  })

  render(<ImageCanvas image={{ src: 'blob:preview' }} draft={draft} dispatch={vi.fn()} />)

  const preview = screen.getByRole('img', { name: 'Source preview' })
  fireEvent.load(screen.getByTestId('source-image'))

  expect(preview.style.transform).toBe('')
  expect(drawStitchPreview).toHaveBeenLastCalledWith(context, screen.getByTestId('source-image'), draft, expect.anything())
})

it('redraws when persisted scale or offset changes', () => {
  const initialDraft = createDraft()
  const nextDraft = createDraft({ transform: { offsetX: 0.4, offsetY: -0.3, scale: 2, rotation: 0, flipX: false, flipY: false } })
  const view = render(<ImageCanvas image={{ src: 'blob:preview' }} draft={initialDraft} dispatch={vi.fn()} />)

  fireEvent.load(screen.getByTestId('source-image'))
  view.rerender(<ImageCanvas image={{ src: 'blob:preview' }} draft={nextDraft} dispatch={vi.fn()} />)
  fireEvent.load(screen.getByTestId('source-image'))

  expect(drawStitchPreview).toHaveBeenLastCalledWith(context, screen.getByTestId('source-image'), nextDraft, expect.anything())
})

it('reuses the same offscreen buffer canvas across redraws instead of allocating one per frame', () => {
  const initialDraft = createDraft()
  const nextDraft = createDraft({ transform: { offsetX: 0.4, offsetY: -0.3, scale: 2, rotation: 0, flipX: false, flipY: false } })
  const view = render(<ImageCanvas image={{ src: 'blob:preview' }} draft={initialDraft} dispatch={vi.fn()} />)

  fireEvent.load(screen.getByTestId('source-image'))
  const firstBuffer = drawStitchPreview.mock.calls.at(-1)[3]
  view.rerender(<ImageCanvas image={{ src: 'blob:preview' }} draft={nextDraft} dispatch={vi.fn()} />)
  fireEvent.load(screen.getByTestId('source-image'))
  const secondBuffer = drawStitchPreview.mock.calls.at(-1)[3]

  expect(firstBuffer).toBeInstanceOf(HTMLCanvasElement)
  expect(secondBuffer).toBe(firstBuffer)
})
