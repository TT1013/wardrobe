// Renders test outfits to one SVG grid for visual review: node scripts/preview.mjs out.svg
import { writeFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { Avatar } from '../src/Avatar'
import type { GarmentSpec, Kind } from '../src/garments'
import { DEFAULT_AVATAR, Piece, Slot, Wearing } from '../src/types'
import { KIND_SLOT } from '../src/garments'

let n = 0
function piece(kind: Kind, color: string, extra: Partial<GarmentSpec> = {}): Piece {
  const spec: GarmentSpec = { kind, color, accent: '#f4f4f1', pattern: 'solid', fit: 'regular', tucked: false, ...extra }
  return { id: `p${n++}`, name: kind, brand: '', slot: KIND_SLOT[kind], status: 'owned', spec, image: '', colors: [color], palette: '', offPalette: false, sourceUrl: '', notes: '', createdAt: 0 }
}

const outfits: Piece[][] = [
  [piece('oxford', '#a9c7e8'), piece('crew-sweater', '#1b2a49'), piece('chinos', '#d8c7a8'), piece('loafers', '#6b4a35', { accent: '#3a2a20' })],
  [piece('polo', '#f4f4f1'), piece('cardigan', '#3b3e43'), piece('jeans', '#2c3e66', { pattern: 'denim', accent: '#c9a15a' }), piece('sneakers', '#f4f4f1', { accent: '#f2f2ef' })],
  [piece('tee', '#f4f4f1'), piece('chore', '#5b5e3a'), piece('trousers', '#141416'), piece('boots', '#6b4a35', { accent: '#3a2a20' })],
  [piece('oxford', '#f4f4f1', { tucked: true }), piece('blazer', '#1b2a49'), piece('trousers', '#8a8d92'), piece('derbies', '#141416', { accent: '#3a2a20' }), piece('belt', '#6b4a35', { accent: '#c9ccd0' }), piece('watch', '#141416', { accent: '#c9ccd0' })],
  [piece('hoodie', '#8a8d92', { pattern: 'heather' }), piece('bomber', '#141416'), piece('joggers', '#1b2a49'), piece('runners', '#141416', { accent: '#f2f2ef' }), piece('cap', '#1b2a49')],
  [piece('longsleeve-tee', '#ece6d6'), piece('quarter-zip', '#1b2a49'), piece('overcoat', '#b88a5a'), piece('jeans', '#a9c7e8', { pattern: 'denim', accent: '#c9a15a' }), piece('sneakers', '#141416', { accent: '#f2f2ef' }), piece('crossbody', '#141416')],
]

const pick = process.argv[3] === 'b' ? outfits.slice(3) : outfits.slice(0, 3)
const cells = pick.map((ps, i) => {
  const wearing: Wearing = {}
  for (const p of ps) wearing[p.slot as Slot] = p.id
  const svg = renderToStaticMarkup(<Avatar config={DEFAULT_AVATAR} wearing={wearing} pieces={ps} />)
  const x = i * 440 + 20, y = 0
  return svg.replace('<svg ', `<svg x="${x}" y="${y}" width="400" height="880" `)
})
const W = 1340
writeFileSync(process.argv[2] ?? 'preview.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}"><rect width="100%" height="100%" fill="#d9dbde"/>${cells.join('')}</svg>`)
