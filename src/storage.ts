import { get, set, del } from 'idb-keyval'
import { AvatarConfig, DEFAULT_AVATAR, Outfit, Piece, Wearing } from './types'

export interface AppState {
  pieces: Piece[]
  outfits: Outfit[]
  avatar: AvatarConfig
  wearing: Wearing
}

// IndexedDB can be unavailable (private windows, blocked storage); the app must still render without it.
export async function loadState(): Promise<AppState> {
  try {
    const [pieces, outfits, avatar, wearing] = await Promise.all([
      get('pieces'), get('outfits'), get('avatar'), get('wearing'),
    ])
    return {
      pieces: pieces ?? [],
      outfits: outfits ?? [],
      avatar: { ...DEFAULT_AVATAR, ...(avatar ?? {}) },
      wearing: wearing ?? {},
    }
  } catch {
    return { pieces: [], outfits: [], avatar: DEFAULT_AVATAR, wearing: {} }
  }
}

export function save(key: 'pieces' | 'outfits' | 'avatar' | 'wearing', value: unknown) {
  set(key, value).catch(() => {})
}

export async function resetAll() {
  try {
    await Promise.all(['pieces', 'outfits', 'avatar', 'wearing'].map((k) => del(k)))
  } catch {
    /* ignore */
  }
}

export interface Backup {
  app: 'tt13-wardrobe'
  version: 1
  exportedAt: string
  pieces: Piece[]
  outfits: Outfit[]
  avatar: AvatarConfig
}

export function makeBackup(s: AppState): Backup {
  return { app: 'tt13-wardrobe', version: 1, exportedAt: new Date().toISOString(), pieces: s.pieces, outfits: s.outfits, avatar: s.avatar }
}

export function parseBackup(text: string): Backup {
  const b = JSON.parse(text)
  if (b?.app !== 'tt13-wardrobe' || !Array.isArray(b.pieces) || !Array.isArray(b.outfits)) {
    throw new Error('Not a TT13 wardrobe backup file')
  }
  return b as Backup
}
