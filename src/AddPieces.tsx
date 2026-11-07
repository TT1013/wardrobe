import { useEffect, useRef, useState } from 'react'
import { dominantColors, fileToImage, guessSlot, niceName, renderCandidate } from './image'
import { nearestPalette } from './palette'
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
        {d.colors && <div className="muted small">Detected: {d.palette}{d.off ? ' (off palette)' : ''} <span className="dot" style={{ background: d.colors[0] }} /></div>}
      </div>
      <button className="icon-btn" onClick={() => onRemove(d.id)} aria-label="Discard">✕</button>
    </div>
  )
}

export function AddPieces({ defaultSlot, onAdd, onClose }: { defaultSlot: Slot | 'all'; onAdd: (pieces: Piece[]) => void; onClose: () => void }) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [msg, setMsg] = useState('')
  const [url, setUrl] = useState('')
  const [over, setOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const addFiles = async (files: Blob[], names: string[] = [], sourceUrl = '') => {
    const imgs = files.filter((f) => f.type.startsWith('image/'))
    if (!imgs.length) {
      setMsg('No image found in that.')
      return
    }
    setMsg('')
    for (let i = 0; i < imgs.length; i++) {
      try {
        const img = await fileToImage(imgs[i])
        const nm = niceName(names[i] || (imgs[i] as File).name || 'New piece')
        const guess = guessSlot(nm)
        const slot = guess === 'top' && defaultSlot !== 'all' ? defaultSlot : guess
        setDrafts((ds) => [...ds, { id: uid(), img, name: nm, brand: '', slot, status: 'owned', tol: 40, remove: true, pair: false, sourceUrl }])
      } catch (e) {
        setMsg((e as Error).message)
      }
    }
  }

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

  const fromUrl = async (u: string) => {
    if (!u.trim()) return
    try {
      const res = await fetch(u.trim())
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) throw new Error('not an image')
      await addFiles([blob], [new URL(u).pathname.split('/').pop() || 'Web piece'], u.trim())
      setUrl('')
    } catch {
      setMsg("That site blocks direct image fetching. Save the image and drop it here (a one-click importer is coming in M2).")
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
      image: d.image!, colors: d.colors!, palette: d.palette!, offPalette: !!d.off,
      sourceUrl: d.sourceUrl, notes: '', pair: d.pair, scale: 1, dx: 0, dy: 0, createdAt: now + i,
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
        <div className="row">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…or paste an image URL" onKeyDown={(e) => e.key === 'Enter' && fromUrl(url)} />
          <button onClick={() => fromUrl(url)}>Fetch</button>
        </div>
        {msg && <p className="warn">{msg}</p>}
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
