/**
 * Photo -> stitch grid, on device.
 *
 * 1. Draw the image into a canvas resampled to stitchesWide x rows. Because a
 *    tapestry stitch is wider than it is tall, the row count is derived from the
 *    image aspect corrected by GAUGE_RATIO, so the motif isn't squashed.
 * 2. Cluster sampled pixels perceptually, preserving distinctive accents.
 * 3. Rank clusters dark -> light. The grid stores ranks; the matching colours
 *    are returned alongside it — they are the photo's own colours, averaged
 *    over each cluster.
 */

import { drawDraftToCanvas } from '../editor/geometry'

// Sampling happens on a transparent canvas, so a photo with an alpha channel
// would otherwise hand pure black to the quantizer and burn a phantom yarn
// colour into the palette. Flattening onto white is what the eye expects.
const MATTE = 255
const clamp8 = (value) => Math.max(0, Math.min(255, value))
// Luminance weights and the operation order match the CSS filter chain the
// preview canvas uses, so what the editor shows is what gets charted.
const LUMA = [0.2126, 0.7152, 0.0722]

export function applyImageAdjustments([r, g, b], image) {
  const { brightness = 1, contrast = 1, saturation = 1 } = image || {}
  const channels = [r, g, b].map((value) => {
    const brightened = value * brightness
    return (brightened - 127.5) * contrast + 127.5
  })
  const luma = channels[0] * LUMA[0] + channels[1] * LUMA[1] + channels[2] * LUMA[2]
  return channels.map((value) => clamp8(Math.round(luma + (value - luma) * saturation)))
}

// A tapestry stitch is ~11 wide : 9 tall. STITCH_ASPECT is height/width; every
// other ratio in the app derives from it, so gauge stays consistent between the
// row count computed here and the cells drawn on screen.
export const STITCH_ASPECT = 9 / 11
export const GAUGE_RATIO = 1 / STITCH_ASPECT

export function rowsForImage(imgW, imgH, stitchesWide) {
  const rows = Math.round(stitchesWide * (imgH / imgW) * GAUGE_RATIO)
  return Math.max(8, Math.min(400, rows))
}

function samplePixels(img, w, h, options = {}) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = options.draft?.image?.sampling !== 'pixel'
  ctx.imageSmoothingQuality = 'high'
  if (options.draft) drawDraftToCanvas(ctx, img, options.draft)
  else ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const image = options.draft?.image
  const neutral = !image
    || (image.brightness === 1 && image.contrast === 1 && image.saturation === 1)
  const px = new Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const alpha = data[i * 4 + 3] / 255
    const flattened = [
      data[i * 4] * alpha + MATTE * (1 - alpha),
      data[i * 4 + 1] * alpha + MATTE * (1 - alpha),
      data[i * 4 + 2] * alpha + MATTE * (1 - alpha),
    ]
    px[i] = neutral
      ? flattened.map((value) => clamp8(Math.round(value)))
      : applyImageAdjustments(flattened, image)
  }
  return px
}

const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b

export const fromHex = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

// Oklab keeps perceptually similar shades close, unlike raw RGB distance.
export function perceptualColor(rgb) {
  const [r, g, b] = rgb.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  const l = Math.cbrt(0.4122214708*r + 0.5363325363*g + 0.0514459929*b)
  const m = Math.cbrt(0.2119034982*r + 0.6806995451*g + 0.1073969566*b)
  const s = Math.cbrt(0.0883024619*r + 0.2817188376*g + 0.6299787005*b)
  return [0.2104542553*l + 0.793617785*m - 0.0040720468*s, 1.9779984951*l - 2.428592205*m + 0.4505937099*s, 0.0259040371*l + 0.7827717662*m - 0.808675766*s]
}
export const colorDistance = (a, b) => a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0)

function photoPalette(pixels, count) {
  const histogram = new Map()
  for (const rgb of pixels) {
    const key = rgb.join(',')
    const entry = histogram.get(key)
    if (entry) entry.count++
    else histogram.set(key, { rgb, lab: perceptualColor(rgb), count: 1 })
  }
  const samples = [...histogram.values()].sort((a, b) => b.count - a.count)
  if (!samples.length) return [[255, 255, 255]]
  // Weighted farthest-point seeding gives a small, distinctive accent a
  // chance to survive instead of splitting only populous neutral regions.
  const centers = [samples[0].rgb]
  while (centers.length < Math.min(count, samples.length)) {
    const labs = centers.map(perceptualColor)
    let best, score = 0
    for (const sample of samples) {
      const error = Math.min(...labs.map(c => colorDistance(sample.lab, c))) * Math.sqrt(sample.count)
      if (error > score) { score = error; best = sample.rgb }
    }
    if (!best) break
    centers.push(best)
  }
  for (let iteration = 0; iteration < 5; iteration++) {
    const labs = centers.map(perceptualColor)
    const buckets = centers.map(() => ({ total: 0, rgb: [0, 0, 0] }))
    for (const sample of samples) {
      let nearest = 0
      for (let i = 1; i < labs.length; i++) if (colorDistance(sample.lab, labs[i]) < colorDistance(sample.lab, labs[nearest])) nearest = i
      const bucket = buckets[nearest]
      bucket.total += sample.count
      sample.rgb.forEach((v, i) => { bucket.rgb[i] += v * sample.count })
    }
    buckets.forEach((bucket, i) => { if (bucket.total) centers[i] = bucket.rgb.map(v => v / bucket.total) })
  }
  return centers
}

