import type { ReactElement } from 'react'
import { GarmentSpec, KIND_SLOT } from './garments'
import { luminance, shade } from './palette'
import { ARM, LEG, Pt, across, armW, armhole, at, handPoint, limb, mx, panel, tangent, torso } from './rig'

// Garments drawn on the shared rig (rig.ts). Layer depth sets how far a garment sits off the body:
// shirts 2, sweaters 6, jackets 11, so every layer wraps the one beneath it. Each garment's pieces
// (sleeves, body, collar) are drawn in two passes so they merge into a single outlined silhouette,
// and one light direction (from the viewer's left) shades every layer.

export interface Drawable { id: string; spec: GarmentSpec }
export interface Parts { body: ReactElement; collar?: ReactElement }

type Shape = { d: string; t?: string }
const MIRROR = 'translate(400 0) scale(-1 1)'
const OUTLINE = 4.4

const edge = (hex: string) => (luminance(hex) < 0.2 ? shade(hex, 0.3) : shade(hex, -0.34))
const detail = (hex: string) => (luminance(hex) < 0.25 ? shade(hex, 0.32) : shade(hex, -0.24))
const fillOf = (p: Drawable) => (p.spec.pattern === 'solid' ? p.spec.color : `url(#pat-${p.id})`)
const pts = (list: Pt[]) => list.map(([x, y]) => `${x},${y}`).join(' ')
const both = (d: string): Shape[] => [{ d }, { d, t: MIRROR }]

/** Shared defs every SVG that draws garments needs once. */
export function SharedDefs() {
  return (
    <>
      <linearGradient id="light" gradientUnits="userSpaceOnUse" x1="70" x2="330" y1="0" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.2" />
      </linearGradient>
      <linearGradient id="shade" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0.08" />
        <stop offset="0.42" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.12" />
      </linearGradient>
      <filter id="layer-shadow" x="-10%" y="-10%" width="120%" height="125%">
        <feDropShadow dx="1" dy="2.5" stdDeviation="2.2" floodColor="#000" floodOpacity="0.22" />
      </filter>
    </>
  )
}

export function PatternDef({ p }: { p: Drawable }) {
  const { pattern, color, accent } = p.spec
  const id = `pat-${p.id}`
  const acc = accent || (luminance(color) > 0.6 ? '#1b2a49' : '#f4f4f1')
  switch (pattern) {
    case 'stripe':
      return <pattern id={id} patternUnits="userSpaceOnUse" width="10" height="13"><rect width="10" height="13" fill={color} /><rect width="10" height="4.5" fill={acc} /></pattern>
    case 'check':
      return <pattern id={id} patternUnits="userSpaceOnUse" width="24" height="24"><rect width="24" height="24" fill={color} /><rect width="24" height="9" fill={acc} opacity="0.5" /><rect width="9" height="24" fill={acc} opacity="0.5" /></pattern>
    case 'heather':
      return <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="6"><rect width="6" height="6" fill={color} /><circle cx="1.5" cy="1.5" r="0.9" fill={shade(color, 0.2)} /><circle cx="4.5" cy="4.2" r="0.9" fill={shade(color, -0.15)} /></pattern>
    case 'denim':
      return <pattern id={id} patternUnits="userSpaceOnUse" width="5" height="5"><rect width="5" height="5" fill={color} /><path d="M0 5 L5 0" stroke={shade(color, 0.16)} strokeWidth="1" /></pattern>
    default:
      return null
  }
}

/** One garment silhouette: outline pass, fill pass, light pass. */
let clipSeq = 0
function Cloth({ shapes, fill, line, flat }: { shapes: Shape[]; fill: string; line: string; flat?: boolean }) {
  // One light pass over the whole silhouette, so sleeves, body and legs are lit as one garment.
  const cid = `cl-${(clipSeq = (clipSeq + 1) % 1e9)}`
  return (
    <>
      {shapes.map((s, i) => <path key={`o${i}`} d={s.d} transform={s.t} fill={line} stroke={line} strokeWidth={OUTLINE} strokeLinejoin="round" />)}
      {shapes.map((s, i) => <path key={`f${i}`} d={s.d} transform={s.t} fill={fill} />)}
      {!flat && (
        <>
          <clipPath id={cid}>{shapes.map((s, i) => <path key={i} d={s.d} transform={s.t} />)}</clipPath>
          <rect x={0} y={0} width={400} height={880} fill="url(#light)" clipPath={`url(#${cid})`} />
        </>
      )}
    </>
  )
}

