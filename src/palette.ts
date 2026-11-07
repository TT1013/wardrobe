// TT13 uniform palette. Home = Black, Away = Navy, secondary = White / Light Blue / Beige, plus Grey.
export interface Swatch {
  name: string
  hex: string
  role: string
}

export const PALETTE: Swatch[] = [
  { name: 'Black', hex: '#111112', role: 'Home' },
  { name: 'Navy', hex: '#1b2a49', role: 'Away' },
  { name: 'White', hex: '#f4f4f1', role: 'Secondary' },
  { name: 'Light Blue', hex: '#a9c7e8', role: 'Secondary' },
  { name: 'Beige', hex: '#d8c7a8', role: 'Secondary' },
  { name: 'Grey', hex: '#8a8d92', role: 'Neutral' },
]

// Extra grey shades count as "Grey" (final swatches get chosen once real pieces are added).
const MATCH_POINTS: { name: string; hex: string }[] = [
  ...PALETTE.map((p) => ({ name: p.name, hex: p.hex })),
  { name: 'Grey', hex: '#3b3e43' },
  { name: 'Grey', hex: '#c9ccd0' },
]

const OFF_PALETTE_DELTA_E = 28

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (v: number) => {
    v /= 255
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
}

export function deltaE(hexA: string, hexB: string): number {
  const a = rgbToLab(...hexToRgb(hexA))
  const b = rgbToLab(...hexToRgb(hexB))
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

export function nearestPalette(hex: string): { name: string; distance: number; off: boolean } {
  let best = { name: 'Black', distance: Infinity }
  for (const p of MATCH_POINTS) {
    const d = deltaE(hex, p.hex)
    if (d < best.distance) best = { name: p.name, distance: d }
  }
  return { ...best, off: best.distance > OFF_PALETTE_DELTA_E }
}

export function paletteHex(name: string): string {
  return PALETTE.find((p) => p.name === name)?.hex ?? '#999999'
}
