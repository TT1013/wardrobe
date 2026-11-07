import { AvatarConfig, Piece, Slot, Wearing } from './types'
import { hexToRgb, rgbToHex } from './palette'

interface Region { x: number; y: number; w: number; h: number; align: string }

// Anchor regions on the 400x880 canvas. Garment images are fit into these, then nudged per piece.
export const REGIONS: Record<Slot, Region> = {
  headwear: { x: 128, y: 4, w: 144, h: 94, align: 'xMidYMax meet' },
  top: { x: 78, y: 200, w: 244, h: 300, align: 'xMidYMin meet' },
  outer: { x: 60, y: 192, w: 280, h: 340, align: 'xMidYMin meet' },
  bottom: { x: 98, y: 440, w: 204, h: 362, align: 'xMidYMin meet' },
  shoes: { x: 96, y: 790, w: 208, h: 78, align: 'xMidYMid meet' },
  watch: { x: 62, y: 454, w: 52, h: 52, align: 'xMidYMid meet' },
  belt: { x: 112, y: 448, w: 176, h: 40, align: 'xMidYMid meet' },
  bag: { x: 270, y: 470, w: 106, h: 124, align: 'xMidYMin meet' },
}

function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex)
  const f = (v: number) => (amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)
  return rgbToHex(f(r), f(g), f(b))
}

function Garment({ piece, slot }: { piece: Piece; slot: Slot }) {
  const r = REGIONS[slot]
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  const t = `translate(${cx + piece.dx} ${cy + piece.dy}) scale(${piece.scale}) translate(${-cx} ${-cy})`

  if (slot === 'shoes') {
    if (piece.pair) {
      return <image href={piece.image} x={r.x} y={r.y} width={r.w} height={r.h} preserveAspectRatio={r.align} transform={t} />
    }
    const w = 100
    const xl = 98
    const xr = 202
    const mid = xr + w / 2
    return (
      <g transform={t}>
        <image href={piece.image} x={xl} y={r.y} width={w} height={r.h} preserveAspectRatio={r.align} />
        <g transform={`translate(${mid} 0) scale(-1 1) translate(${-mid} 0)`}>
          <image href={piece.image} x={xr} y={r.y} width={w} height={r.h} preserveAspectRatio={r.align} />
        </g>
      </g>
    )
  }
  return <image href={piece.image} x={r.x} y={r.y} width={r.w} height={r.h} preserveAspectRatio={r.align} transform={t} />
}

interface Props {
  config: AvatarConfig
  wearing: Wearing
  pieces: Piece[]
  className?: string
  showBase?: boolean
}

export function Avatar({ config, wearing, pieces, className, showBase = true }: Props) {
  const bx = config.build === 'slim' ? 0.93 : config.build === 'stocky' ? 1.1 : 1
  const skin = config.skin
  const skinD = shade(skin, -0.12)
  const hair = config.hair
  const get = (s: Slot) => (wearing[s] ? pieces.find((p) => p.id === wearing[s]) : undefined)
  const buildT = `translate(200 0) scale(${bx} 1) translate(-200 0)`
  const base = '#c9ccd1'

  const order: Slot[] = ['bottom', 'shoes', 'belt', 'top', 'outer', 'bag', 'watch']

  return (
    <svg viewBox="0 0 400 880" className={className} role="img" aria-label="TT13 avatar">
      {/* body */}
      <g transform={buildT}>
        <path d={`M156 480 L154 790`} stroke={skin} strokeWidth={62} strokeLinecap="round" fill="none" />
        <path d={`M244 480 L246 790`} stroke={skin} strokeWidth={62} strokeLinecap="round" fill="none" />
        <ellipse cx={148} cy={818} rx={38} ry={17} fill={skin} />
        <ellipse cx={252} cy={818} rx={38} ry={17} fill={skin} />
        <path d="M122 212 Q200 196 278 212 L286 300 Q284 400 280 472 L120 472 Q116 400 114 300 Z" fill={skin} />
        <path d="M124 238 Q96 340 92 450" stroke={skin} strokeWidth={38} strokeLinecap="round" fill="none" />
        <path d="M276 238 Q304 340 308 450" stroke={skin} strokeWidth={38} strokeLinecap="round" fill="none" />
        <circle cx={91} cy={480} r={20} fill={skin} />
        <circle cx={309} cy={480} r={20} fill={skin} />
        {showBase && !get('top') && !get('outer') && (
          <path d="M118 212 Q200 196 282 212 L318 300 L286 322 L282 472 L118 472 L114 322 L82 300 Z" fill={base} stroke={base} strokeWidth={6} strokeLinejoin="round" opacity={0.85} />
        )}
        {showBase && !get('bottom') && (
          <path d="M116 464 L284 464 L290 610 L206 610 L200 548 L194 610 L110 610 Z" fill={base} stroke={base} strokeWidth={6} strokeLinejoin="round" opacity={0.85} />
        )}
      </g>

      {/* head */}
      <rect x={180} y={150} width={40} height={60} rx={14} fill={skinD} />
      <ellipse cx={142} cy={112} rx={11} ry={15} fill={skinD} />
      <ellipse cx={258} cy={112} rx={11} ry={15} fill={skinD} />
      <ellipse cx={200} cy={106} rx={59} ry={68} fill={skin} />
      <path d="M141 100 C136 44 170 26 200 26 C232 26 266 46 259 100 C252 76 236 66 200 68 C166 66 148 76 141 100 Z" fill={hair} />
      <path d="M158 86 Q176 76 194 85" stroke={hair} strokeWidth={5} strokeLinecap="round" fill="none" />
      <path d="M206 85 Q224 76 242 86" stroke={hair} strokeWidth={5} strokeLinecap="round" fill="none" />
      <ellipse cx={177} cy={108} rx={6} ry={8} fill="#2b1a12" />
      <ellipse cx={223} cy={108} rx={6} ry={8} fill="#2b1a12" />
      <circle cx={179} cy={105} r={2.2} fill="#fff" />
      <circle cx={225} cy={105} r={2.2} fill="#fff" />
      <path d="M196 124 Q200 133 204 124" stroke={skinD} strokeWidth={3} strokeLinecap="round" fill="none" />
      <path d="M168 140 Q200 176 232 140 Q200 150 168 140 Z" fill="#fff" stroke="#8a3a3a" strokeWidth={3} strokeLinejoin="round" />
      {config.glasses && (
        <g fill="rgba(255,255,255,0.08)" stroke="#111" strokeWidth={6} strokeLinejoin="round">
          <rect x={150} y={91} width={46} height={34} rx={9} />
          <rect x={204} y={91} width={46} height={34} rx={9} />
          <path d="M196 102 L204 102" fill="none" />
          <path d="M150 100 L141 98 M250 100 L259 98" fill="none" strokeLinecap="round" />
        </g>
      )}

      {/* garments */}
      <g transform={buildT}>
        {order.map((slot) => {
          const p = get(slot)
          return p ? <Garment key={slot} piece={p} slot={slot} /> : null
        })}
      </g>
      {get('headwear') && <Garment piece={get('headwear')!} slot="headwear" />}
    </svg>
  )
}