function Buttons({ x, from, to, n, color }: { x: number; from: number; to: number; n: number; color: string }) {
  return <>{Array.from({ length: n }, (_, i) => <circle key={i} cx={x} cy={from + ((to - from) * i) / Math.max(1, n - 1)} r={2.6} fill={color} />)}</>
}

const sleeves = (t1: number, ease: number) => both(limb(ARM, 0, t1, (t) => armW(t) + ease))
const cuffs = (t0: number, t1: number, ease: number) => both(limb(ARM, t0, t1, (t) => armW(t) + ease + 1))
const fitD = (fit: GarmentSpec['fit']) => (fit === 'slim' ? -2 : fit === 'relaxed' ? 5 : 0)

export function garmentParts(p: Drawable): Parts {
  const s = p.spec
  const fill = fillOf(p)
  const line = edge(s.color)
  const dark = shade(s.color, -0.13)
  const det = detail(s.color)
  const fd = fitD(s.fit)
  const seam = (d: number) => <path d={`${armhole(d)} ${armhole(d, true)}`} stroke={line} strokeWidth={1.3} fill="none" opacity={0.55} />

  switch (s.kind) {
    /* ----- base layer: tees and shirts (depth 2) ----- */
    case 'tee':
    case 'longsleeve-tee':
    case 'henley': {
      const long = s.kind !== 'tee'
      const d = 2 + fd, hem = s.tucked ? 524 : 488
      const body = torso(d, hem, 2, [180, 200], 'Q200 216 180 200')
      return {
        body: (
          <g>
            <Cloth shapes={[...sleeves(long ? 1 : 0.3, long ? 7 + fd : 11 + fd), { d: body }]} fill={fill} line={line} />
            {long && <Cloth shapes={cuffs(0.93, 1, 7 + fd)} fill={dark} line={line} flat />}
            {seam(d)}
            <path d="M180 200 Q200 216 220 200" stroke={dark} strokeWidth={4} fill="none" />
            {s.kind === 'henley' && <><path d="M200 210 L200 262" stroke={det} strokeWidth={1.6} /><Buttons x={204} from={222} to={254} n={3} color={det} /></>}
          </g>
        ),
      }
    }
    case 'polo':
    case 'polo-ls':
    case 'oxford':
    case 'ss-shirt': {
      const long = s.kind === 'polo-ls' || s.kind === 'oxford'
      const polo = s.kind.startsWith('polo')
      const d = 2 + fd, hem = s.tucked ? 524 : polo ? 490 : 502
      const body = torso(d, hem, 2, [180, 199], 'L200 222 L180 199')
      const ease = long ? 7 + fd : 11 + fd
      const collarL: Pt[] = polo ? [[180, 196], [200, 213], [191, 229], [172, 207]] : [[178, 193], [200, 216], [188, 238], [165, 207]]
      return {
        body: (
          <g>
            <Cloth shapes={[...sleeves(long ? 1 : polo ? 0.33 : 0.31, ease), { d: body }]} fill={fill} line={line} />
            <Cloth shapes={long ? cuffs(0.92, 1, ease) : both(limb(ARM, polo ? 0.28 : 0.27, polo ? 0.33 : 0.31, (t) => armW(t) + ease + 1))} fill={polo ? dark : fill} line={line} flat />
            {seam(d)}
            <path d={`M200 214 L200 ${polo ? 264 : hem}`} stroke={det} strokeWidth={1.6} />
            {polo ? <Buttons x={204} from={232} to={256} n={2} color={det} /> : <Buttons x={204} from={244} to={hem - 26} n={6} color={det} />}
            {s.kind === 'oxford' && <path d="M138 262 L170 262 L170 296 Q154 302 138 296 Z" fill="none" stroke={det} strokeWidth={1.4} />}
          </g>
        ),
        collar: (
          <g>
            <Cloth shapes={[{ d: 'M180 194 Q200 184 220 194 L220 203 Q200 196 180 203 Z' }, { d: `M${pts(collarL)} Z` }, { d: `M${pts(collarL.map(mx))} Z` }]} fill={fill} line={line} />
          </g>
        ),
      }
    }

    /* ----- mid layer: knits (depth 6) ----- */
    case 'crew-sweater':
    case 'sweatshirt':
    case 'v-sweater':
    case 'hoodie':
    case 'quarter-zip': {
      const d = 6 + fd, hem = 478
      const v = s.kind === 'v-sweater', qz = s.kind === 'quarter-zip'
      const neckL: Pt = qz ? [178, 199] : [176, 203]
      const neck = v ? 'L200 270 L176 203' : qz ? 'Q200 212 178 199' : 'Q200 224 176 203'
      const body = torso(d, hem, 0, neckL, neck)
      const rib = s.kind === 'sweatshirt' || s.kind === 'hoodie' ? 16 : 12
      const ease = 12 + fd
      return {
        body: (
          <g>
            <Cloth shapes={[...sleeves(0.955, ease), { d: body }]} fill={fill} line={line} />
            <Cloth shapes={cuffs(0.88, 0.955, ease)} fill={dark} line={line} flat />
            <path d={`M${127 - d} ${hem - rib} L${273 + d} ${hem - rib} L${273 + d} ${hem} Q200 ${hem + 5} ${127 - d} ${hem} Z`} fill={dark} />
            <path d={`M${127 - d} ${hem - rib} L${273 + d} ${hem - rib}`} stroke={line} strokeWidth={1.2} opacity={0.6} />
            {seam(d)}
            {v && <path d="M176 203 L200 270 L224 203" stroke={dark} strokeWidth={7} fill="none" strokeLinejoin="round" />}
            {!v && !qz && <path d="M176 203 Q200 224 224 203" stroke={dark} strokeWidth={s.kind === 'sweatshirt' ? 9 : 7} fill="none" />}
            {qz && (
              <>
                <Cloth shapes={[{ d: 'M175 180 L225 180 L228 205 Q200 214 172 205 Z' }]} fill={fill} line={line} />
                <path d="M200 182 L200 264" stroke={det} strokeWidth={2.2} />
                <rect x={196.5} y={258} width={7} height={14} rx={2} fill={det} />
              </>
            )}
            {s.kind === 'hoodie' && (
              <>
                <Cloth shapes={[{ d: 'M146 224 Q152 196 200 194 Q248 196 254 224 Q226 204 200 210 Q174 204 146 224 Z' }]} fill={fill} line={line} />
                <path d="M190 210 L187 258 M210 210 L213 258" stroke={det} strokeWidth={2.4} strokeLinecap="round" />
                <path d="M146 392 L254 392 L266 452 L134 452 Z" fill="none" stroke={line} strokeWidth={1.6} strokeLinejoin="round" />
              </>
            )}
          </g>
        ),
      }
    }
    case 'cardigan': {
      const d = 6 + fd, hem = 478, ease = 12 + fd
      const pnl = panel(d, hem, 0, [176, 203], 197, 300)
      return {
        body: (
          <g>
            <Cloth shapes={[...sleeves(0.955, ease), { d: pnl }, { d: pnl, t: MIRROR }]} fill={fill} line={line} />
            <Cloth shapes={cuffs(0.88, 0.955, ease)} fill={dark} line={line} flat />
            <path d={`M${127 - d} ${hem - 12} L197 ${hem - 12} L197 ${hem} L${127 - d} ${hem} Z M203 ${hem - 12} L${273 + d} ${hem - 12} L${273 + d} ${hem} L203 ${hem} Z`} fill={dark} />
            <path d="M176 203 L197 300 L197 478 M224 203 L203 300 L203 478" stroke={dark} strokeWidth={6} fill="none" />
            {seam(d)}
            <Buttons x={191} from={316} to={456} n={5} color={det} />
          </g>
        ),
      }
    }
    case 'sweater-vest': {
      const hem = 478, d = 5 + fd
      const body = `M178 204 Q160 205 142 213 Q138 250 ${126 - d} 286 Q${123 - d} 380 ${127 - d} ${hem} Q200 ${hem + 5} ${273 + d} ${hem} Q${277 + d} 380 ${274 + d} 286 Q262 250 258 213 Q240 205 222 204 L200 266 Z`
      return {
        body: (
          <g>
            <Cloth shapes={[{ d: body }]} fill={fill} line={line} />
            <path d={`M${127 - d} ${hem - 12} L${273 + d} ${hem - 12} L${273 + d} ${hem} Q200 ${hem + 5} ${127 - d} ${hem} Z`} fill={dark} />
            <path d={`M178 204 L200 266 L222 204 M142 214 Q138 250 ${126 - d} 286 M258 214 Q262 250 ${274 + d} 286`} stroke={dark} strokeWidth={6} fill="none" />
          </g>
        ),
      }
    }

    /* ----- outer layer: jackets and coats (depth 11) ----- */
    case 'chore':
    case 'bomber':
    case 'blazer':
    case 'overcoat': {
      const d = 11 + fd
      const tailored = s.kind === 'blazer' || s.kind === 'overcoat'
      const hem = s.kind === 'overcoat' ? 652 : s.kind === 'blazer' ? 530 : s.kind === 'bomber' ? 502 : 516
      const flare = s.kind === 'overcoat' ? 12 : s.kind === 'blazer' ? 4 : 2
      const openY = s.kind === 'chore' ? 244 : s.kind === 'bomber' ? 214 : s.kind === 'blazer' ? 340 : 352
      const ease = (s.kind === 'bomber' ? 22 : s.kind === 'overcoat' ? 21 : 18) + fd
      const t1 = s.kind === 'overcoat' ? 0.985 : 0.97
      const pnl = panel(d, hem, flare, [178, 199], 196, openY)
      const lapel: Pt[] = [[178, 199], [148, 242], [163, 248], [155, 258], [196, openY]]
      const bigCollar: Pt[] = [[176, 194], [200, 234], [181, 256], [144, 214]]
      return {
        body: (
          <g>
            <Cloth shapes={[...sleeves(t1, ease), { d: pnl }, { d: pnl, t: MIRROR }]} fill={fill} line={line} />
            {seam(d)}
            {s.kind === 'bomber' && (
              <>
                <Cloth shapes={cuffs(0.9, t1, ease)} fill={dark} line={line} flat />
                <path d={`M${127 - d - flare} ${hem - 16} L196 ${hem - 16} L196 ${hem} L${127 - d - flare} ${hem} Z M204 ${hem - 16} L${273 + d + flare} ${hem - 16} L${273 + d + flare} ${hem} L204 ${hem} Z`} fill={dark} />
                <path d="M170 204 Q178 194 196 214 M230 204 Q222 194 204 214" stroke={dark} strokeWidth={10} fill="none" strokeLinecap="round" />
                <path d={`M196 216 L196 ${hem - 16} M204 216 L204 ${hem - 16}`} stroke={det} strokeWidth={1.6} strokeDasharray="3 3" />
              </>
            )}
            {s.kind === 'chore' && (
              <>
                <path d={`${across(ARM, 0.92, armW(0.92) + ease)} ${across(ARM, 0.92, armW(0.92) + ease, true)}`} stroke={line} strokeWidth={1.5} />
                <path d="M124 410 L170 410 L170 456 Q147 462 124 456 Z M276 410 L230 410 L230 456 Q253 462 276 456 Z" fill="none" stroke={det} strokeWidth={1.6} />
                <Buttons x={189} from={262} to={494} n={5} color={det} />
                <Cloth shapes={[{ d: `M${pts(bigCollar)} Z` }, { d: `M${pts(bigCollar.map(mx))} Z` }]} fill={fill} line={line} />
              </>
            )}
            {tailored && (
              <>
                <Cloth shapes={[{ d: `M${pts(lapel)} Z` }, { d: `M${pts(lapel.map(mx))} Z` }]} fill={shade(s.color, -0.05)} line={line} />
                <Buttons x={189} from={openY + 30} to={s.kind === 'overcoat' ? 520 : openY + 74} n={s.kind === 'overcoat' ? 3 : 2} color={det} />
                <path d={`M120 ${s.kind === 'overcoat' ? 476 : 456} L166 ${s.kind === 'overcoat' ? 476 : 456} M280 ${s.kind === 'overcoat' ? 476 : 456} L234 ${s.kind === 'overcoat' ? 476 : 456} M222 300 L252 296`} stroke={det} strokeWidth={1.8} />
              </>
            )}
          </g>
        ),
      }
    }
    case 'puffer': {
      const d = 18 + fd, hem = 500, ease = 32 + fd
      const body = torso(d, hem, 2, [178, 199], 'Q200 212 178 199')
      return {
        body: (
          <g>
            <Cloth shapes={[...sleeves(0.97, ease), { d: body }]} fill={fill} line={line} />
            {[0.22, 0.44, 0.66, 0.86].map((t) => <path key={t} d={`${across(ARM, t, armW(t) + ease)} ${across(ARM, t, armW(t) + ease, true)}`} stroke={line} strokeWidth={1.6} opacity={0.75} />)}
            {[254, 292, 330, 368, 406, 444, 482].map((y) => <path key={y} d={`M${126 - d} ${y} Q200 ${y + 7} ${274 + d} ${y}`} stroke={line} strokeWidth={1.6} fill="none" opacity={0.75} />)}
            <Cloth shapes={[{ d: 'M168 176 L232 176 L238 210 Q200 222 162 210 Z' }]} fill={fill} line={line} />
            <path d="M200 180 L200 500" stroke={det} strokeWidth={2} />
          </g>
        ),
      }
    }

    /* ----- bottoms ----- */
    case 'chinos':
    case 'jeans':
    case 'trousers':
    case 'joggers':
    case 'shorts': {
      const shorts = s.kind === 'shorts'
      const hemW = s.kind === 'joggers' ? 50 : s.fit === 'slim' ? 54 : s.fit === 'relaxed' ? 76 : 62
      const t1 = shorts ? 0.46 : 0.995
      const w = (t: number) => (shorts ? 88 + 4 * t : 86 + (hemW - 86) * Math.max(0, Math.min(1, t)))
      const hip = 'M122 460 L278 460 Q284 500 280 540 L200 566 L120 540 Q116 500 122 460 Z'
      const legs: Shape[] = [{ d: limb(LEG, -0.06, t1, w) }, { d: limb(LEG, -0.06, t1, w, true) }]
      const stitch = s.kind === 'jeans' ? s.accent : det
      const crease = (m: boolean) => { const a = at(LEG, 0.3), b = at(LEG, 0.98); const A = m ? mx(a) : a, B = m ? mx(b) : b; return `M${A[0]} ${A[1]} L${B[0]} ${B[1]}` }
      return {
        body: (
          <g>
            <Cloth shapes={[{ d: hip }, ...legs]} fill={fill} line={line} />
            <path d="M200 476 L200 552" stroke={line} strokeWidth={1.4} opacity={0.7} />
            <Cloth shapes={[{ d: 'M121 458 L279 458 L280 474 L120 474 Z' }]} fill={s.kind === 'joggers' ? dark : fill} line={line} flat />
            {s.kind === 'jeans'
              ? <path d="M128 478 Q150 498 164 476 M272 478 Q250 498 236 476" stroke={stitch} strokeWidth={1.6} fill="none" />
              : <path d="M124 478 L138 520 M276 478 L262 520" stroke={det} strokeWidth={1.6} />}
            {(s.kind === 'trousers' || s.kind === 'chinos') && !shorts && <path d={`${crease(false)} ${crease(true)}`} stroke={shade(s.color, s.kind === 'trousers' ? 0.14 : -0.08)} strokeWidth={1.3} opacity={0.75} />}
            {s.kind === 'joggers' && <Cloth shapes={[{ d: limb(LEG, 0.93, 0.995, (t) => w(t) + 1) }, { d: limb(LEG, 0.93, 0.995, (t) => w(t) + 1, true) }]} fill={dark} line={line} flat />}
          </g>
        ),
      }
    }

    /* ----- shoes ----- */
    case 'sneakers':
    case 'runners':
    case 'loafers':
    case 'derbies':
    case 'boots': {
      const low = s.kind === 'loafers' || s.kind === 'derbies' || s.kind === 'boots'
      const foot = (cx: number, flip: boolean) => {
        const upper = low
          ? `M${cx - 36} 834 Q${cx - 37} 814 ${cx - 10} 810 Q${cx + 28} 808 ${cx + 40} 824 L${cx + 40} 834 Z`
          : `M${cx - 38} 834 Q${cx - 40} 806 ${cx - 12} 802 Q${cx + 6} 800 ${cx + 20} 808 Q${cx + 41} 815 ${cx + 41} 834 Z`
        const shaft = `M${cx - 26} 772 L${cx + 22} 772 L${cx + 25} 818 L${cx - 29} 818 Z`
        const soleH = s.kind === 'runners' ? 13 : low ? 7 : 11
        return (
          <g key={cx} transform={flip ? `translate(${cx * 2} 0) scale(-1 1)` : undefined}>
            <Cloth shapes={s.kind === 'boots' ? [{ d: shaft }, { d: upper }] : [{ d: upper }]} fill={fill} line={line} />
            <rect x={cx - 41} y={831} width={84} height={soleH} rx={low ? 3 : 5} fill={s.accent} stroke={edge(s.accent)} strokeWidth={1.5} />
            {(s.kind === 'sneakers' || s.kind === 'runners' || s.kind === 'derbies') && <path d={`M${cx - 10} 812 L${cx + 2} 808 M${cx - 8} 818 L${cx + 6} 814`} stroke={det} strokeWidth={2} strokeLinecap="round" />}
            {s.kind === 'runners' && <path d={`M${cx - 28} 826 Q${cx} 814 ${cx + 30} 822`} stroke={s.accent} strokeWidth={3} fill="none" />}
            {s.kind === 'loafers' && <path d={`M${cx - 4} 814 L${cx + 20} 817`} stroke={det} strokeWidth={2.4} strokeLinecap="round" />}
          </g>
        )
      }
      return { body: <g>{foot(150, true)}{foot(250, false)}</g> }
    }

    /* ----- headwear (drawn outside the build transform) ----- */
    case 'cap':
      return {
        body: (
          <g>
            <Cloth shapes={[{ d: 'M140 86 Q138 24 200 22 Q262 24 260 86 Q200 76 140 86 Z' }]} fill={fill} line={line} />
            <path d="M200 24 L200 78" stroke={line} strokeWidth={1.6} />
            <circle cx={200} cy={23} r={5} fill={dark} />
            <Cloth shapes={[{ d: 'M144 84 Q200 70 256 84 Q260 99 200 97 Q140 99 144 84 Z' }]} fill={dark} line={line} />
          </g>
        ),
      }
    case 'beanie':
      return {
        body: (
          <g>
            <Cloth shapes={[{ d: 'M138 90 Q134 16 200 14 Q266 16 262 90 Z' }]} fill={fill} line={line} />
            <Cloth shapes={[{ d: 'M136 74 Q136 64 146 64 L254 64 Q264 64 264 74 L264 82 Q264 92 254 92 L146 92 Q136 92 136 82 Z' }]} fill={dark} line={line} flat />
            {Array.from({ length: 15 }, (_, i) => <path key={i} d={`M${144 + i * 8} 68 L${144 + i * 8} 88`} stroke={line} strokeWidth={1} opacity={0.4} />)}
          </g>
        ),
      }
    case 'bucket':
      return {
        body: (
          <g>
            <Cloth shapes={[{ d: 'M152 74 Q154 24 200 24 Q246 24 248 74 Z' }]} fill={fill} line={line} />
            <Cloth shapes={[{ d: 'M132 94 L152 70 L248 70 L268 94 Q200 104 132 94 Z' }]} fill={dark} line={line} />
          </g>
        ),
      }

    /* ----- accessories ----- */
    case 'watch': {
      const p = at(ARM, 0.93), tg = tangent(ARM, 0.93)
      const deg = (Math.atan2(tg[1], tg[0]) * 180) / Math.PI - 90
      const w = armW(0.93) + 5
      return {
        body: (
          <g transform={`translate(${p[0]} ${p[1]}) rotate(${deg})`}>
            <rect x={-w / 2} y={-6.5} width={w} height={13} rx={4} fill={s.color} stroke={line} strokeWidth={1.5} />
            <circle r={10} fill={s.accent} stroke={edge(s.accent)} strokeWidth={1.5} />
            <circle r={7} fill="#f7f7f4" />
            <path d="M0 0 L0 -5 M0 0 L3.5 2" stroke="#141416" strokeWidth={1.2} strokeLinecap="round" />
          </g>
        ),
      }
    }
    case 'belt':
      return {
        body: (
          <g>
            <Cloth shapes={[{ d: 'M120 460 L280 460 L281 474 L119 474 Z' }]} fill={fill} line={line} flat />
            <rect x={189} y={457} width={22} height={20} rx={2} fill="none" stroke={s.accent} strokeWidth={3.5} />
            <path d="M193 467 L207 467" stroke={s.accent} strokeWidth={2} />
          </g>
        ),
      }
    case 'crossbody':
      return {
        body: (
          <g>
            <path d="M148 216 L284 470" stroke={line} strokeWidth={10} strokeLinecap="round" />
            <path d="M148 216 L284 470" stroke={dark} strokeWidth={6.5} strokeLinecap="round" />
            <Cloth shapes={[{ d: 'M262 470 Q262 462 272 462 L334 462 Q344 462 344 470 L344 520 Q344 530 334 530 L272 530 Q262 530 262 520 Z' }]} fill={fill} line={line} />
            <Cloth shapes={[{ d: 'M262 470 Q262 462 272 462 L334 462 Q344 462 344 470 L344 492 Q303 504 262 492 Z' }]} fill={dark} line={line} flat />
          </g>
        ),
      }
    case 'tote': {
      const h = mx(handPoint())
      return {
        body: (
          <g>
            <path d={`M${h[0] - 22} 500 Q${h[0]} ${h[1] - 26} ${h[0] + 22} 500`} stroke={line} strokeWidth={5} fill="none" />
            <Cloth shapes={[{ d: `M${h[0] - 34} 498 L${h[0] + 34} 498 L${h[0] + 40} 590 L${h[0] - 40} 590 Z` }]} fill={fill} line={line} />
          </g>
        ),
      }
    }
    case 'backpack':
      return {
        body: (
          <g>
            <Cloth shapes={[{ d: 'M150 204 Q166 204 166 214 L162 336 Q156 342 150 336 L144 214 Q144 204 150 204 Z' }, { d: 'M150 204 Q166 204 166 214 L162 336 Q156 342 150 336 L144 214 Q144 204 150 204 Z', t: MIRROR }]} fill={fill} line={line} />
          </g>
        ),
      }
  }
}

/* ---------- Standalone thumbnail ---------- */

function thumbBox(p: Drawable): string {
  switch (KIND_SLOT[p.spec.kind]) {
    case 'top':
    case 'mid': return '34 160 332 350'
    case 'outer': return p.spec.kind === 'overcoat' ? '24 160 352 510' : '24 160 352 380'
    case 'bottom': return p.spec.kind === 'shorts' ? '84 450 232 200' : '84 450 232 360'
    case 'shoes': return '96 762 208 84'
    case 'headwear': return '122 6 156 104'
    case 'watch': return '50 420 56 50'
    case 'belt': return '108 440 184 50'
    case 'bag': return p.spec.kind === 'tote' ? '262 440 140 170' : p.spec.kind === 'backpack' ? '120 190 160 170' : '130 200 230 350'
  }
}

export function GarmentThumb({ p, className }: { p: Drawable; className?: string }) {
  const parts = garmentParts(p)
  return (
    <svg viewBox={thumbBox(p)} className={className} role="img" aria-hidden="true">
      <defs><SharedDefs /><PatternDef p={p} /></defs>
      {parts.body}
      {parts.collar}
    </svg>
  )
}
