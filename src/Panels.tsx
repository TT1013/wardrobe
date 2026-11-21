import { useRef, useState } from 'react'
import { Avatar } from './Avatar'
import { GarmentThumb } from './GarmentArt'
import { KIND_LABEL } from './garments'
import { LabelForm } from './LabelForm'
import { PALETTE, paletteHex } from './palette'
import {
  AvatarConfig, Build, OCCASIONS, Occasion, Outfit, Piece, SLOTS, SLOT_LABEL, STATUSES, Slot, Status, Wearing,
} from './types'

/* ---------- Closet ---------- */

export function Closet(props: {
  pieces: Piece[]
  wearing: Wearing
  slotFilter: Slot | 'all'
  setSlotFilter: (s: Slot | 'all') => void
  onWear: (p: Piece) => void
  onEdit: (p: Piece) => void
  onAdd: () => void
}) {
  const { pieces, wearing, slotFilter, setSlotFilter, onWear, onEdit, onAdd } = props
  const [status, setStatus] = useState<Status | 'all'>('all')
  const shown = pieces.filter((p) => (slotFilter === 'all' || p.slot === slotFilter) && (status === 'all' || p.status === status))

  return (
    <div>
      <div className="palette-strip" title="TT13 palette">
        {PALETTE.map((p) => (
          <div key={p.name} className="pal">
            <span className="pal-dot" style={{ background: p.hex }} />
            <span>{p.name}</span>
          </div>
        ))}
      </div>
      <div className="chips">
        <button className={`chip ${slotFilter === 'all' ? 'on' : ''}`} onClick={() => setSlotFilter('all')}>All</button>
        {SLOTS.map((s) => (
          <button key={s.key} className={`chip ${slotFilter === s.key ? 'on' : ''}`} onClick={() => setSlotFilter(s.key)}>{s.label}</button>
        ))}
      </div>
      <div className="chips">
        {(['all', ...STATUSES] as const).map((s) => (
          <button key={s} className={`chip small ${status === s ? 'on' : ''}`} onClick={() => setStatus(s)}>{s}</button>
        ))}
        <button className="primary add-btn" onClick={onAdd}>+ Add pieces</button>
      </div>
      {pieces.length === 0 ? (
        <div className="empty">
          <h3>Your closet is empty</h3>
          <p>Add pieces by dropping product images, pasting from the clipboard, or taking a photo. You can add many at once.</p>
          <button className="primary" onClick={onAdd}>+ Add pieces</button>
        </div>
      ) : shown.length === 0 ? (
        <p className="muted">Nothing matches this filter.</p>
      ) : (
        <div className="grid-cards">
          {shown.map((p) => (
            <div key={p.id} className={`card ${wearing[p.slot] === p.id ? 'worn' : ''}`}>
              <button className="card-img" onClick={() => onWear(p)} aria-label={`Wear ${p.name}`}>
                <GarmentThumb p={p} className="card-art" />
                {(p.image || p.photoUrl) && <img className="card-photo" src={p.image || p.photoUrl} alt="" referrerPolicy="no-referrer" />}
                {p.status !== 'owned' && <span className="badge">{p.status}</span>}
              </button>
              <div className="card-meta">
                <div className="card-name" title={p.name}>{p.name}</div>
                <div className="card-sub">
                  <span className="dot" style={{ background: p.spec.color }} />
                  <span className={p.offPalette ? 'off' : ''}>{p.offPalette ? `~${p.palette}` : p.palette}</span>
                  <span className="muted"> · {p.brand || KIND_LABEL[p.spec.kind]}</span>
                </div>
              </div>
              <button className="icon-btn edit" onClick={() => onEdit(p)} aria-label="Edit">✎</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- Piece editor (label, details) ---------- */

export function PieceEditor({ piece, onChange, onDelete, onClose }: { piece: Piece; onChange: (patch: Partial<Piece>) => void; onDelete: () => void; onClose: () => void }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="editor">
      <div className="modal-head">
        <h2>Edit piece</h2>
        <button className="primary" onClick={onClose}>Done</button>
      </div>
      <div className="editor-top">
        <div className="draft-preview">
          <div className="draft-art"><GarmentThumb p={piece} /></div>
          {(piece.image || piece.photoUrl) && <img className="ref-photo" src={piece.image || piece.photoUrl} alt="Store photo" referrerPolicy="no-referrer" />}
        </div>
        <LabelForm idPrefix={`e-${piece.id}`} value={piece} onChange={(patch) => onChange(patch)} />
      </div>
      <input id="edit-source" value={piece.sourceUrl} onChange={(e) => onChange({ sourceUrl: e.target.value })} placeholder="Product link" />
      {piece.sourceUrl && /^https?:/.test(piece.sourceUrl) && <a className="small" href={piece.sourceUrl} target="_blank" rel="noreferrer">Open product page</a>}
      <textarea id="edit-notes" value={piece.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Notes" rows={2} />
      {confirming ? (
        <div className="row">
          <span className="small">Delete "{piece.name}"? It also leaves any saved outfits.</span>
          <button className="danger" onClick={onDelete}>Delete</button>
          <button onClick={() => setConfirming(false)}>Keep</button>
        </div>
      ) : (
        <button className="danger" onClick={() => setConfirming(true)}>Delete piece</button>
      )}
    </div>
  )
}

/* ---------- Outfits ---------- */

export function Outfits(props: {
  outfits: Outfit[]
  pieces: Piece[]
  avatar: AvatarConfig
  wearing: Wearing
  onSave: (name: string, occasion: Occasion) => void
  onApply: (o: Outfit) => void
  onDelete: (id: string) => void
}) {
  const { outfits, pieces, avatar, wearing, onSave, onApply, onDelete } = props
  const [name, setName] = useState('')
  const [occasion, setOccasion] = useState<Occasion>('Work')
  const [filter, setFilter] = useState<Occasion | 'all'>('all')
  const hasAny = Object.keys(wearing).length > 0
  const shown = outfits.filter((o) => filter === 'all' || o.occasion === filter)

  return (
    <div>
      <div className="save-box">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this outfit" />
        <select value={occasion} onChange={(e) => setOccasion(e.target.value as Occasion)}>
          {OCCASIONS.map((o) => <option key={o}>{o}</option>)}
        </select>
        <button className="primary" disabled={!hasAny} onClick={() => { onSave(name.trim() || `Outfit ${outfits.length + 1}`, occasion); setName('') }}>Save current</button>
      </div>
      {!hasAny && <p className="muted small">Dress the avatar first, then save the look.</p>}
      <div className="chips">
        {(['all', ...OCCASIONS] as const).map((o) => (
          <button key={o} className={`chip small ${filter === o ? 'on' : ''}`} onClick={() => setFilter(o)}>{o}</button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="muted">No saved outfits yet.</p>
      ) : (
        <div className="grid-cards">
          {shown.map((o) => (
            <div key={o.id} className="card">
              <button className="card-img stage-thumb" onClick={() => onApply(o)} aria-label={`Wear ${o.name}`}>
                <Avatar config={avatar} wearing={o.items} pieces={pieces} showBase={false} />
              </button>
              <div className="card-meta">
                <div className="card-name">{o.name}</div>
                <div className="card-sub muted">{o.occasion}</div>
              </div>
              <button className="icon-btn edit" onClick={() => { if (confirm(`Delete outfit "${o.name}"?`)) onDelete(o.id) }} aria-label="Delete">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- Avatar settings ---------- */

const SKINS = ['#f3d2b8', '#e9b996', '#e2a67e', '#c68a62', '#9a6544', '#6b4330']
const HAIRS = ['#14100e', '#2a1f1a', '#4a3324', '#7a5436', '#b08a56', '#8a8d92']

export function AvatarPanel({ avatar, setAvatar }: { avatar: AvatarConfig; setAvatar: (a: AvatarConfig) => void }) {
  return (
    <div>
      <h4>Skin tone</h4>
      <div className="swatches">{SKINS.map((c) => <button key={c} className={`sw ${avatar.skin === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setAvatar({ ...avatar, skin: c })} aria-label={c} />)}</div>
      <h4>Hair</h4>
      <div className="swatches">{HAIRS.map((c) => <button key={c} className={`sw ${avatar.hair === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setAvatar({ ...avatar, hair: c })} aria-label={c} />)}</div>
      <h4>Build</h4>
      <div className="chips">
        {(['slim', 'average', 'stocky'] as Build[]).map((b) => <button key={b} className={`chip ${avatar.build === b ? 'on' : ''}`} onClick={() => setAvatar({ ...avatar, build: b })}>{b}</button>)}
      </div>
      <label className="check"><input type="checkbox" checked={avatar.glasses} onChange={(e) => setAvatar({ ...avatar, glasses: e.target.checked })} /> Glasses</label>
      <p className="muted small">Default character: 5'8", 175 lb, modeled on the TT13Works avatar. Height is fixed in v1; build changes the body width.</p>
    </div>
  )
}

/* ---------- Data ---------- */

export function DataPanel({ onExport, onImport, onReset, counts }: { onExport: () => void; onImport: (text: string) => void; onReset: () => void; counts: string }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="data">
      <p className="muted">Everything lives in this browser only: nothing is uploaded. {counts}</p>
      <button onClick={onExport}>Export backup (JSON)</button>
      <button onClick={() => ref.current?.click()}>Import backup</button>
      <input ref={ref} type="file" accept="application/json,.json" hidden onChange={async (e) => {
        const f = e.target.files?.[0]
        if (f) onImport(await f.text())
        e.target.value = ''
      }} />
      <button className="danger" onClick={() => { if (confirm('Erase all pieces, outfits and avatar settings from this browser?')) onReset() }}>Erase everything</button>
    </div>
  )
}

export { paletteHex }
