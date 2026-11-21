import { DEFAULT_KIND, Fit, GarmentSpec, KIND_SLOT, Kind, Pattern } from './garments'
import { nearestPalette } from './palette'
import type { Piece, Slot } from './types'

// Turns product text (title, color field, category, URL) into a garment label. Deterministic and free:
// retail titles are structured ("Slim Fit Oxford Shirt - White"), so keyword rules get most of the way,
// and every guess is shown to the user to confirm.

export interface ProductText {
  title: string
  color?: string // the store's own color field, when known
  description?: string
  category?: string
  url?: string
  slotHint?: Slot | 'all'
}

export interface Classified {
  spec: GarmentSpec
  colorName: string
  guessed: { kind: boolean; color: boolean } // true = no evidence found, a default was used
}

/* ---------- Colors ---------- */

const COLORS: [string, string, string][] = [
  // [pattern, display name, hex]
  ['off[ -]?white|ecru|cream|ivory|bone|natural|oatmeal|vanilla', 'Off-white', '#ece6d6'],
  ['optic white|bright white|white', 'White', '#f4f4f1'],
  ['jet black|true black|onyx|black', 'Black', '#141416'],
  ['dark navy|midnight|navy|ink', 'Navy', '#1b2a49'],
  ['indigo|dark wash|rinse|raw denim', 'Indigo', '#2c3e66'],
  ['light blue|sky blue|sky|pale blue|powder blue|baby blue|oxford blue|chambray|cornflower|light wash', 'Light Blue', '#a9c7e8'],
  ['medium wash|mid wash|royal blue|cobalt|blue', 'Blue', '#3a5f9a'],
  ['charcoal|graphite|slate|dark gr[ae]y|carbon|anthracite', 'Charcoal', '#3b3e43'],
  ['light gr[ae]y|silver|ash|pebble|fog|cloud|pale gr[ae]y', 'Light Grey', '#c9ccd0'],
  ['heather gr[ae]y|gr[ae]y heather|marl|gr[ae]y', 'Grey', '#8a8d92'],
  ['camel|cognac|caramel|tobacco', 'Camel', '#b88a5a'],
  ['khaki|stone|sand|beige|tan|taupe|oat|biscuit|dune|wheat|almond|putty|desert', 'Beige', '#d8c7a8'],
  ['brown|chocolate|espresso|walnut|mocha|coffee', 'Brown', '#6b4a35'],
  ['olive|army|military|moss|fatigue', 'Olive', '#5b5e3a'],
  ['sage|eucalyptus|mint', 'Sage', '#9aa58a'],
  ['forest|hunter|bottle green|dark green|green', 'Green', '#2f5d45'],
  ['burgundy|maroon|wine|oxblood|bordeaux', 'Burgundy', '#6b1f2a'],
  ['red|crimson|scarlet', 'Red', '#b3262e'],
  ['pink|rose|blush', 'Pink', '#e7a8b4'],
  ['mustard|yellow|gold', 'Yellow', '#d9b23d'],
  ['rust|orange|terracotta', 'Orange', '#c4622d'],
  ['lavender|lilac|purple|plum', 'Purple', '#8a72b0'],
]

/** Named colors for the pickers: TT13 palette first, then everything the labeler can name. */
export const NAMED_COLORS: [string, string][] = (() => {
  const first = ['Black', 'Navy', 'White', 'Light Blue', 'Beige', 'Grey']
  const all: [string, string][] = COLORS.map(([, name, hex]) => [name, hex])
  return [...first.map((n) => all.find(([m]) => m === n)!), ...all.filter(([n]) => !first.includes(n)), ['Silver', '#c9ccd0'], ['Gum', '#a8774a']]
})()

