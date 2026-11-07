import { useEffect, useState } from 'react'
import { Avatar } from './Avatar'
import { AddPieces } from './AddPieces'
import { AvatarPanel, Closet, DataPanel, Outfits, PieceEditor } from './Panels'
import { HELPER, type Incoming } from './importer'
import { loadState, makeBackup, parseBackup, resetAll, save } from './storage'
import { AvatarConfig, DEFAULT_AVATAR, Occasion, Outfit, Piece, SLOTS, Slot, Wearing } from './types'

type Tab = 'closet' | 'outfits' | 'avatar' | 'data'
const TABS: { key: Tab; label: string }[] = [
  { key: 'closet', label: 'Closet' },
  { key: 'outfits', label: 'Outfits' },
  { key: 'avatar', label: 'Avatar' },
  { key: 'data', label: 'Data' },
]

export default function App() {
  const [ready, setReady] = useState(false)
  const [pieces, setPieces] = useState<Piece[]>([])
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [avatar, setAvatar] = useState<AvatarConfig>(DEFAULT_AVATAR)
  const [wearing, setWearing] = useState<Wearing>({})
  const [tab, setTab] = useState<Tab>('closet')
  const [slotFilter, setSlotFilter] = useState<Slot | 'all'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState('')
  const [pastedUrl, setPastedUrl] = useState<{ n: number; url: string } | null>(null)
  const [incoming, setIncoming] = useState<{ n: number; data: Incoming } | null>(null)

  // The bookmarklet opens this app as /#import=<product json>.
  useEffect(() => {
    const read = () => {
      if (!location.hash.startsWith('#import=')) return
      try {
        const data = JSON.parse(decodeURIComponent(location.hash.slice(8))) as Incoming
        history.replaceState(null, '', location.pathname + location.search)
        if (Array.isArray(data.images)) {
          setIncoming({ n: Date.now(), data })
          setTab('closet')
          setAdding(true)
        }
      } catch { /* ignore a malformed link */ }
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  // The bookmarklet posts the product (with images it copied in the store page) from the store's tab.
  useEffect(() => {
    let lastId = ''
    const onMessage = (e: MessageEvent) => {
      const d = e.data
      if (!d || d.tt13 !== 'import' || typeof d.id !== 'string' || !d.meta || !Array.isArray(d.images)) return
      try { (e.source as WindowProxy | null)?.postMessage({ tt13: 'ack', id: d.id }, e.origin) } catch { /* ignore */ }
      if (d.id === lastId) return // the bookmarklet re-sends until it hears the ack
      lastId = d.id
      const blobs: Record<string, Blob> = {}
      for (const im of d.images) if (im?.blob instanceof Blob && typeof im.url === 'string') blobs[im.url] = im.blob
      const m = d.meta
      const images = Array.isArray(m.images) ? m.images.filter((u: unknown) => typeof u === 'string') : []
      if (!images.length) return
      setIncoming({ n: Date.now(), data: { title: String(m.title ?? ''), brand: String(m.brand ?? ''), price: String(m.price ?? ''), url: String(m.url ?? ''), images, blobs } })
      setTab('closet')
      setAdding(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Paste a product link anywhere outside a text field to start an import.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      const text = (e.clipboardData?.getData('text') ?? '').trim()
      if (!HELPER || !/^https?:\/\/\S+$/.test(text)) return
      e.preventDefault()
      setPastedUrl({ n: Date.now(), url: text })
      setTab('closet')
      setAdding(true)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  useEffect(() => {
    loadState().then((s) => {
      setPieces(s.pieces)
      setOutfits(s.outfits)
      setAvatar(s.avatar)
      setWearing(s.wearing)
      setReady(true)
    })
  }, [])
  useEffect(() => { if (ready) save('pieces', pieces) }, [pieces, ready])
  useEffect(() => { if (ready) save('outfits', outfits) }, [outfits, ready])
  useEffect(() => { if (ready) save('avatar', avatar) }, [avatar, ready])
  useEffect(() => { if (ready) save('wearing', wearing) }, [wearing, ready])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const wear = (p: Piece) =>
    setWearing((w) => {
      const next = { ...w }
      if (w[p.slot] === p.id) delete next[p.slot]
      else next[p.slot] = p.id
      return next
    })

  const patchPiece = (id: string, patch: Partial<Piece>) => {
    setPieces((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    // If the slot changed, move the worn reference so nothing renders in the wrong place.
    if (patch.slot) {
      setWearing((w) => {
        const next: Wearing = {}
        for (const [k, v] of Object.entries(w)) if (v !== id) next[k as Slot] = v
        next[patch.slot!] = id
        return next
      })
    }
  }

  const deletePiece = (id: string) => {
    setPieces((ps) => ps.filter((p) => p.id !== id))
    const strip = (items: Wearing) => Object.fromEntries(Object.entries(items).filter(([, v]) => v !== id)) as Wearing
    setWearing(strip)
    setOutfits((os) => os.map((o) => ({ ...o, items: strip(o.items) })))
    setEditingId(null)
  }

  const startEdit = (p: Piece) => {
    setWearing((w) => ({ ...w, [p.slot]: p.id }))
    setEditingId(p.id)
  }

  const saveOutfit = (name: string, occasion: Occasion) => {
    setOutfits((os) => [{ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, occasion, items: { ...wearing }, createdAt: Date.now() }, ...os])
    setToast(`Saved "${name}"`)
  }

  const applyOutfit = (o: Outfit) => {
    const next: Wearing = {}
    for (const [k, v] of Object.entries(o.items)) if (pieces.some((p) => p.id === v)) next[k as Slot] = v
    setWearing(next)
    setToast(`Wearing "${o.name}"`)
  }

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(makeBackup({ pieces, outfits, avatar, wearing }))], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tt13-wardrobe-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  const importBackup = (text: string) => {
    try {
      const b = parseBackup(text)
      setPieces((ps) => [...ps.filter((p) => !b.pieces.some((n) => n.id === p.id)), ...b.pieces])
      setOutfits((os) => [...os.filter((o) => !b.outfits.some((n) => n.id === o.id)), ...b.outfits])
      if (b.avatar) setAvatar({ ...DEFAULT_AVATAR, ...b.avatar })
      setToast(`Imported ${b.pieces.length} pieces, ${b.outfits.length} outfits`)
    } catch (e) {
      setToast((e as Error).message)
    }
  }

  const editing = pieces.find((p) => p.id === editingId)

  return (
    <div className="app">
      <header className="top">
        <div className="brand"><span className="mark">TT13</span><span className="sub">Uniform</span></div>
      </header>

      <main className="layout">
        <section className="stage-col">
          <div className="stage">
            <Avatar config={avatar} wearing={wearing} pieces={pieces} />
          </div>
          <div className="wear-bar">
            {SLOTS.map((s) => {
              const p = pieces.find((x) => x.id === wearing[s.key])
              return (
                <div key={s.key} className={`wear-slot ${p ? 'has' : ''}`}>
                  <button className="wear-main" onClick={() => { setTab('closet'); setSlotFilter(s.key) }}>
                    <span className="wear-label">{s.label}</span>
                    <span className="wear-name">{p ? p.name : '—'}</span>
                  </button>
                  {p && <button className="icon-btn" onClick={() => wear(p)} aria-label={`Remove ${p.name}`}>✕</button>}
                </div>
              )
            })}
          </div>
          <div className="stage-actions">
            <button onClick={() => setWearing({})} disabled={!Object.keys(wearing).length}>Clear outfit</button>
            <button className="primary" onClick={() => setTab('outfits')} disabled={!Object.keys(wearing).length}>Save outfit…</button>
          </div>
        </section>

        <section className="panel">
          {editing ? (
            <PieceEditor piece={editing} onChange={(patch) => patchPiece(editing.id, patch)} onDelete={() => deletePiece(editing.id)} onClose={() => setEditingId(null)} />
          ) : (
            <>
              <nav className="tabs">
                {TABS.map((t) => <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>{t.label}</button>)}
              </nav>
              {tab === 'closet' && <Closet pieces={pieces} wearing={wearing} slotFilter={slotFilter} setSlotFilter={setSlotFilter} onWear={wear} onEdit={startEdit} onAdd={() => setAdding(true)} />}
              {tab === 'outfits' && <Outfits outfits={outfits} pieces={pieces} avatar={avatar} wearing={wearing} onSave={saveOutfit} onApply={applyOutfit} onDelete={(id) => setOutfits((os) => os.filter((o) => o.id !== id))} />}
              {tab === 'avatar' && <AvatarPanel avatar={avatar} setAvatar={setAvatar} />}
              {tab === 'data' && <DataPanel counts={`${pieces.length} pieces, ${outfits.length} outfits.`} onExport={exportBackup} onImport={importBackup} onReset={async () => { await resetAll(); setPieces([]); setOutfits([]); setWearing({}); setAvatar(DEFAULT_AVATAR); setToast('Erased') }} />}
            </>
          )}
        </section>
      </main>

      {adding && <AddPieces key={incoming?.n ?? pastedUrl?.n ?? 0} defaultSlot={slotFilter} incoming={incoming?.data} initialUrl={pastedUrl?.url} onClose={() => { setAdding(false); setIncoming(null); setPastedUrl(null); setPastedUrl(null) }} onAdd={(ps) => { setPieces((cur) => [...ps, ...cur]); setAdding(false); setIncoming(null); setPastedUrl(null); setToast(`Added ${ps.length} piece${ps.length > 1 ? 's' : ''}`) }} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
