import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Home from './Home'

const project = (overrides = {}) => ({
  id: 'p-1',
  name: 'Fox & Ferns',
  stitchesWide: 4,
  totalRows: 4,
  currentRow: 1,
  colorCount: 1,
  colors: ['#B4553C'],
  grid: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  ...overrides,
})

const store = vi.hoisted(() => ({ projects: [] }))
vi.mock('../store', () => ({ useStore: () => store }))

describe('Home', () => {
  it('keeps archived charts out of Continue and uses completed rows for progress', () => {
    store.projects = [project({ id: 'archive', name: 'Archived flowers', archived: true }), project({ completedRows: [1], currentRow: 3 })]
    render(<Home onOpen={vi.fn()} onNew={vi.fn()} onImportFile={vi.fn()} onSeeAll={vi.fn()} />)
    expect(screen.queryByText('Archived flowers')).not.toBeInTheDocument()
    expect(screen.getByText('Row 3 of 4')).toBeVisible()
    expect(screen.getByText('25% complete')).toBeVisible()
  })

  it('passes the chosen photo to the import callback', async () => {
    store.projects = []
    const user = userEvent.setup()
    const onImportFile = vi.fn()
    render(<Home onOpen={vi.fn()} onNew={vi.fn()} onImportFile={onImportFile} onSeeAll={vi.fn()} />)
    const file = new File(['photo'], 'flowers.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Choose a photo'), file)
    expect(onImportFile).toHaveBeenCalledWith(file)
  })
  it('shows an empty state and the import affordances when nothing is in progress', () => {
    store.projects = []
    render(<Home onOpen={vi.fn()} onNew={vi.fn()} onImportFile={vi.fn()} onSeeAll={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Stitches' })).toBeVisible()
    expect(screen.getByText('Tapestry')).toBeVisible()
    expect(screen.getByRole('img', { name: 'A playful stitch sampler' })).toBeVisible()
    expect(screen.getByText('Nothing in progress yet')).toBeVisible()
    expect(screen.getByText('Your next project starts here')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Choose an existing photo' })).toBeVisible()
  })

  it('offers to continue the most recent chart and opens it on click', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    store.projects = [project({ id: 'p-1', name: 'Fox & Ferns', currentRow: 2, totalRows: 4 })]

    render(<Home onOpen={onOpen} onNew={vi.fn()} onImportFile={vi.fn()} onSeeAll={vi.fn()} />)

    expect(screen.getByText('1 project in your library')).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Fox & Ferns/ }))

    expect(onOpen).toHaveBeenCalledWith('p-1')
  })

  it('lists the remaining charts and opens the one that was tapped', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    store.projects = [
      project({ id: 'p-1', name: 'Fox & Ferns' }),
      project({ id: 'p-2', name: 'Zigzag tote' }),
      project({ id: 'p-3', name: 'Mountain pillow' }),
    ]

    render(<Home onOpen={onOpen} onNew={vi.fn()} onImportFile={vi.fn()} onSeeAll={vi.fn()} />)

    const section = screen.getByText('Other charts').closest('section')
    await user.click(within(section).getByRole('button', { name: /Zigzag tote/ }))

    expect(onOpen).toHaveBeenCalledWith('p-2')
  })

  it('does not offer an "other charts" row with only one project', () => {
    store.projects = [project()]
    render(<Home onOpen={vi.fn()} onNew={vi.fn()} onImportFile={vi.fn()} onSeeAll={vi.fn()} />)

    expect(screen.queryByText('Other charts')).not.toBeInTheDocument()
  })

  it('routes the quick action to onNew and "see all" to onSeeAll', async () => {
    const user = userEvent.setup()
    const onNew = vi.fn()
    const onSeeAll = vi.fn()
    store.projects = [project({ id: 'p-1' }), project({ id: 'p-2', name: 'Zigzag tote' })]

    render(<Home onOpen={vi.fn()} onNew={onNew} onImportFile={vi.fn()} onSeeAll={onSeeAll} />)

    await user.click(screen.getByRole('button', { name: 'New chart from a photo' }))
    await user.click(screen.getByRole('button', { name: 'See all' }))

    expect(onNew).toHaveBeenCalledOnce()
    expect(onSeeAll).toHaveBeenCalledOnce()
  })
})