/** "Men's Oxford Slim Shirt | UNIQLO US" -> "Oxford Slim Shirt" */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s+[|–—]\s+[^|–—]*$/, '')
    .replace(/^\s*(men'?s|mens|unisex|women'?s)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const COLOR_RES = COLORS.map(([pat, name, hex]) => ({ re: new RegExp(`\\b(?:${pat})\\b`, 'gi'), name, hex }))

/** All color mentions in a text, in reading order, without overlaps ("light blue" wins over "blue"). */
export function findColors(text: string): { name: string; hex: string; at: number; sole: boolean }[] {
  const hits: { name: string; hex: string; at: number; end: number; sole: boolean }[] = []
  for (const c of COLOR_RES) {
    for (const m of text.matchAll(c.re)) {
      const at = m.index ?? 0
      const end = at + m[0].length
      if (hits.some((h) => at < h.end && end > h.at)) continue
      // Longer matches win: drop shorter hits this one contains.
      for (let i = hits.length - 1; i >= 0; i--) if (hits[i].at >= at && hits[i].end <= end) hits.splice(i, 1)
      hits.push({ name: c.name, hex: c.hex, at, end, sole: /^\s*sole/i.test(text.slice(end, end + 8)) })
    }
  }
  return hits.sort((a, b) => a.at - b.at)
}

/* ---------- Garment type ---------- */

const KIND_RULES: [RegExp, Kind][] = [
  [/\b(beanie|toque|watch cap)\b/, 'beanie'],
  [/\bbucket hat\b/, 'bucket'],
  [/\b(baseball cap|dad hat|snapback|cap|hat)\b/, 'cap'],
  [/\b(chore|overshirt|shacket|shirt jacket|trucker|denim jacket|jean jacket|work jacket|field jacket|utility jacket)\b/, 'chore'],
  [/\b(blazer|sport coat|sports coat|suit jacket)\b/, 'blazer'],
  [/\b(puffer|down jacket|quilted|parka|gilet)\b/, 'puffer'],
  [/\b(overcoat|topcoat|trench|peacoat|pea coat|car coat|wool coat|coat)\b/, 'overcoat'],
  [/\b(bomber|harrington|windbreaker|anorak|track jacket|coach jacket|jacket)\b/, 'bomber'],
  [/\b(loafers?|penny|moccasins?)\b/, 'loafers'],
  [/\b(boots?|chelsea|chukka)\b/, 'boots'],
  [/\b(derbys?|derbies|brogues?|dress shoes?|oxford shoes?)\b/, 'derbies'],
  [/\b(runners?|running shoes?|running)\b/, 'runners'],
  [/\b(sneakers?|trainers?|plimsolls?|shoes?|kicks)\b/, 'sneakers'],
  [/\bshorts\b/, 'shorts'],
  [/\b(jogger|joggers|sweatpants?|track pants?|lounge pants?)\b/, 'joggers'],
  [/\b(jeans?|denim)\b/, 'jeans'],
  [/\b(chinos?|khakis)\b/, 'chinos'],
  [/\b(trousers?|pants?|slacks)\b/, 'trousers'],
  [/\blong[- ]sleeve polo\b/, 'polo-ls'],
  [/\bpolo\b/, 'polo'],
  [/\b(long[- ]sleeve (t[- ]?shirt|tee)|ls tee)\b/, 'longsleeve-tee'],
  [/\b(t[- ]?shirt|tee)\b/, 'tee'],
  [/\bhenley\b/, 'henley'],
  [/\bcardigan\b/, 'cardigan'],
  [/\b(quarter[- ]?zip|half[- ]?zip|1\/4[- ]?zip|mock neck|mockneck)\b/, 'quarter-zip'],
  [/\b(hoodie|hooded|hoody)\b/, 'hoodie'],
  [/\b(sweater vest|knit vest|vest)\b/, 'sweater-vest'],
  [/\b(sweatshirt|crewneck sweatshirt|fleece)\b/, 'sweatshirt'],
  [/\bv[- ]?neck (sweater|jumper|knit|pullover|cashmere|merino)\b/, 'v-sweater'],
  [/\b(sweater|jumper|pullover|knit|knitwear|cashmere|merino|lambswool)\b/, 'crew-sweater'],
  [/\b(short[- ]sleeve|camp collar|resort|cuban)\b.*\bshirt\b/, 'ss-shirt'],
  [/\b(shirt|oxford|button[- ]?(down|up)|flannel|chambray|poplin|dress shirt)\b/, 'oxford'],
  [/\b(watch|chronograph)\b/, 'watch'],
  [/\bbelt\b/, 'belt'],
  [/\b(backpack|rucksack)\b/, 'backpack'],
  [/\btote\b/, 'tote'],
  [/\b(bag|crossbody|sling|messenger|satchel)\b/, 'crossbody'],
]

function findKind(text: string): Kind | null {
  for (const [re, k] of KIND_RULES) if (re.test(text)) return k
  return null
}

function findFit(text: string): Fit {
  if (/\b(slim|skinny|tailored|fitted|tapered|athletic)\b/.test(text)) return 'slim'
  if (/\b(relaxed|oversized|loose|boxy|wide|baggy|easy|roomy)\b/.test(text)) return 'relaxed'
  return 'regular'
}

function findPattern(text: string, kind: Kind): Pattern {
  if (/\b(stripes?|striped|breton|pinstripe|rugby)\b/.test(text)) return 'stripe'
  if (/\b(check|checked|plaid|gingham|tartan|houndstooth|buffalo)\b/.test(text)) return 'check'
  if (kind === 'jeans' || /\bdenim\b/.test(text)) return 'denim'
  if (/\b(heather|heathered|marl|melange)\b/.test(text)) return 'heather'
  return 'solid'
}

const DEFAULT_COLOR: Partial<Record<Kind, string>> = { jeans: '#2c3e66', sneakers: '#f4f4f1', runners: '#141416' }
export const DEFAULT_ACCENT: Partial<Record<Kind, string>> = {
  sneakers: '#f2f2ef', runners: '#f2f2ef', loafers: '#3a2a20', derbies: '#3a2a20', boots: '#3a2a20',
  watch: '#c9ccd0', belt: '#c9ccd0', jeans: '#c9a15a',
}

/** Readable text from a product URL: path words and color-ish query values, without SKU codes. */
export function textFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const words = u.pathname
      .split(/[/._-]+/)
      .filter((w) => w && !/\d/.test(w) && !/^(products?|p|shop|en|us|men|mens|html?|item|collections?|dp)$/i.test(w))
    for (const [k, v] of u.searchParams) if (/colou?r|variant_name/i.test(k) && !/^\d+$/.test(v)) words.push(v)
    return words.join(' ')
  } catch {
    return ''
  }
}

