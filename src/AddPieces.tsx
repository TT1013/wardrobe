import { useEffect, useRef, useState } from 'react'
import { dominantColors, fileToImage, guessSlot, niceName, renderCandidate } from './image'
import { Incoming, makeBookmarklet, proxyImage, proxyImageSrc, proxyPage } from './importer'
import { PALETTE, nearestPalette, paletteHex } from './palette'
import { Piece, SLOTS, STATUSES, Slot, Status } from './types'

interface Draft {
  id: string
  img: HTMLImageElement
  name: string
  brand: string
  slot: Slot
  status: Status
  tol: number
  remove: boolean
  pair: boolean
  sourceUrl: string
  price: string
  override?: string // manual palette color when auto-detection is fooled (e.g. on-model photos)
  image?: string
  colors?: string[]
  palette?: string
  off?: boolean
}

let counter = 0
const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

function DraftCard({ d, onChange, onRemove }: { d: Draft; onChange: (id: string, patch: Partial<Draft>) => void; onRemove: (id: string) => void }) {
  useEffect(() => {
    let cancel = false
    const t = setTimeout(() => {
      const c = renderCandidate(d.img, d.tol, d.remove)
      if (cancel) return
      const colors = dominantColors(c)
      const np = nearestPalette(colors[0])
      onChange(d.id, { image: c.toDataURL('image/png'), colors, palette: np.name, off: np.off })
    }, 50)
    return () => {
      cancel = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.img, d.tol, d.remove])

  return (
    <div className="draft">
      <div className="draft-img checker">{d.image ? <img src={d.image} alt="" /> : <span className="muted">processing…</span>}</div>
      <div className="draft-form">
        <input value={d.name} onChange={(e) => onChange(d.id, { name: e.target.value })} placeholder="Name" />
        <input value={d.brand} onChange={(e) => onChange(d.id, { brand: e.target.value })} placeholder="Brand (optional)" />
        <div className="row">
          <select value={d.slot} onChange={(e) => onChange(d.id, { slot: e.target.value as Slot })}>
            {SLOTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select value={d.status} onChange={(e) => onChange(d.id, { status: e.target.value as Status })}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <label className="check"><input type="checkbox" checked={d.remove} onChange={(e) => onChange(d.id, { remove: e.target.checked })} /> Remove background</label>
        {d.remove && (
          <label className="slider">Tolerance {d.tol}
            <input type="range" min={5} max={110} value={d.tol} onChange={(e) => onChange(d.id, { tol: +e.target.value })} />
          </label>
        )}
        {d.slot === 'shoes' && (
          <label className="check"><input type="checkbox" checked={d.pair} onChange={(e) => onChange(d.id, { pair: e.target.checked })} /> Image shows a pair</label>
        )}
        {d.colors && (
          <div className="muted small row" style={{ alignItems: 'center' }}>
            <span className="dot" style={{ background: d.override ? paletteHex(d.override) : d.colors[0] }} />
            <span>Detected {d.palette}{d.off ? ' (off palette)' : ''}. Wrong? </span>
            <select style={{ width: 'auto', padding: '2px 6px' }} value={d.override ?? ''} onChange={(e) => onChange(d.id, { override: e.target.value || undefined })}>
              <option value="">Auto</option>
              {PALETTE.map((p) => <option key={p.name}>{p.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <button className="icon-btn" onClick={() => onRemove(d.id)} aria-label="Discard">✕</button>
    </div>
  )
}

interface Meta { sourceUrl?: string; brand?: string; price?: string; rawName?: boolean }

// The store helper only exists when the app runs locally (npm run dev); a static deploy builds with VITE_HELPER=off.
const HELPER = (import.meta as any).env?.VITE_HELPER !== 'off'

function Importer() {
  if (!HELPER) return null
  const [copied, setCopied] = useState(false)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const code = makeBookmarklet(window.location.origin)
  // Set via the DOM: React blocks javascript: URLs in JSX.
  useEffect(() => { linkRef.current?.setAttribute('href', code) }, [code])
  return (
    <details className="importer">
      <summary>Import from any store page (one click)</summary>
      <ol className="small">
        <li>Drag this to your bookmarks bar: <a ref={linkRef} className="bm" onClick={(e) => e.preventDefault()} draggable>＋ TT13 Add</a>{' '}
          <button className="small-btn" onClick={() => { navigator.clipboard?.writeText(code).then(() => setCopied(true)).catch(() => {}) }}>{copied ? 'Copied' : 'Copy code'}</button></li>
        <li>Open a product page and click it. The product opens here with its image, name, brand and price filled in.</li>
        <li>Works while the app is running on this computer (<code>npm run dev</code>).</li>
      </ol>
    </details>
  )
}

export function AddPieces({ defaultSlot, incoming, onAdd, onClose }: { defaultSlot: Slot | 'all'; incoming?: Incoming | null; onAdd: (pieces: Piece[]) => void; onClose: () => void }) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [msg, setMsg] = useState('')
  const [url, setUrl] = useState('')
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState<Incoming | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const addFiles = async (files: Blob[], names: string[] = [], meta: Meta = {}) => {
    const imgs = files.filter((f) => f.type.startsWith('image/'))
    if (!imgs.length) {
      setMsg('No image found in that.')
      return
    }
    setMsg('')
    for (let i = 0; i < imgs.length; i++) {
      try {
        const img = await fileToImage(imgs[i])
        const raw = names[i] || (imgs[i] as File).name || 'New piece'
        const nm = meta.rawName ? raw.trim() : niceName(raw)
        const guess = guessSlot(nm)
        const slot = guess === 'top' && defaultSlot !== 'all' ? defaultSlot : guess
        setDrafts((ds) => [...ds, { id: uid(), img, name: nm, brand: meta.brand ?? '', price: meta.price ?? '', slot, status: 'owned', tol: 40, remove: true, pair: false, sourceUrl: meta.sourceUrl ?? '' }])
      } catch (e) {
        setMsg((e as Error).message)
      }
    }
  }

  // Add one product image from a page, trying later candidates if the first can't be fetched.
  const addFromPage = async (p: Incoming, imageUrl?: string) => {
    setBusy(true)
    setMsg('')
    const order = imageUrl ? [imageUrl] : p.images
    let lastErr = ''
    for (const u of order) {
      try {
        const blob = await proxyImage(u, p.url)
        await addFiles([blob], [p.title || 'Web piece'], { sourceUrl: p.url, brand: p.brand, price: p.price, rawName: true })
        setBusy(false)
        return
      } catch (e) {
        lastErr = (e as Error).message
      }
    }
    setMsg(lastErr || 'Could not fetch an image from that page.')
    setBusy(false)
  }

  const started = useRef(false)
  useEffect(() => {
    if (incoming && !started.current) {
      started.current = true
      setPage(incoming)
      addFromPage(incoming)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])]
      if (files.length) {
        e.preventDefault()
        addFiles(files, files.map(() => 'Pasted piece'))
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Accepts either a direct image URL or a product page URL.
  const fromUrl = async (raw: string) => {
    const u = raw.trim()
    if (!u) return
    setBusy(true)
    setMsg('')
    try {
      try {
        const blob = await proxyImage(u)
        await addFiles([blob], [new URL(u).pathname.split('/').pop() || 'Web piece'], { sourceUrl: u })
        setUrl('')
        return
      } catch (e) {
        if ((e as Error).message.startsWith('The importer helper')) throw e
      }
      const p = await proxyPage(u)
      setPage(p)
      await addFromPage(p)
      setUrl('')
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setOver(false)
    const files = [...e.dataTransfer.files]
    if (files.length) return addFiles(files)
    const u = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    if (u.startsWith('http')) fromUrl(u)
  }

  const change = (id: string, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  const ready = drafts.length > 0 && drafts.every((d) => d.image)

  const commit = () => {
    const now = Date.now()
    const pieces: Piece[] = drafts.map((d, i) => ({
      id: uid(), name: d.name || 'Untitled', brand: d.brand, slot: d.slot, status: d.status,
      image: d.image!,
      colors: d.override ? [paletteHex(d.override), ...d.colors!] : d.colors!,
      palette: d.override ?? d.palette!,
      offPalette: d.override ? false : !!d.off,
      sourceUrl: d.sourceUrl, price: d.price, notes: '', pair: d.pair, scale: 1, dx: 0, dy: 0, createdAt: now + i,
    }))
    onAdd(pieces)
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Add pieces</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div
          className={`drop ${over ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <strong>Drop images, paste (⌘V), or tap to choose / take a photo</strong>
          <span className="muted small">Select many at once for bulk add. Product shots on a plain background work best.</span>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = '' }} />
        </div>
        {HELPER && <div className="row">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…or paste a product page or image URL" onKeyDown={(e) => e.key === 'Enter' && fromUrl(url)} />
          <button onClick={() => fromUrl(url)} disabled={busy}>{busy ? '…' : 'Fetch'}</button>
        </div>}
        <Importer />
        {msg && <p className="warn">{msg}</p>}
        {page && page.images.length > 1 && (
          <div>
            <div className="muted small">More images from {page.brand || 'this page'}: tap to add</div>
            <div className="cands">
              {page.images.map((u) => (
                <button key={u} className="cand checker" onClick={() => addFromPage(page, u)} disabled={busy}>
                  <img src={proxyImageSrc(u, page.url)} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="drafts">
          {drafts.map((d) => <DraftCard key={d.id} d={d} onChange={change} onRemove={(id) => setDrafts((ds) => ds.filter((x) => x.id !== id))} />)}
        </div>
        <div className="modal-foot">
          <button className="primary" disabled={!ready} onClick={commit}>Add {drafts.length || ''} to closet</button>
        </div>
      </div>
    </div>
  )
}
