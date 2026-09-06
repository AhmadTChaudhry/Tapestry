import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import YarnStage from './YarnStage'
import { quantizeToGrid } from '../../lib/quantize'
import { createDraftImage } from '../model'

vi.mock('../../lib/quantize', async importOriginal => ({ ...await importOriginal(), quantizeToGrid: vi.fn() }))

const draft = (overrides = {}) => ({
  fitMode: 'crop',
  grid: { columns: 24, rows: 29, gauge: 'true', workingMethod: 'round', dimensionsLocked: true },
  transform: { offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipX: false, flipY: false },
  image: createDraftImage(),
  yarns: [],
  ...overrides,
})

describe('YarnStage', () => {
  beforeEach(() => {
    quantizeToGrid.mockReturnValue({ grid: [[0]], colors: ['#1E1B18', '#B4553C', '#E7E1D7', '#FFFFFF'], roles: ['Background', 'Foreground', 'Accent 1', 'Accent 2'] })
  })

  it('lists the palette the chart will actually be worked in', () => {
    render(<YarnStage draft={draft()} dispatch={vi.fn()} image={{ src: 'blob:preview' }} />)

    expect(quantizeToGrid).toHaveBeenCalledWith({ src: 'blob:preview' }, 24, 4, expect.objectContaining({ rows: 29 }))
    expect(screen.getAllByRole('textbox')).toHaveLength(4)
    expect(screen.getByDisplayValue('A')).toBeVisible()
    expect(screen.getByLabelText('Colour for yarn B')).toHaveValue('#b4553c')
  })

  it('records a yarn name against its colour rank', () => {
    const dispatch = vi.fn()
    render(<YarnStage draft={draft()} dispatch={dispatch} image={{ src: 'blob:preview' }} />)

    fireEvent.change(screen.getByLabelText('Name for yarn B'), { target: { value: 'Rust aran' } })

    expect(dispatch).toHaveBeenCalledWith({ type: 'yarn/patch', index: 1, patch: { label: 'Rust aran', sourceHex: '#B4553C' } })
  })

  it('overrides a swatch and offers the photo colour back', async () => {
    const user = userEvent.setup()
    const dispatch = vi.fn()
    const overridden = draft({ yarns: [null, { hex: '#123456' }] })
    render(<YarnStage draft={overridden} dispatch={dispatch} image={{ src: 'blob:preview' }} />)

    expect(screen.getByLabelText('Colour for yarn B')).toHaveValue('#123456')
    await user.click(screen.getByRole('button', { name: 'Use the photo colour for yarn B' }))

    expect(dispatch).toHaveBeenCalledWith({ type: 'yarn/patch', index: 1, patch: { hex: null, sourceHex: '#B4553C' } })
  })

  it('stays usable when the photo cannot be sampled yet', () => {
    quantizeToGrid.mockImplementation(() => { throw new Error('no canvas') })

    render(<YarnStage draft={draft()} dispatch={vi.fn()} image={{ src: 'blob:preview' }} />)

    expect(screen.getByText(/palette appears once/i)).toBeVisible()
  })

  it('clears every yarn choice at once', async () => {
    const user = userEvent.setup()
    const dispatch = vi.fn()
    render(<YarnStage draft={draft({ yarns: [{ label: 'Rust' }] })} dispatch={dispatch} image={{ src: 'blob:x' }} />)

    await user.click(screen.getByRole('button', { name: 'Clear yarn choices' }))

    expect(dispatch).toHaveBeenCalledWith({ type: 'yarn/reset' })
  })
})
