import { useEffect, useRef, useState } from 'react'
import { GarmentThumb } from './GarmentArt'
import { brandFromUrl, classify, cleanTitle, nameFromUrl, textFromUrl } from './classify'
import { fileToImage, niceName, sampleGarmentColor, toReference } from './image'
import { HELPER, Incoming, makeBookmarklet, proxyImage, proxyPage } from './importer'
import { LabelForm, LabelValue } from './LabelForm'
import { uid, withPalette } from './pieces'
import { Piece, Slot } from './types'

interface Draft extends LabelValue {
  id: string
  price: string
  sourceUrl: string
  image: string
  photoUrl: string
  guessed: { kind: boolean; color: boolean }
  note?: string
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

function Importer() {
  const [copied, setCopied] = useState(false)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const code = makeBookmarklet((window.location.origin + window.location.pathname).replace(/\/$/, ''))
  // Set via the DOM: React blocks javascript: URLs in JSX.
  useEffect(() => { linkRef.current?.setAttribute('href', code) }, [code])
  return (
    <details className="importer">
      <summary>One-click add from any store page</summary>
      <ol className="small">
        <li>Drag this to your bookmarks bar: <a ref={linkRef} className="bm" onClick={(e) => e.preventDefault()} draggable>＋ TT13 Add</a>{' '}
          <button className="small-btn" onClick={() => { navigator.clipboard?.writeText(code).then(() => setCopied(true)).catch(() => {}) }}>{copied ? 'Copied' : 'Copy code'}</button></li>
        <li>On a product page, click it. The piece opens here already labeled: brand, type, color, pattern and fit, read from the page.</li>
        <li>If the browser blocks the pop-up, allow pop-ups for that store once.</li>
      </ol>
    </details>
  )
}

export function AddPieces({ defaultSlot, incoming, initialUrl, onAdd, onClose }: { defaultSlot: Slot | 'all'; incoming?: Incoming | null; initialUrl?: string; onAdd: (pieces: Piece[]) => void; onClose: () => void }) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [msg, setMsg] = useState('')
  const [url, setUrl] = useState('')
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const push = (d: Draft) => setDrafts((ds) => [...ds, d])

  /** Label a product from its text, using the photo only to guess color when the text names none. */
  const makeDraft = (t: { title: string; brand?: string; price?: string; url?: string; color?: string; description?: string; category?: string }, photo?: { img?: HTMLImageElement; url?: string }, note?: string): Draft => {
    const c = classify({ ...t, slotHint: defaultSlot })
    if (c.guessed.color && photo?.img) {
      const hex = sampleGarmentColor(photo.img)
      if (hex) c.spec.color = hex
    }
    let image = ''
    try { if (photo?.img) image = toReference(photo.img) } catch { /* image without read permission */ }
    return {
      id: uid(), name: cleanTitle(t.title), brand: t.brand ?? '', price: t.price ?? '', sourceUrl: t.url ?? '', status: 'owned',
      spec: c.spec, image, photoUrl: !image && photo?.url ? photo.url : '', guessed: c.guessed, note,
    }
  }

  /** A product from the bookmarklet or the local page reader. */
  const fromProduct = async (p: Incoming) => {
    let img: HTMLImageElement | undefined
    const first = p.images[0]
    try {
      const blob = p.blobs?.[first] ?? (HELPER && first ? await proxyImage(first, p.url) : undefined)
      if (blob) img = await fileToImage(blob)
    } catch { /* the photo is only a reference */ }
    push(makeDraft({ title: p.title, brand: p.brand, price: p.price, url: p.url, color: p.color, description: p.description, category: p.category }, { img, url: first }))
  }