/**
 * Names each colour by the part it plays in the photo, not just its rank, so
 * the yarn list reads as "Background / Foreground / Accent" instead of bare
 * letters — someone still has to know which yarn to pick up when they reach
 * that colour. Whichever colour dominates the image's outer border is the
 * Background (a photographed subject is framed by its backdrop far more
 * often than it fills the frame edge-to-edge); of what's left, the colour
 * covering the most stitches is the Foreground; everything remaining is
 * Accent, numbered only once there's more than one.
 */
export function assignColorRoles(counts, edgeCounts) {
  const indices = counts.map((_, i) => i)
  if (indices.length === 1) return ['Background']

  const byEdgeDominance = (a, b) => edgeCounts[b] - edgeCounts[a] || counts[b] - counts[a]
  const [backgroundIndex] = [...indices].sort(byEdgeDominance)
  const remaining = indices
    .filter((i) => i !== backgroundIndex)
    .sort((a, b) => counts[b] - counts[a])
  const [foregroundIndex, ...accentIndices] = remaining

  const roles = new Array(indices.length)
  roles[backgroundIndex] = 'Background'
  if (foregroundIndex !== undefined) roles[foregroundIndex] = 'Foreground'
  accentIndices.forEach((index, i) => {
    roles[index] = accentIndices.length > 1 ? `Accent ${i + 1}` : 'Accent'
  })
  return roles
}

const toHex = ([r, g, b]) =>
  '#' +
  [r, g, b]
    .map((v) => Math.round(v).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()

/**
 * @returns {{ grid: number[][], rows: number, colors: string[], roles: string[] }}
 * grid is row-major, row 1 first (i.e. grid[0] is the bottom row of the
 * work), values are colour ranks, 0 = darkest. `colors` are those ranks'
 * actual colours, taken straight from the photo. `roles` names what part
 * each rank plays (Background / Foreground / Accent) — see assignColorRoles.
 */
export function quantizeToGrid(img, stitchesWide, colorCount, options = {}) {
  const rows = options.rows ?? rowsForImage(img.width, img.height, stitchesWide)
  const px = samplePixels(img, stitchesWide, rows, options)

  let centroids
  if (options.palette?.length) centroids = options.palette.map(fromHex)
  else if (options.draft?.image?.sampling === 'pixel') {
    const unique = new Map(px.map(p => [toHex(p), p]))
    if (unique.size > 64) throw new Error('This image has more than 64 sampled colours. Choose Photo mode to reduce its palette.')
    centroids = [...unique.values()].sort((a, b) => lum(a) - lum(b))
  } else {
    centroids = photoPalette(px, colorCount).sort((a, b) => lum(a) - lum(b))
    const locked = [...new Set(options.lockedColors || [])].map(fromHex)
    for (const color of locked) {
      if (!centroids.length) break
      let nearestIndex = 0
      centroids.forEach((c, i) => {
        if (colorDistance(perceptualColor(c), perceptualColor(color)) < colorDistance(perceptualColor(centroids[nearestIndex]), perceptualColor(color))) nearestIndex = i
      })
      centroids.splice(nearestIndex, 1)
    }
    const threshold = Number(options.draft?.image?.mergeThreshold || 0)
    if (threshold > 0) centroids = centroids.filter((c, i, all) => !all.slice(0, i).some(other => colorDistance(perceptualColor(c), perceptualColor(other)) < threshold ** 2))
    centroids = [...locked, ...centroids].sort((a, b) => lum(a) - lum(b))
  }
  centroids = centroids.filter((c, i, all) => all.findIndex(other => toHex(other) === toHex(c)) === i)
  const perceptualCentroids = centroids.map(perceptualColor)

  const nearest = (p) => {
    const perceptual = perceptualColor(p)
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < centroids.length; i++) {
      const d = colorDistance(perceptual, perceptualCentroids[i])
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }

  // canvas row 0 is the top of the photo = the LAST row crocheted, so flip
  const counts = new Array(centroids.length).fill(0)
  const edgeCounts = new Array(centroids.length).fill(0)
  const grid = []
  for (let r = rows - 1; r >= 0; r--) {
    const row = new Array(stitchesWide)
    for (let x = 0; x < stitchesWide; x++) {
      const rank = nearest(px[r * stitchesWide + x])
      row[x] = rank
      counts[rank]++
      if (r === 0 || r === rows - 1 || x === 0 || x === stitchesWide - 1) edgeCounts[rank]++
    }
    grid.push(row)
  }
  const used = counts.map((count, i) => count > 0 ? i : -1).filter(i => i >= 0)
  const remap = new Map(used.map((index, i) => [index, i]))
  return {
    grid: grid.map(row => row.map(i => remap.get(i))),
    rows,
    colors: used.map(i => toHex(centroids[i])),
    counts: used.map(i => counts[i]),
    roles: assignColorRoles(used.map(i => counts[i]), used.map(i => edgeCounts[i])),
  }
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
