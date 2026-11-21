import { KIND_SLOT } from './garments'
import { nearestPalette } from './palette'
import type { Piece } from './types'

/** Keep the derived fields (slot, swatches, palette match) in step with the garment label. */
export function withPalette(p: Piece): Piece {
  const np = nearestPalette(p.spec.color)
  return { ...p, slot: KIND_SLOT[p.spec.kind], colors: [p.spec.color, p.spec.accent], palette: np.name, offPalette: np.off }
}

let counter = 0
export const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`
