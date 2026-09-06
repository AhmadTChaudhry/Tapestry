import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MiniChart from './MiniChart'

const project = {
  currentRow: 1,
  totalRows: 59,
  stitchesWide: 24,
  grid: Array.from({ length: 59 }, () => Array(24).fill(0)),
  colors: ['#000000'],
}

describe('MiniChart', () => {
  it('fits the preview within the requested size while preserving chart aspect ratio', () => {
    const { container } = render(<MiniChart project={project} size={196} />)
    const preview = container.firstElementChild
    const chart = preview.firstElementChild

    expect(preview).toHaveStyle({ width: '196px', height: '196px' })
    expect(chart).toHaveStyle({ width: `${196 * 24 / 59}px`, height: '196px' })
    expect(chart).toHaveStyle({ gridTemplateRows: 'repeat(39, 1fr)' })
  })
})
