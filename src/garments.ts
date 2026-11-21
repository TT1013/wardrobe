import type { Slot } from './types'

// Every piece is drawn from a label, not pasted from a photo: what it is, its colors, pattern and fit.
export type Kind =
  | 'tee' | 'longsleeve-tee' | 'henley' | 'polo' | 'polo-ls' | 'oxford' | 'ss-shirt'
  | 'crew-sweater' | 'v-sweater' | 'cardigan' | 'quarter-zip' | 'hoodie' | 'sweatshirt' | 'sweater-vest'
  | 'chore' | 'bomber' | 'blazer' | 'overcoat' | 'puffer'
  | 'chinos' | 'jeans' | 'trousers' | 'joggers' | 'shorts'
  | 'sneakers' | 'runners' | 'loafers' | 'derbies' | 'boots'
  | 'cap' | 'beanie' | 'bucket'
  | 'watch' | 'belt' | 'crossbody' | 'tote' | 'backpack'

export type Pattern = 'solid' | 'stripe' | 'check' | 'heather' | 'denim'
export type Fit = 'slim' | 'regular' | 'relaxed'

export interface GarmentSpec {
  kind: Kind
  color: string // main color (hex)
  accent: string // stripes / check / sole / buckle / watch case (hex)
  pattern: Pattern
  fit: Fit
  tucked: boolean // shirts only
}

export const KINDS: { kind: Kind; slot: Slot; label: string }[] = [
  { kind: 'tee', slot: 'top', label: 'T-shirt' },
  { kind: 'longsleeve-tee', slot: 'top', label: 'Long-sleeve tee' },
  { kind: 'henley', slot: 'top', label: 'Henley' },
  { kind: 'polo', slot: 'top', label: 'Polo' },
  { kind: 'polo-ls', slot: 'top', label: 'Long-sleeve polo' },
  { kind: 'oxford', slot: 'top', label: 'Button-up shirt (long sleeve)' },
  { kind: 'ss-shirt', slot: 'top', label: 'Button-up shirt (short sleeve)' },
  { kind: 'crew-sweater', slot: 'mid', label: 'Crewneck sweater' },
  { kind: 'v-sweater', slot: 'mid', label: 'V-neck sweater' },
  { kind: 'cardigan', slot: 'mid', label: 'Cardigan' },
  { kind: 'quarter-zip', slot: 'mid', label: 'Quarter-zip' },
  { kind: 'hoodie', slot: 'mid', label: 'Hoodie' },
  { kind: 'sweatshirt', slot: 'mid', label: 'Sweatshirt' },
  { kind: 'sweater-vest', slot: 'mid', label: 'Sweater vest' },
  { kind: 'chore', slot: 'outer', label: 'Overshirt / chore / trucker jacket' },
  { kind: 'bomber', slot: 'outer', label: 'Zip jacket / bomber' },
  { kind: 'blazer', slot: 'outer', label: 'Blazer' },
  { kind: 'overcoat', slot: 'outer', label: 'Overcoat' },
  { kind: 'puffer', slot: 'outer', label: 'Puffer' },
  { kind: 'chinos', slot: 'bottom', label: 'Chinos' },
  { kind: 'jeans', slot: 'bottom', label: 'Jeans' },
  { kind: 'trousers', slot: 'bottom', label: 'Trousers' },
  { kind: 'joggers', slot: 'bottom', label: 'Joggers' },
  { kind: 'shorts', slot: 'bottom', label: 'Shorts' },
  { kind: 'sneakers', slot: 'shoes', label: 'Sneakers' },
  { kind: 'runners', slot: 'shoes', label: 'Running shoes' },
  { kind: 'loafers', slot: 'shoes', label: 'Loafers' },
  { kind: 'derbies', slot: 'shoes', label: 'Derbies / dress shoes' },
  { kind: 'boots', slot: 'shoes', label: 'Boots' },
  { kind: 'cap', slot: 'headwear', label: 'Cap' },
  { kind: 'beanie', slot: 'headwear', label: 'Beanie' },
  { kind: 'bucket', slot: 'headwear', label: 'Bucket hat' },
  { kind: 'watch', slot: 'watch', label: 'Watch' },
  { kind: 'belt', slot: 'belt', label: 'Belt' },
  { kind: 'crossbody', slot: 'bag', label: 'Crossbody bag' },
  { kind: 'tote', slot: 'bag', label: 'Tote' },
  { kind: 'backpack', slot: 'bag', label: 'Backpack' },
]

export const KIND_SLOT = Object.fromEntries(KINDS.map((k) => [k.kind, k.slot])) as Record<Kind, Slot>
export const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.kind, k.label])) as Record<Kind, string>

export const DEFAULT_KIND: Record<Slot, Kind> = {
  headwear: 'cap', top: 'tee', mid: 'crew-sweater', outer: 'chore', bottom: 'chinos',
  shoes: 'sneakers', watch: 'watch', belt: 'belt', bag: 'crossbody',
}

const SHOES: Kind[] = ['sneakers', 'runners', 'loafers', 'derbies', 'boots']
export function accentLabel(k: Kind): string {
  if (SHOES.includes(k)) return 'Sole'
  if (k === 'watch') return 'Case'
  if (k === 'belt') return 'Buckle'
  if (k === 'jeans') return 'Stitching'
  return 'Second color (stripes, check)'
}
export function hasAccent(spec: GarmentSpec): boolean {
  return spec.pattern === 'stripe' || spec.pattern === 'check' || SHOES.includes(spec.kind) || ['watch', 'belt', 'jeans'].includes(spec.kind)
}
