import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import ImageCanvas from './ImageCanvas'

it('offers keyboard positioning in crop mode', async () => {
  const user = userEvent.setup()
  const dispatch = vi.fn()
  const draft = {
    fitMode: 'crop',
    transform: { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipX: false, flipY: false },
    grid: { columns: 24, rows: 20 },
  }

  render(<ImageCanvas image={{ src: 'blob:preview' }} draft={draft} dispatch={dispatch} />)

  await user.click(screen.getByRole('application', { name: 'Position source image' }))
  await user.keyboard('{ArrowRight}')

  expect(dispatch).toHaveBeenCalledWith({ type: 'transform/patch', patch: { offsetX: 0.02, offsetY: 0 } })
})

it('converts a crop drag into bounded normalized offsets', () => {
  const dispatch = vi.fn()
  const draft = {
    fitMode: 'crop',
    transform: { offsetX: 0.95, offsetY: 0, scale: 1, rotation: 0, flipX: false, flipY: false },
    grid: { columns: 24, rows: 20 },
  }

  render(<ImageCanvas image={{ src: 'blob:preview' }} draft={draft} dispatch={dispatch} />)

  const canvas = screen.getByRole('application', { name: 'Position source image' })
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 100 })
  fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0 })
  fireEvent.pointerMove(canvas, { clientX: 20, clientY: 10 })

  expect(dispatch).toHaveBeenCalledWith({ type: 'transform/patch', patch: { offsetX: 1, offsetY: 0.2 } })
})

it('does not offer image positioning in stretch mode', async () => {
  const user = userEvent.setup()
  const dispatch = vi.fn()
  const draft = {
    fitMode: 'stretch',
    transform: { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipX: false, flipY: false },
    grid: { columns: 24, rows: 20 },
  }

  render(<ImageCanvas image={{ src: 'blob:preview' }} draft={draft} dispatch={dispatch} />)

  await user.click(screen.getByRole('application', { name: 'Position source image' }))
  await user.keyboard('{ArrowRight}')

  expect(dispatch).not.toHaveBeenCalled()
})
