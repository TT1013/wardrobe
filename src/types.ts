import type { GarmentSpec } from './garments'

export type Slot = 'headwear' | 'top' | 'mid' | 'outer' | 'bottom' | 'shoes' | 'watch' | 'belt' | 'bag'

export const SLOTS: { key: Slot; label: string }[] = [
  { key: 'headwear', label: 'Headwear' },
  { key: 'top', label: 'Shirt / tee' },
  { key: 'mid', label: 'Sweater / cardigan' },
  { key: 'outer', label: 'Jacket / coat' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'shoes', label: 'Shoes' },
  { key: 'watch', label: 'Watch' },
  { key: 'belt', label: 'Belt' },
  { key: 'bag', label: 'Bag' },
]

export const SLOT_LABEL = Object.fromEntries(SLOTS.map((s) => [s.key, s.label])) as Record<Slot, string>

export type Status = 'owned' | 'wishlist' | 'considering'
export const STATUSES: Status[] = ['owned', 'considering', 'wishlist']

export const OCCASIONS = ['Work', 'Weekend', 'Travel', 'Going out'] as const
export type Occasion = (typeof OCCASIONS)[number]

export interface Piece {
  id: string
  name: string
  brand: string
  slot: Slot // always the slot of spec.kind
  status: Status
  spec: GarmentSpec // what the avatar wears: type, colors, pattern, fit
  image: string // reference photo (small JPEG data URL) or ''
  photoUrl?: string // remote reference photo when the store would not let it be copied
  colors: string[] // [spec.color, spec.accent]
  palette: string // nearest TT13 palette name for spec.color
  offPalette: boolean
  sourceUrl: string
  price?: string // recorded only; never scored or filtered (budget is out of scope)
  notes: string
  createdAt: number
}

export type Wearing = Partial<Record<Slot, string>>

export interface Outfit {
  id: string
  name: string
  occasion: Occasion
  items: Wearing
  createdAt: number
}

export type Build = 'slim' | 'average' | 'stocky'

export interface AvatarConfig {
  skin: string
  hair: string
  build: Build
  glasses: boolean
}

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: '#e2a67e',
  hair: '#2a1f1a',
  build: 'average',
  glasses: true,
}
