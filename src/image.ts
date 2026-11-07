import { rgbToHex } from './palette'
import type { Slot } from './types'

const MAX_DIM = 700

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image'))
    img.src = src
  })
}

export async function fileToImage(file: Blob): Promise<HTMLImageElement> {
  return loadImage(URL.createObjectURL(file))
}

/** Remove a near-uniform background by flood-filling from the image border. Garment colors are never altered. */
function removeBackground(c: HTMLCanvasElement, tol: number) {
  const ctx = c.getContext('2d')!
  const { width: w, height: h } = c
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data

  // Background color = average of the four 5px corner patches.
  const pts: [number, number][] = [[0, 0], [w - 5, 0], [0, h - 5], [w - 5, h - 5]]
  let r = 0, g = 0, b = 0, n = 0
  for (const [px, py] of pts) {
    for (let y = Math.max(0, py); y < Math.min(h, py + 5); y++) {
      for (let x = Math.max(0, px); x < Math.min(w, px + 5); x++) {
        const i = (y * w + x) * 4
        r += d[i]; g += d[i + 1]; b += d[i + 2]; n++
      }
    }
  }
  r /= n; g /= n; b /= n
  const dist = (p: number) => Math.hypot(d[p * 4] - r, d[p * 4 + 1] - g, d[p * 4 + 2] - b)

  const removed = new Uint8Array(w * h)
  const seen = new Uint8Array(w * h)
  const stack: number[] = []
  const seed = (x: number, y: number) => {
    const p = y * w + x
    if (seen[p]) return
    seen[p] = 1
    if (dist(p) <= tol) stack.push(p)
  }
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1) }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y) }
  while (stack.length) {
    const p = stack.pop()!
    removed[p] = 1
    const x = p % w, y = (p / w) | 0
    if (x > 0) seed(x - 1, y)
    if (x < w - 1) seed(x + 1, y)
    if (y > 0) seed(x, y - 1)
    if (y < h - 1) seed(x, y + 1)
  }

  // Soften the edge: opaque pixels touching removed ones fade out if they are close to the background.
  const soft = new Float32Array(w * h).fill(1)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x
      if (removed[p]) continue
      if (removed[p - 1] || removed[p + 1] || removed[p - w] || removed[p + w]) {
        const dd = dist(p)
        if (dd < tol * 1.8) soft[p] = Math.max(0.15, Math.min(1, (dd - tol) / (tol * 0.8 || 1)))
      }
    }
  }
  for (let p = 0; p < w * h; p++) {
    if (removed[p]) d[p * 4 + 3] = 0
    else if (soft[p] < 1) d[p * 4 + 3] = Math.round(255 * soft[p])
  }
  ctx.putImageData(img, 0, 0)
}

function cropToContent(c: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = c.getContext('2d')!
  const { width: w, height: h } = c
  const d = ctx.getImageData(0, 0, w, h).data
  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 10) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return c // everything was removed; keep what we had
  const out = document.createElement('canvas')
  out.width = maxX - minX + 1
  out.height = maxY - minY + 1
  out.getContext('2d')!.drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

export function renderCandidate(img: HTMLImageElement, tol: number, remove: boolean): HTMLCanvasElement {
  const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(img.naturalWidth * scale))
  c.height = Math.max(1, Math.round(img.naturalHeight * scale))
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  if (!remove) return c
  removeBackground(c, tol)
  return cropToContent(c)
}

/** Top dominant colors sampled from opaque garment pixels (never from the product name). */
export function dominantColors(c: HTMLCanvasElement, k = 3): string[] {
  const { width: w, height: h } = c
  const d = c.getContext('2d')!.getImageData(0, 0, w, h).data
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>()
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 40000)))
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4
      if (d[i + 3] < 200) continue
      const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4)
      const e = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
      e.n++; e.r += d[i]; e.g += d[i + 1]; e.b += d[i + 2]
      bins.set(key, e)
    }
  }
  const sorted = [...bins.values()].sort((a, b) => b.n - a.n).slice(0, k)
  if (!sorted.length) return ['#888888']
  return sorted.map((e) => rgbToHex(e.r / e.n, e.g / e.n, e.b / e.n))
}

const GUESS: [RegExp, Slot][] = [
  [/\b(cap|hat|beanie|visor)\b/i, 'headwear'],
  [/(jacket|coat|overshirt|parka|blazer|bomber|vest|cardigan|windbreaker|shacket)/i, 'outer'],
  [/(t-?shirt|\btee\b|polo|sweater|sweatshirt|hoodie|henley|\btank\b|long sleeve|short sleeve|crew ?neck|knit)/i, 'top'],
  [/(pant|jean|chino|\bshorts?\b|trouser|jogger|denim|slack)/i, 'bottom'],
  [/(shoe|sneaker|boot|loafer|trainer|runner|sandal|oxford|derby)/i, 'shoes'],
  [/(watch)/i, 'watch'],
  [/(belt)/i, 'belt'],
  [/(bag|backpack|tote|duffel|satchel)/i, 'bag'],
]

export function guessSlot(name: string): Slot {
  for (const [re, slot] of GUESS) if (re.test(name)) return slot
  return 'top'
}

export function niceName(filename: string): string {
  return filename.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'New piece'
}