export function brandFromUrl(url: string): string {
  try {
    const parts = new URL(url).hostname.replace(/^(www|shop|store|us|en)\./, '').split('.')
    const name = parts.length > 1 ? parts[parts.length - 2] : parts[0]
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return ''
  }
}

const norm = (s?: string) => (s ?? '').toLowerCase().replace(/[_]+/g, ' ').replace(/’/g, "'")

export function classify(t: ProductText): Classified {
  const title = norm(t.title)
  const urlText = norm(t.url ? textFromUrl(t.url) : '')
  const typeText = `${title} ${norm(t.category)} ${urlText}`

  let kind = findKind(typeText)
  const kindGuessed = !kind
  if (!kind) kind = t.slotHint && t.slotHint !== 'all' ? DEFAULT_KIND[t.slotHint] : 'tee'

  // Color evidence, best source first: the store's color field, then the title, then the URL, then the description.
  let found = findColors(norm(t.color))
  if (!found.length) found = findColors(title)
  if (!found.length) found = findColors(urlText)
  if (!found.length) found = findColors(norm(t.description).slice(0, 300))
  const main = found.find((f) => !f.sole) ?? found[0]
  const second = found.find((f) => f !== main && f.hex !== main?.hex)

  const pattern = findPattern(`${title} ${norm(t.color)}`, kind)
  const color = main?.hex ?? DEFAULT_COLOR[kind] ?? '#8a8d92'
  const accent = second?.hex ?? DEFAULT_ACCENT[kind] ?? (nearestPalette(color).name === 'White' ? '#1b2a49' : '#f4f4f1')

  return {
    spec: { kind, color, accent, pattern, fit: findFit(`${title} ${norm(t.description).slice(0, 300)}`), tucked: false },
    colorName: main?.name ?? '',
    guessed: { kind: kindGuessed, color: !main },
  }
}

/** Pieces saved before garments were drawn from labels get a label from their name and sampled color. */
export function ensureSpec(p: Piece): Piece {
  if (p.spec && KIND_SLOT[p.spec.kind]) return p
  const c = classify({ title: p.name, slotHint: p.slot })
  const spec = { ...c.spec }
  if (KIND_SLOT[spec.kind] !== p.slot) spec.kind = DEFAULT_KIND[p.slot]
  if (c.guessed.color && p.colors?.[0]) spec.color = p.colors[0]
  return { ...p, spec }
}
