import { Fit, GarmentSpec, KINDS, KIND_SLOT, Kind, Pattern, accentLabel, hasAccent } from './garments'
import { DEFAULT_ACCENT, NAMED_COLORS } from './classify'
import { nearestPalette } from './palette'
import { SLOTS, STATUSES, Status } from './types'

export interface LabelValue {
  name: string
  brand: string
  status: Status
  spec: GarmentSpec
}

const CHOICES = NAMED_COLORS

const PATTERNS: [Pattern, string][] = [['solid', 'Solid'], ['stripe', 'Stripe'], ['check', 'Check / plaid'], ['heather', 'Heather'], ['denim', 'Denim']]
const NO_FIT: string[] = ['shoes', 'headwear', 'watch', 'belt', 'bag']

function Swatches({ value, onPick, label, id }: { value: string; onPick: (hex: string) => void; label: string; id: string }) {
  return (
    <div className="swatch-row" role="group" aria-label={label}>
      {CHOICES.map(([name, hex]) => (
        <button key={name} type="button" className={`sw-sm ${value.toLowerCase() === hex ? 'on' : ''}`} style={{ background: hex }} title={name} aria-label={name} onClick={() => onPick(hex)} />
      ))}
      <label className="sw-custom" title="Pick any color">
        <input id={id} type="color" value={value} onChange={(e) => onPick(e.target.value)} aria-label={`${label}: custom`} />
      </label>
    </div>
  )
}

export function LabelForm({ value, onChange, guessed, idPrefix }: { value: LabelValue; onChange: (patch: Partial<LabelValue>) => void; guessed?: { kind: boolean; color: boolean }; idPrefix: string }) {
  const s = value.spec
  const set = (patch: Partial<GarmentSpec>) => onChange({ spec: { ...s, ...patch } })
  const slot = KIND_SLOT[s.kind]
  const np = nearestPalette(s.color)

  return (
    <div className="label-form">
      <div className="row">
        <input id={`${idPrefix}-name`} value={value.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Name (e.g. Oxford shirt)" />
        <input id={`${idPrefix}-brand`} value={value.brand} onChange={(e) => onChange({ brand: e.target.value })} placeholder="Brand" />
      </div>

      <label className="field">
        <span>Type {guessed?.kind && <em className="check-me">check</em>}</span>
        <select id={`${idPrefix}-kind`} value={s.kind} onChange={(e) => {
          const kind = e.target.value as Kind
          set({ kind, accent: DEFAULT_ACCENT[kind] ?? (DEFAULT_ACCENT[s.kind] ? '#f4f4f1' : s.accent), pattern: kind === 'jeans' && s.pattern === 'solid' ? 'denim' : s.pattern, tucked: KIND_SLOT[kind] === 'top' ? s.tucked : false })
        }}>
          {SLOTS.map((sl) => (
            <optgroup key={sl.key} label={sl.label}>
              {KINDS.filter((k) => k.slot === sl.key).map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="field">
        <span>Color: <strong>{CHOICES.find(([, h]) => h === s.color.toLowerCase())?.[0] ?? np.name}</strong>{np.off ? <em className="off"> outside TT13 palette</em> : <em className="ok"> TT13 {np.name}</em>} {guessed?.color && <em className="check-me">check</em>}</span>
        <Swatches id={`${idPrefix}-color`} label="Main color" value={s.color} onPick={(color) => set({ color })} />
      </div>

      <div className="row">
        <label className="field grow">
          <span>Pattern</span>
          <select id={`${idPrefix}-pattern`} value={s.pattern} onChange={(e) => set({ pattern: e.target.value as Pattern })}>
            {PATTERNS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {!NO_FIT.includes(slot) && (
          <label className="field grow">
            <span>Fit</span>
            <select id={`${idPrefix}-fit`} value={s.fit} onChange={(e) => set({ fit: e.target.value as Fit })}>
              <option value="slim">Slim</option>
              <option value="regular">Regular</option>
              <option value="relaxed">Relaxed</option>
            </select>
          </label>
        )}
        <label className="field grow">
          <span>Status</span>
          <select id={`${idPrefix}-status`} value={value.status} onChange={(e) => onChange({ status: e.target.value as Status })}>
            {STATUSES.map((st) => <option key={st}>{st}</option>)}
          </select>
        </label>
      </div>

      {hasAccent(s) && (
        <div className="field">
          <span>{accentLabel(s.kind)}</span>
          <Swatches id={`${idPrefix}-accent`} label={accentLabel(s.kind)} value={s.accent} onPick={(accent) => set({ accent })} />
        </div>
      )}
      {slot === 'top' && (
        <label className="check"><input id={`${idPrefix}-tucked`} type="checkbox" checked={s.tucked} onChange={(e) => set({ tucked: e.target.checked })} /> Tucked in</label>
      )}
    </div>
  )
}