  /** A pasted link. With the local helper the page is read; on the hosted site only the link's own words are. */
  const fromLink = async (raw: string) => {
    const u = raw.trim()
    if (!/^https?:\/\/\S+$/.test(u)) { setMsg('Paste a full product link starting with https://'); return }
    setBusy(true)
    setMsg('')
    try {
      if (HELPER) {
        await fromProduct(await proxyPage(u))
      } else {
        const words = textFromUrl(u)
        push(makeDraft(
          { title: nameFromUrl(u) || titleCase(words) || 'New piece', brand: brandFromUrl(u), url: u }, undefined,
          'Labeled from the link’s words only. For the exact color, photo and price, use the TT13 Add button on the store page.',
        ))
      }
      setUrl('')
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const addPhotos = async (files: Blob[]) => {
    const imgs = files.filter((f) => f.type.startsWith('image/'))
    if (!imgs.length) { setMsg('No image found in that.'); return }
    setMsg('')
    for (const f of imgs) {
      try {
        const img = await fileToImage(f)
        push(makeDraft({ title: niceName((f as File).name || 'New piece') }, { img }))
      } catch (e) {
        setMsg((e as Error).message)
      }
    }
  }

  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    if (incoming) fromProduct(incoming)
    else if (initialUrl) fromLink(initialUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null
      const files = [...(e.clipboardData?.files ?? [])]
      if (files.length) { e.preventDefault(); addPhotos(files); return }
      if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return
      const text = (e.clipboardData?.getData('text') ?? '').trim()
      if (/^https?:\/\/\S+$/.test(text)) { e.preventDefault(); fromLink(text) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setOver(false)
    const files = [...e.dataTransfer.files]
    if (files.length) return addPhotos(files)
    const u = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    if (u.startsWith('http')) fromLink(u)
  }

  const change = (id: string, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  const commit = () => {
    const now = Date.now()
    onAdd(drafts.map((d, i) => withPalette({
      id: uid(), name: d.name.trim() || 'Untitled', brand: d.brand, slot: 'top', status: d.status, spec: d.spec,
      image: d.image, photoUrl: d.photoUrl || undefined, colors: [], palette: '', offPalette: false,
      sourceUrl: d.sourceUrl, price: d.price, notes: '', createdAt: now + i,
    })))
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Add pieces</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="row">
          <input id="add-link" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a product link" onKeyDown={(e) => e.key === 'Enter' && fromLink(url)} />
          <button className="primary" onClick={() => fromLink(url)} disabled={busy || !url.trim()}>{busy ? 'Reading…' : 'Add'}</button>
        </div>
        <Importer />

        <div className="add-ways">
          <div
            className={`drop ${over ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <strong>Add from photos</strong>
            <span className="muted small">Drop, paste or choose. Name the file well (e.g. "navy-oxford-shirt.jpg") and the label fills itself.</span>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos([...(e.target.files ?? [])]); e.target.value = '' }} />
          </div>
          <button className="blank-btn" onClick={() => push(makeDraft({ title: '' }))}>
            <strong>+ Add without a photo</strong>
            <span className="muted small">Pick the type and color yourself. Fastest for things you already own.</span>
          </button>
        </div>
        {msg && <p className="warn">{msg}</p>}

        <div className="drafts">
          {drafts.map((d) => (
            <div key={d.id} className="draft">
              <div className="draft-preview">
                <div className="draft-art"><GarmentThumb p={d} /></div>
                {(d.image || d.photoUrl) && <img className="ref-photo" src={d.image || d.photoUrl} alt="Store photo" referrerPolicy="no-referrer" />}
              </div>
              <div className="draft-body">
                {(d.guessed.kind || d.guessed.color) && <p className="small muted">Auto-labeled. Check the fields marked <em className="check-me">check</em>.</p>}
                {d.note && <p className="small muted">{d.note}</p>}
                <LabelForm idPrefix={`d-${d.id}`} value={d} guessed={d.guessed} onChange={(patch) => change(d.id, { ...patch, guessed: { kind: d.guessed.kind && !patch.spec, color: d.guessed.color && !patch.spec } })} />
              </div>
              <button className="icon-btn" onClick={() => setDrafts((ds) => ds.filter((x) => x.id !== d.id))} aria-label="Discard">✕</button>
            </div>
          ))}
        </div>

        <div className="modal-foot">
          <button className="primary" disabled={!drafts.length} onClick={commit}>Add {drafts.length || ''} to closet</button>
        </div>
      </div>
    </div>
  )
}
