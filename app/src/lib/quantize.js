/**
 * Photo -> stitch grid, on device.
 *
 * 1. Draw the image into a canvas resampled to stitchesWide x rows. Because a
 *    tapestry stitch is wider than it is tall, the row count is derived from the
 *    image aspect corrected by GAUGE_RATIO, so the motif isn't squashed.
 * 2. Median-cut the resampled pixels into `colorCount` clusters.
 * 3. Rank clusters dark -> light. The grid stores ranks; the matching colours
 *    are returned alongside it — they are the photo's own colours, averaged
 *    over each cluster.
 */

// A tapestry stitch is ~11 wide : 9 tall. STITCH_ASPECT is height/width; every
// other ratio in the app derives from it, so gauge stays consistent between the
// row count computed here and the cells drawn on screen.
export const STITCH_ASPECT = 9 / 11
export const GAUGE_RATIO = 1 / STITCH_ASPECT

export function rowsForImage(imgW, imgH, stitchesWide) {
  const rows = Math.round(stitchesWide * (imgH / imgW) * GAUGE_RATIO)
  return Math.max(8, Math.min(400, rows))
}

function samplePixels(img, w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // Stretch the whole photo onto the grid rather than cropping to it. The grid
  // is deliberately taller in cells than the photo is in pixels (rows were
  // scaled by GAUGE_RATIO), and drawing each cell as a wide-and-short stitch
  // undoes that exactly — so the finished fabric carries the photo's true
  // proportions and nothing is cut off the sides.
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const px = new Array(w * h)
  for (let i = 0; i < w * h; i++) {
    px[i] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]
  }
  return px
}

function medianCut(pixels, count) {
  let boxes = [pixels]
  while (boxes.length < count) {
    // split the box with the largest spread along its widest channel
    let target = -1
    let bestSpread = -1
    let bestChannel = 0
    boxes.forEach((box, bi) => {
      if (box.length < 2) return
      for (let ch = 0; ch < 3; ch++) {
        let min = 255
        let max = 0
        for (const p of box) {
          if (p[ch] < min) min = p[ch]
          if (p[ch] > max) max = p[ch]
        }
        const spread = (max - min) * box.length ** 0.25
        if (spread > bestSpread) {
          bestSpread = spread
          target = bi
          bestChannel = ch
        }
      }
    })
    if (target < 0) break
    const box = boxes[target].slice().sort((a, b) => a[bestChannel] - b[bestChannel])
    const mid = Math.floor(box.length / 2)
    boxes.splice(target, 1, box.slice(0, mid), box.slice(mid))
  }
  return boxes
    .filter((b) => b.length)
    .map((box) => {
      const sum = [0, 0, 0]
      for (const p of box) {
        sum[0] += p[0]
        sum[1] += p[1]
        sum[2] += p[2]
      }
      return sum.map((s) => s / box.length)
    })
}

const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b

const toHex = ([r, g, b]) =>
  '#' +
  [r, g, b]
    .map((v) => Math.round(v).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()

/**
 * @returns {{ grid: number[][], rows: number, colors: string[] }} grid is
 * row-major, row 1 first (i.e. grid[0] is the bottom row of the work), values
 * are colour ranks, 0 = darkest. `colors` are those ranks' actual colours,
 * taken straight from the photo.
 */
export function quantizeToGrid(img, stitchesWide, colorCount) {
  const rows = rowsForImage(img.width, img.height, stitchesWide)
  const px = samplePixels(img, stitchesWide, rows)

  const centroids = medianCut(px, colorCount).sort((a, b) => lum(a) - lum(b))

  const nearest = (p) => {
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < centroids.length; i++) {
      const c = centroids[i]
      const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }

  // canvas row 0 is the top of the photo = the LAST row crocheted, so flip
  const grid = []
  for (let r = rows - 1; r >= 0; r--) {
    const row = new Array(stitchesWide)
    for (let x = 0; x < stitchesWide; x++) row[x] = nearest(px[r * stitchesWide + x])
    grid.push(row)
  }
  return { grid, rows, colors: centroids.map(toHex) }
}

/**
 * Decode a picked file. The object URL stays alive so the same image can be
 * shown as the preview background — the caller owns it and must revoke it
 * (see `revokeImage`) when it swaps the photo or leaves the screen.
 */
export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("That file couldn't be read as an image."))
    }
    img.src = url
  })
}

export function revokeImage(img) {
  if (img?.src?.startsWith('blob:')) URL.revokeObjectURL(img.src)
}
