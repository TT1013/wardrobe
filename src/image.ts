import { rgbToHex } from './palette'

// Photos are kept only as a small reference thumbnail; the avatar wears the illustrated garment.

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

/** Small JPEG for the closet card and editor (about 20-40 KB). */
export function toReference(img: HTMLImageElement, max = 320): string {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(img.naturalWidth * scale))
  c.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.82)
}

/**
 * Best guess at the garment's color from a photo: look at the middle of the frame, skip pixels that match the
 * background (corner color) or look like skin, and take the most common remaining color.
 * Only used when the product text names no color.
 */
export function sampleGarmentColor(img: HTMLImageElement): string | null {
  const n = 96
  const c = document.createElement('canvas')
  c.width = n
  c.height = n
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0, n, n)
  let d: Uint8ClampedArray
  try {
    d = ctx.getImageData(0, 0, n, n).data
  } catch {
    return null // cross-origin image without permission to read pixels
  }
  const px = (x: number, y: number) => { const i = (y * n + x) * 4; return [d[i], d[i + 1], d[i + 2]] }
  const corners = [px(1, 1), px(n - 2, 1), px(1, n - 2), px(n - 2, n - 2)]
  const bg = [0, 1, 2].map((k) => corners.reduce((s, p) => s + p[k], 0) / 4)
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let y = Math.floor(n * 0.22); y < n * 0.78; y++) {
    for (let x = Math.floor(n * 0.28); x < n * 0.72; x++) {
      const [r, g, b] = px(x, y)
      if (Math.hypot(r - bg[0], g - bg[1], b - bg[2]) < 42) continue
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
      const sat = mx ? (mx - mn) / mx : 0
      if (r > 95 && r > g && g > b && r - b > 30 && sat > 0.28 && sat < 0.7) continue // skin-like
      const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)
      const e = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
      e.n++; e.r += r; e.g += g; e.b += b
      bins.set(key, e)
    }
  }
  const top = [...bins.values()].sort((a, b) => b.n - a.n)[0]
  return top && top.n > 20 ? rgbToHex(top.r / top.n, top.g / top.n, top.b / top.n) : null
}

export function niceName(filename: string): string {
  return filename.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'New piece'
}
