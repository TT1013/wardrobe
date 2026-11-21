import type { ReactElement } from 'react'
import { PatternDef, garmentParts } from './GarmentArt'
import { shade } from './palette'
import { AvatarConfig, Piece, Slot, Wearing } from './types'

interface Props {
  config: AvatarConfig
  wearing: Wearing
  pieces: Piece[]
  className?: string
  showBase?: boolean
  animate?: boolean
}

export function Avatar({ config, wearing, pieces, className, showBase = true, animate = false }: Props) {
  const bx = config.build === 'slim' ? 0.93 : config.build === 'stocky' ? 1.1 : 1
  const skin = config.skin
  const skinD = shade(skin, -0.12)
  const hair = config.hair
  const get = (s: Slot) => (wearing[s] ? pieces.find((p) => p.id === wearing[s] && p.spec) : undefined)
  const buildT = `translate(200 0) scale(${bx} 1) translate(-200 0)`
  const base = '#c9ccd1'

  const top = get('top'), mid = get('mid'), outer = get('outer')
  const parts = (p?: Piece) => (p ? garmentParts(p) : undefined)
  const topP = parts(top), midP = parts(mid), outerP = parts(outer)
  const tucked = !!top?.spec.tucked
  const shadow = (el: ReactElement | undefined, key: string) => el && <g key={key} filter="url(#layer-shadow)">{el}</g>

  // Back to front. A tucked shirt goes under the trousers; a shirt collar lies over a sweater's neckline.
  const stack: (ReactElement | undefined)[] = [
    tucked ? topP?.body : undefined,
    parts(get('shoes'))?.body,
    parts(get('bottom'))?.body,
    parts(get('belt'))?.body,
    !tucked ? topP?.body : undefined,
    midP ? shadow(midP.body, 'mid') : undefined,
    topP?.collar,
    outerP ? shadow(outerP.body, 'outer') : undefined,
    parts(get('bag'))?.body,
    parts(get('watch'))?.body,
  ]
  const worn = pieces.filter((p) => p.spec && Object.values(wearing).includes(p.id))

  return (
    <svg viewBox="0 0 400 880" className={className} role="img" aria-label="TT13 avatar">
      <defs>
        <filter id="layer-shadow" x="-10%" y="-10%" width="120%" height="125%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" floodColor="#000" floodOpacity="0.25" />
        </filter>
        {worn.map((p) => <PatternDef key={p.id} p={p} />)}
      </defs>
      <g className={animate ? 'breathe' : undefined}>
        {/* body */}
        <g transform={buildT}>
          <path d="M156 480 L154 790" stroke={skin} strokeWidth={62} strokeLinecap="round" fill="none" />
          <path d="M244 480 L246 790" stroke={skin} strokeWidth={62} strokeLinecap="round" fill="none" />
          <ellipse cx={148} cy={818} rx={38} ry={17} fill={skin} />
          <ellipse cx={252} cy={818} rx={38} ry={17} fill={skin} />
          <path d="M122 212 Q200 196 278 212 L286 300 Q284 400 280 472 L120 472 Q116 400 114 300 Z" fill={skin} />
          <path d="M124 238 Q96 340 92 450" stroke={skin} strokeWidth={38} strokeLinecap="round" fill="none" />
          <path d="M276 238 Q304 340 308 450" stroke={skin} strokeWidth={38} strokeLinecap="round" fill="none" />
          <circle cx={91} cy={480} r={20} fill={skin} />
          <circle cx={309} cy={480} r={20} fill={skin} />
          {showBase && !top && !mid && !outer && (
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

        {/* clothes */}
        <g transform={buildT}>{stack.map((el, i) => el && <g key={i}>{el}</g>)}</g>
        {parts(get('headwear'))?.body}
      </g>
    </svg>
  )
}
