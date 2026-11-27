import type { ReactElement } from 'react'
import { GarmentSpec, KIND_SLOT } from './garments'
import { luminance, shade } from './palette'
import { ARM, LEG, Pt, across, angleAt, armW, armhole, at, edges, limb, mx, on, panel, shoulderCap, torso, wristPoint } from './rig'

// Garments drawn on the shared rig (rig.ts), in a realistic illustration style.
// Layer depth sets how far a garment sits off the body: shirts 2, sweaters 6, jackets 12, so every
// layer wraps the one beneath it. Each garment's pieces (sleeves, body, collar) merge into one
// silhouette, and a lighting filter (#vol) gives that silhouette volume: edges turn away from the
// light, so a sleeve reads as a tube and a jacket as cloth over a body. Folds sit where cloth
// gathers on a real body: inside the elbow, under the arms, at the waist, crotch and hem.

export interface Drawable { id: string; spec: GarmentSpec }
export interface Parts { body: ReactElement; collar?: ReactElement }

type Shape = { d: string; t?: string }
const MIRROR = 'translate(400 0) scale(-1 1)'
const OUTLINE = 1.6

const edge = (hex: string) => (luminance(hex) < 0.12 ? shade(hex, 0.22) : shade(hex, -0.3))
const detail = (hex: string) => (luminance(hex) < 0.25 ? shade(hex, 0.3) : shade(hex, -0.22))
const fillOf = (p: Drawable) => (p.spec.pattern === 'solid' ? p.spec.color : `url(#pat-${p.id})`)
const r1 = (n: number) => Math.round(n * 10) / 10
const pts = (list: Pt[]) => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ')
const both = (d: string): Shape[] => [{ d }, { d, t: MIRROR }]
const P = (p: Pt) => `${r1(p[0])} ${r1(p[1])}`

/** Shared defs every SVG that draws garments needs once. */
export function SharedDefs() {
  return (
    <>
      {/* Volume: blur the silhouette into a height map, light it from the upper left, multiply onto the color. */}
      <filter id="vol" x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="h" />
        <feDiffuseLighting in="h" surfaceScale="5" diffuseConstant="1" lightingColor="#fff" result="l">
          <feDistantLight azimuth="225" elevation="58" />
        </feDiffuseLighting>
        <feComposite in="SourceGraphic" in2="l" operator="arithmetic" k1="1.17" k2="0" k3="0" k4="0" result="lit" />
        <feComposite in="lit" in2="SourceAlpha" operator="in" />
      </filter>
      <filter id="layer-shadow" x="-10%" y="-10%" width="120%" height="125%">
        <feDropShadow dx="1.5" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.28" />
      </filter>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="0.9" />
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
      return <pattern id={id} patternUnits="userSpaceOnUse" width="7" height="7"><rect width="7" height="7" fill={color} /><rect width="2.2" height="7" fill={acc} /></pattern>
    case 'check':
      return <pattern id={id} patternUnits="userSpaceOnUse" width="16" height="16"><rect width="16" height="16" fill={color} /><rect width="16" height="6" fill={acc} opacity="0.45" /><rect width="6" height="16" fill={acc} opacity="0.45" /></pattern>
    case 'heather':
      return <pattern id={id} patternUnits="userSpaceOnUse" width="4" height="4"><rect width="4" height="4" fill={color} /><circle cx="1" cy="1" r="0.7" fill={shade(color, 0.16)} /><circle cx="3" cy="2.8" r="0.7" fill={shade(color, -0.12)} /></pattern>
    case 'denim':
      return <pattern id={id} patternUnits="userSpaceOnUse" width="3" height="3"><rect width="3" height="3" fill={color} /><path d="M0 3 L3 0" stroke={shade(color, 0.14)} strokeWidth="0.8" /></pattern>
    default:
      return null
  }
}

/** One garment silhouette: a thin edge pass, then the fill, so all pieces merge into one shape. */
function Cloth({ shapes, fill, line }: { shapes: Shape[]; fill: string; line: string }) {
  return (
    <>
      {shapes.map((s, i) => <path key={`o${i}`} d={s.d} transform={s.t} fill={line} stroke={line} strokeWidth={OUTLINE} strokeLinejoin="round" />)}
      {shapes.map((s, i) => <path key={`f${i}`} d={s.d} transform={s.t} fill={fill} />)}
    </>
  )
}

/** Soft cloth folds: a shadow crease with a highlight just above it. Paths are for the left side; `sym` mirrors them. */
function Folds({ d, sym = true, k = 1 }: { d: string[]; sym?: boolean; k?: number }) {
  const all: { x: string; t?: string }[] = sym ? [...d.map((x) => ({ x })), ...d.map((x) => ({ x, t: MIRROR }))] : d.map((x) => ({ x }))
  return (
    <g filter="url(#soft)" fill="none" strokeLinecap="round">
      {all.map((f, i) => <path key={`s${i}`} d={f.x} transform={f.t} stroke="#000" strokeOpacity={0.2 * k} strokeWidth={2.4} />)}
      {all.map((f, i) => <path key={`h${i}`} d={f.x} transform={f.t ? `${f.t} translate(1.2 -1.4)` : 'translate(1.2 -1.4)'} stroke="#fff" strokeOpacity={0.13 * k} strokeWidth={1.6} />)}
    </g>
  )
}

function Buttons({ x, from, to, n, color }: { x: number; from: number; to: number; n: number; color: string }) {
  return <>{Array.from({ length: n }, (_, i) => <circle key={i} cx={x} cy={from + ((to - from) * i) / Math.max(1, n - 1)} r={2.4} fill={color} stroke="#000" strokeOpacity={0.25} strokeWidth={0.6} />)}</>
}

const sleeves = (t1: number, ease: number) => [...both(shoulderCap(ease)), ...both(limb(ARM, 0.05, t1, (t) => armW(t) + ease))]
const cuffs = (t0: number, t1: number, ease: number) => both(limb(ARM, t0, t1, (t) => armW(t) + ease + 1))
const fitD = (fit: GarmentSpec['fit']) => (fit === 'slim' ? -2 : fit === 'relaxed' ? 5 : 0)

/** Creases inside the elbow of a long sleeve. */
function elbowFolds(ease: number): string[] {
  const w = (t: number) => armW(t) + ease
  return [0.42, 0.49, 0.56].map((t, i) => {
    const a = on(ARM, t, w(t), 0.98), m = on(ARM, t + 0.025, w(t), 0.72), b = on(ARM, t + 0.01 - i * 0.01, w(t), 0.42 + i * 0.06)
    return `M${P(a)} Q${P(m)} ${P(b)}`
  })
}
/** Drag lines from the armpit toward the chest. */
const armpitFolds = (d: number) => [`M${128 - d + 5} 258 Q${142 - d * 0.5} 268 ${152 - d * 0.3} 286`, `M${130 - d + 4} 276 Q${140 - d * 0.5} 290 ${146 - d * 0.3} 306`]
/** Gentle vertical drape above an untucked hem. */
const hemFolds = (hem: number) => [`M150 ${hem - 58} Q154 ${hem - 28} 149 ${hem - 3}`, `M178 ${hem - 40} Q181 ${hem - 18} 177 ${hem - 1}`]
/** Small crease where a cuff gathers at the end of a long sleeve. */
function cuffFolds(t: number, ease: number): string[] {
  const w = armW(t) + ease
  return [`M${P(on(ARM, t - 0.05, w, 0.15))} Q${P(on(ARM, t - 0.02, w, 0.4))} ${P(on(ARM, t - 0.01, w, 0.62))}`]
}

export function garmentParts(p: Drawable): Parts {
  const s = p.spec
  const fill = fillOf(p)
  const line = edge(s.color)
  const dark = shade(s.color, -0.12)
  const det = detail(s.color)
  const fd = fitD(s.fit)
  const seam = (d: number) => <path d={`${armhole(d)} ${armhole(d, true)}`} stroke={line} strokeWidth={1.1} fill="none" opacity={0.5} />
  const lit = (el: ReactElement) => <g filter="url(#vol)">{el}</g>

  switch (s.kind) {
    /* ----- base layer: tees and shirts (depth 2) ----- */
    case 'tee':
    case 'longsleeve-tee':
    case 'henley': {
      const long = s.kind !== 'tee'
      const d = 2 + fd, hem = s.tucked ? 470 : 456
      const ease = long ? 6 + fd : 12 + fd
      const body = torso(d, hem, 1, [182, 150], 'Q200 180 182 150')
      return {
        body: lit(
          <g>
            <Cloth shapes={[...sleeves(long ? 1 : 0.3, ease), { d: body }]} fill={fill} line={line} />
            {long && <Cloth shapes={cuffs(0.92, 1, ease)} fill={dark} line={line} />}
            {seam(d)}
            <path d="M182 150 Q200 180 218 150" stroke={dark} strokeWidth={4} fill="none" />
            {s.kind === 'henley' && <><path d="M200 164 L200 222" stroke={det} strokeWidth={1.4} /><Buttons x={203} from={176} to={212} n={3} color={det} /></>}
            <Folds d={[...armpitFolds(d), ...(s.tucked ? [] : hemFolds(hem)), ...(long ? [...elbowFolds(ease), ...cuffFolds(0.92, ease)] : [])]} />
          </g>,
        ),
      }
    }
    case 'polo':
    case 'polo-ls':
    case 'oxford':
    case 'ss-shirt': {
      const long = s.kind === 'polo-ls' || s.kind === 'oxford'
      const polo = s.kind.startsWith('polo')
      const d = 2 + fd, hem = s.tucked ? 470 : polo ? 460 : 472
      const body = torso(d, hem, 2, [182, 148], 'L200 170 L182 148')
      const ease = long ? 8 + fd : 13 + fd
      const st = polo ? 0.32 : 0.31
      const collarL: Pt[] = polo ? [[181, 142], [200, 166], [192, 182], [170, 160]] : [[180, 140], [200, 168], [190, 190], [166, 160]]
      return {
        body: lit(
          <g>
            <Cloth shapes={[...sleeves(long ? 1 : st, ease), { d: body }]} fill={fill} line={line} />
            <Cloth shapes={long ? cuffs(0.91, 1, ease) : both(limb(ARM, st - 0.04, st, (t) => armW(t) + ease + 1))} fill={polo ? dark : fill} line={line} />
            {seam(d)}
            <path d={`M200 168 L200 ${polo ? 220 : hem}`} stroke={det} strokeWidth={1.3} />
            {!polo && <path d={`M194 168 L194 ${hem - 2}`} stroke={line} strokeWidth={0.9} opacity={0.5} />}
            {polo ? <Buttons x={203} from={186} to={210} n={2} color={det} /> : <Buttons x={197} from={196} to={hem - 24} n={6} color={det} />}
            {s.kind === 'oxford' && <path d="M140 228 L168 228 L168 258 Q154 263 140 258 Z" fill="none" stroke={line} strokeWidth={1} opacity={0.7} />}
            <Folds d={[...armpitFolds(d), ...(s.tucked ? ['M146 372 Q156 388 151 398', 'M172 378 Q178 390 175 398'] : hemFolds(hem)), ...(long ? [...elbowFolds(ease), ...cuffFolds(0.91, ease)] : [])]} />
          </g>,
        ),
        collar: lit(
          <g filter="url(#layer-shadow)">
            <Cloth shapes={[{ d: 'M182 138 Q200 130 218 138 L218 150 Q200 144 182 150 Z' }, { d: `M${pts(collarL)} Z` }, { d: `M${pts(collarL.map(mx))} Z` }]} fill={fill} line={line} />
            <path d={`M${pts([collarL[1], collarL[2]])}`} stroke={line} strokeWidth={1} opacity={0.6} />
          </g>,
        ),
      }
    }

    /* ----- mid layer: knits (depth 6) ----- */
    case 'crew-sweater':
    case 'sweatshirt':
    case 'v-sweater':
    case 'hoodie':
    case 'quarter-zip': {
      const d = 6 + fd, hem = s.kind === 'hoodie' || s.kind === 'sweatshirt' ? 452 : 446
      const v = s.kind === 'v-sweater', qz = s.kind === 'quarter-zip'
      const neckL: Pt = qz ? [180, 150] : [179, 152]
      const neck = v ? 'L200 222 L179 152' : qz ? 'Q200 166 180 150' : 'Q200 182 179 152'
      const body = torso(d, hem, 0, neckL, neck)
      const rib = s.kind === 'sweatshirt' || s.kind === 'hoodie' ? 16 : 13
      const ease = 13 + fd
      const t1 = 0.965
      const ribLines = Array.from({ length: 30 }, (_, i) => 126 - d + i * ((148 + 2 * d) / 29)).map((x) => `M${r1(x)} ${hem - rib + 2} L${r1(x)} ${hem}`)
      return {
        body: lit(
          <g>
            <Cloth shapes={[...sleeves(t1, ease), { d: body }]} fill={fill} line={line} />
            <Cloth shapes={cuffs(0.89, t1, ease)} fill={dark} line={line} />
            <path d={`M${126 - d} ${hem - rib} L${274 + d} ${hem - rib} L${274 + d} ${hem} Q200 ${hem + 6} ${126 - d} ${hem} Z`} fill={dark} />
            <path d={ribLines.join(' ')} stroke={line} strokeWidth={0.7} opacity={0.35} />
            <path d={`M${126 - d} ${hem - rib} L${274 + d} ${hem - rib}`} stroke={line} strokeWidth={1} opacity={0.55} />
            {seam(d)}
            {v && <path d="M179 152 L200 222 L221 152" stroke={dark} strokeWidth={7} fill="none" strokeLinejoin="round" />}
            {!v && !qz && <path d="M179 152 Q200 182 221 152" stroke={dark} strokeWidth={s.kind === 'sweatshirt' ? 9 : 7} fill="none" />}
            {qz && (
              <>
                <Cloth shapes={[{ d: 'M177 128 L223 128 L227 158 Q200 168 173 158 Z' }]} fill={fill} line={line} />
                <path d="M200 130 L200 222" stroke={det} strokeWidth={2} />
                <rect x={196.8} y={214} width={6.4} height={13} rx={2} fill={det} />
              </>
            )}
            {s.kind === 'hoodie' && (
              <>
                <Cloth shapes={[{ d: 'M146 172 Q148 134 200 132 Q252 134 254 172 Q230 152 200 160 Q170 152 146 172 Z' }]} fill={fill} line={line} />
                <path d="M190 160 L187 214 M210 160 L213 214" stroke={det} strokeWidth={2.2} strokeLinecap="round" />
                <path d="M148 362 L252 362 L264 424 L136 424 Z" fill="none" stroke={line} strokeWidth={1.2} strokeLinejoin="round" opacity={0.8} />
              </>
            )}
            <Folds d={[...armpitFolds(d), ...elbowFolds(ease), ...cuffFolds(0.89, ease), `M146 ${hem - rib - 30} Q151 ${hem - rib - 14} 147 ${hem - rib}`, `M176 ${hem - rib - 18} Q180 ${hem - rib - 8} 177 ${hem - rib}`]} />
          </g>,
        ),
      }
    }
    case 'cardigan': {
      const d = 6 + fd, hem = 452, ease = 13 + fd, t1 = 0.965
      const pnl = panel(d, hem, 0, [179, 152], 197, 268)
      return {
        body: lit(
          <g>
            <Cloth shapes={[...sleeves(t1, ease), { d: pnl }, { d: pnl, t: MIRROR }]} fill={fill} line={line} />
            <Cloth shapes={cuffs(0.89, t1, ease)} fill={dark} line={line} />
            <path d={`M${126 - d} ${hem - 12} L197 ${hem - 12} L197 ${hem} L${126 - d} ${hem} Z M203 ${hem - 12} L${274 + d} ${hem - 12} L${274 + d} ${hem} L203 ${hem} Z`} fill={dark} />
            <path d={`M179 152 L197 268 L197 ${hem} M221 152 L203 268 L203 ${hem}`} stroke={dark} strokeWidth={6} fill="none" />
            {seam(d)}
            <Buttons x={191} from={282} to={430} n={5} color={det} />
            <Folds d={[...armpitFolds(d), ...elbowFolds(ease), ...cuffFolds(0.89, ease), `M150 ${hem - 60} Q156 ${hem - 34} 150 ${hem - 12}`]} />
          </g>,
        ),
      }
    }
    case 'sweater-vest': {
      const hem = 446, d = 5 + fd
      const left: Pt[] = [[179, 153], [150, 160], [138, 196], [127 - d, 250], [128 - d, 300], [128 - d, 380], [126 - d, hem]]
      const right = left.map(mx).reverse()
      const poly = (a: Pt[], move = true) => `${move ? 'M' : 'L'}${P(a[0])}${a.slice(1).map((q) => ` L${P(q)}`).join('')}`
      const body = `${poly(left)} Q200 ${hem + 6} ${P(right[0])} ${poly(right, false)} L200 228 Z`
      return {
        body: lit(
          <g filter="url(#layer-shadow)">
            <Cloth shapes={[{ d: body }]} fill={fill} line={line} />
            <path d={`M${126 - d} ${hem - 12} L${274 + d} ${hem - 12} L${274 + d} ${hem} Q200 ${hem + 6} ${126 - d} ${hem} Z`} fill={dark} />
            <path d={`M179 153 L200 228 L221 153 M150 161 L138 196 L${127 - d} 250 M250 161 L262 196 L${273 + d} 250`} stroke={dark} strokeWidth={6} fill="none" strokeLinejoin="round" />
          </g>,
        ),
      }
    }

    /* ----- outer layer: jackets and coats (depth 12) ----- */
    case 'chore':
    case 'bomber':
    case 'blazer':
    case 'overcoat': {
      const d = 12 + fd
      const tailored = s.kind === 'blazer' || s.kind === 'overcoat'
      const hem = s.kind === 'overcoat' ? 648 : s.kind === 'blazer' ? 502 : s.kind === 'bomber' ? 448 : 480
      const flare = s.kind === 'overcoat' ? 12 : s.kind === 'blazer' ? 5 : s.kind === 'bomber' ? -2 : 2
      const openY = s.kind === 'chore' ? 200 : s.kind === 'bomber' ? 170 : s.kind === 'blazer' ? 330 : 340
      const ease = (s.kind === 'bomber' ? 24 : s.kind === 'overcoat' ? 23 : 19) + fd
      const t1 = s.kind === 'overcoat' ? 0.98 : 0.965
      const pnl = panel(d, hem, flare, [182, 146], 196, openY)
      const lapel: Pt[] = [[182, 146], [150, 196], [160, 202], [155, 212], [196, openY]]
      const bigCollar: Pt[] = [[180, 144], [200, 186], [184, 204], [146, 170]]
      const pocketY = s.kind === 'overcoat' ? 470 : 432
      return {
        body: lit(
          <g>
            <Cloth shapes={[...sleeves(t1, ease), { d: pnl }, { d: pnl, t: MIRROR }]} fill={fill} line={line} />
            {seam(d)}
            {s.kind === 'bomber' && (
              <>
                <Cloth shapes={cuffs(0.9, t1, ease - 4)} fill={dark} line={line} />
                <path d={`M${126 - d - flare} ${hem - 16} L196 ${hem - 16} L196 ${hem} L${126 - d - flare} ${hem} Z M204 ${hem - 16} L${274 + d + flare} ${hem - 16} L${274 + d + flare} ${hem} L204 ${hem} Z`} fill={dark} />
                <path d="M172 150 Q180 140 197 162 M228 150 Q220 140 203 162" stroke={dark} strokeWidth={10} fill="none" strokeLinecap="round" />
                <path d={`M196 166 L196 ${hem - 16} M204 166 L204 ${hem - 16}`} stroke={det} strokeWidth={1.4} strokeDasharray="2.5 2.5" />
              </>
            )}
            {s.kind === 'chore' && (
              <>
                <path d={`${across(ARM, 0.9, armW(0.9) + ease)} ${across(ARM, 0.9, armW(0.9) + ease, true)}`} stroke={line} strokeWidth={1.2} />
                <path d="M126 380 L166 380 L166 420 Q146 425 126 420 Z M274 380 L234 380 L234 420 Q254 425 274 420 Z M142 230 L174 230 L174 262 Q158 266 142 262 Z" fill="none" stroke={line} strokeWidth={1.2} opacity={0.8} />
                <Buttons x={189} from={214} to={460} n={6} color={det} />
                <Cloth shapes={[{ d: `M${pts(bigCollar)} Z` }, { d: `M${pts(bigCollar.map(mx))} Z` }]} fill={fill} line={line} />
              </>
            )}
            {tailored && (
              <>
                <g filter="url(#layer-shadow)">
                  <Cloth shapes={[{ d: `M${pts(lapel)} Z` }, { d: `M${pts(lapel.map(mx))} Z` }]} fill={shade(s.color, -0.04)} line={line} />
                </g>
                <Buttons x={190} from={openY + 28} to={s.kind === 'overcoat' ? 520 : openY + 66} n={s.kind === 'overcoat' ? 3 : 2} color={det} />
                <path d={`M118 ${pocketY} L164 ${pocketY} M282 ${pocketY} L236 ${pocketY} M228 250 L256 246`} stroke={line} strokeWidth={1.6} opacity={0.8} />
              </>
            )}
            <Folds d={[...armpitFolds(d), ...elbowFolds(ease), ...cuffFolds(t1 - 0.02, ease), `M186 ${openY + 20} Q190 ${(openY + hem) / 2} 188 ${hem - 8}`]} k={0.9} />
          </g>,
        ),
      }
    }
    case 'puffer': {
      const d = 16 + fd, hem = 462, ease = 32 + fd, t1 = 0.965
      const body = torso(d, hem, 2, [180, 148], 'Q200 162 180 148')
      return {
        body: lit(
          <g>
            <Cloth shapes={[...sleeves(t1, ease), { d: body }]} fill={fill} line={line} />
            {[0.2, 0.4, 0.6, 0.8].map((t) => <path key={t} d={`${across(ARM, t, armW(t) + ease)} ${across(ARM, t, armW(t) + ease, true)}`} stroke={line} strokeWidth={1.5} opacity={0.7} />)}
            {[214, 254, 294, 334, 374, 414].map((y) => <path key={y} d={`M${124 - d} ${y} Q200 ${y + 8} ${276 + d} ${y}`} stroke={line} strokeWidth={1.5} fill="none" opacity={0.7} />)}
            <Cloth shapes={[{ d: 'M168 124 L232 124 L238 160 Q200 172 162 160 Z' }]} fill={fill} line={line} />
            <path d={`M200 128 L200 ${hem}`} stroke={det} strokeWidth={1.8} />
          </g>,
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
      const hemW = s.kind === 'joggers' ? 46 : s.fit === 'slim' ? 58 : s.fit === 'relaxed' ? 78 : 66
      const t1 = shorts ? (s.fit === 'slim' ? 0.27 : 0.36) : 1.01
      const thigh = 92 + fd
      const knee = Math.max(hemW, 70 + fd)
      const w = (t: number) => {
        if (shorts) return thigh - 30 * Math.max(0, t) / 0.36
        const u = Math.max(0, Math.min(1, t))
        return u < 0.46 ? thigh + (knee - thigh) * (u / 0.46) : knee + (hemW - knee) * ((u - 0.46) / 0.54)
      }
      const hip = 'M119 396 L281 396 Q289 420 290 446 L200 478 L110 446 Q111 420 119 396 Z'
      const legs: Shape[] = [{ d: limb(LEG, -0.03, t1, w) }, { d: limb(LEG, -0.03, t1, w, true) }]
      const stitch = s.kind === 'jeans' ? s.accent : det
      const crease = (m: boolean) => { const a = at(LEG, 0.22), b = at(LEG, Math.min(t1, 1.02)); const A = m ? mx(a) : a, B = m ? mx(b) : b; return `M${P(A)} L${P(B)}` }
      const kneeE = edges(LEG, 0.5, w(0.5)), kc = at(LEG, 0.5)
      const ank = at(LEG, 0.99)
      const folds = [
        'M190 470 Q178 478 168 478', 'M192 480 Q182 490 172 494',
        ...(shorts ? [] : [
          `M${P([kneeE[0][0] + 10, kneeE[0][1] - 6])} Q${P([kc[0], kc[1] + 4])} ${P([kneeE[1][0] - 12, kneeE[1][1] - 10])}`,
          `M${P([ank[0] - hemW / 2 + 6, ank[1] - 4])} Q${P([ank[0], ank[1] + 6])} ${P([ank[0] + hemW / 2 - 8, ank[1] - 8])}`,
        ]),
      ]
      return {
        body: lit(
          <g>
            <Cloth shapes={[{ d: hip }, ...legs]} fill={fill} line={line} />
            <path d="M200 412 Q202 450 200 476" stroke={line} strokeWidth={1.1} fill="none" opacity={0.6} />
            <Cloth shapes={[{ d: 'M118 394 L282 394 L283 410 L117 410 Z' }]} fill={s.kind === 'joggers' ? dark : fill} line={line} />
            {s.kind !== 'joggers' && [130, 166, 230, 266].map((x) => <rect key={x} x={x} y={393} width={4} height={18} rx={1} fill={dark} />)}
            {s.kind === 'jeans'
              ? <path d="M126 414 Q148 434 162 412 M274 414 Q252 434 238 412 M200 412 L200 450" stroke={stitch} strokeWidth={1.3} fill="none" opacity={0.9} />
              : <path d="M124 414 L136 452 M276 414 L264 452" stroke={line} strokeWidth={1.2} opacity={0.8} />}
            {s.kind === 'joggers' && <path d="M192 400 L188 430 M208 400 L212 430" stroke={det} strokeWidth={2} strokeLinecap="round" />}
            {(s.kind === 'trousers' || s.kind === 'chinos') && <path d={`${crease(false)} ${crease(true)}`} stroke={shade(s.color, s.kind === 'trousers' ? 0.12 : -0.08)} strokeWidth={1.2} opacity={0.75} />}
            {s.kind === 'joggers' && <Cloth shapes={[{ d: limb(LEG, 0.94, 1.01, (t) => w(t) + 1) }, { d: limb(LEG, 0.94, 1.01, (t) => w(t) + 1, true) }]} fill={dark} line={line} />}
            <Folds d={folds} k={s.kind === 'trousers' ? 0.7 : 1} />
          </g>,
        ),
      }
    }

    /* ----- shoes ----- */
    case 'sneakers':
    case 'runners':
    case 'loafers':
    case 'derbies':
    case 'boots': {
      const dress = s.kind === 'loafers' || s.kind === 'derbies'
      const soleH = s.kind === 'runners' ? 9 : s.kind === 'sneakers' ? 7 : 5
      const laceY = s.kind === 'boots' ? 800 : 840
      const foot = (cx: number, right: boolean) => {
        const top = s.kind === 'boots' ? 786 : 830
        const upper = s.kind === 'boots'
          ? `M${cx - 22} ${top} L${cx + 22} ${top} L${cx + 24} 838 Q${cx + 32} 850 ${cx + 32} 866 L${cx - 32} 866 Q${cx - 32} 850 ${cx - 24} 838 Z`
          : dress
            ? `M${cx - 21} ${top} Q${cx - 31} 846 ${cx - 31} 866 L${cx + 31} 866 Q${cx + 31} 846 ${cx + 21} ${top} Z`
            : `M${cx - 22} ${top} Q${cx - 33} 844 ${cx - 33} 864 L${cx + 33} 864 Q${cx + 33} 844 ${cx + 22} ${top} Z`
        return (
          <g key={cx} transform={`rotate(${right ? -5 : 5} ${cx} 836)`}>
            <Cloth shapes={[{ d: upper }]} fill={fill} line={line} />
            <rect x={cx - (dress ? 32 : 34)} y={864} width={dress ? 64 : 68} height={soleH} rx={dress ? 2 : 4} fill={s.accent} stroke={edge(s.accent)} strokeWidth={1} />
            {(s.kind === 'sneakers' || s.kind === 'runners' || s.kind === 'derbies' || s.kind === 'boots') && (
              <path d={[0, 1, 2, 3].map((i) => `M${cx - 8} ${laceY + i * 6} L${cx + 8} ${laceY + i * 6}`).join(' ')} stroke={det} strokeWidth={1.6} strokeLinecap="round" />
            )}
            {s.kind === 'runners' && <path d={`M${cx - 26} 860 Q${cx} 850 ${cx + 26} 860`} stroke={s.accent} strokeWidth={2.5} fill="none" />}
            {s.kind === 'loafers' && <path d={`M${cx - 16} 850 Q${cx} 846 ${cx + 16} 850`} stroke={det} strokeWidth={2} fill="none" />}
          </g>
        )
      }
      const l = r1(at(LEG, 1)[0])
      return { body: lit(<g>{foot(l, false)}{foot(400 - l, true)}</g>) }
    }

    /* ----- headwear (drawn outside the build transform) ----- */
    case 'cap':
      return {
        body: lit(
          <g>
            <Cloth shapes={[{ d: 'M153 56 Q150 4 200 2 Q250 4 247 56 Q200 48 153 56 Z' }]} fill={fill} line={line} />
            <path d="M200 4 L200 50 M176 8 Q168 30 166 52 M224 8 Q232 30 234 52" stroke={line} strokeWidth={1} opacity={0.6} fill="none" />
            <circle cx={200} cy={4} r={4} fill={dark} />
            <Cloth shapes={[{ d: 'M156 54 Q200 42 244 54 Q248 66 200 66 Q152 66 156 54 Z' }]} fill={dark} line={line} />
          </g>,
        ),
      }
    case 'beanie':
      return {
        body: lit(
          <g>
            <Cloth shapes={[{ d: 'M152 58 Q148 -4 200 -6 Q252 -4 248 58 Z' }]} fill={fill} line={line} />
            <Cloth shapes={[{ d: 'M150 42 Q150 34 158 34 L242 34 Q250 34 250 42 L250 54 Q250 62 242 62 L158 62 Q150 62 150 54 Z' }]} fill={dark} line={line} />
            {Array.from({ length: 16 }, (_, i) => <path key={i} d={`M${r1(156 + i * 5.8)} 37 L${r1(156 + i * 5.8)} 59`} stroke={line} strokeWidth={0.8} opacity={0.4} />)}
          </g>,
        ),
      }
    case 'bucket':
      return {
        body: lit(
          <g>
            <Cloth shapes={[{ d: 'M160 46 Q162 4 200 4 Q238 4 240 46 Z' }]} fill={fill} line={line} />
            <Cloth shapes={[{ d: 'M140 64 L160 42 L240 42 L260 64 Q200 74 140 64 Z' }]} fill={dark} line={line} />
          </g>,
        ),
      }

    /* ----- accessories ----- */
    case 'watch': {
      const p = at(ARM, 0.955)
      const w = armW(0.955) + 7
      return {
        body: (
          <g transform={`translate(${P(p)}) rotate(${r1(angleAt(ARM, 0.955))})`} filter="url(#vol)">
            <rect x={-w / 2} y={-5} width={w} height={10} rx={3} fill={s.color} stroke={line} strokeWidth={1} />
            <circle r={8} fill={s.accent} stroke={edge(s.accent)} strokeWidth={1.2} />
            <circle r={5.6} fill="#f7f7f4" />
            <path d="M0 0 L0 -4 M0 0 L2.8 1.6" stroke="#141416" strokeWidth={1} strokeLinecap="round" />
          </g>
        ),
      }
    }
    case 'belt':
      return {
        body: lit(
          <g>
            <Cloth shapes={[{ d: 'M117 396 L283 396 L284 409 L116 409 Z' }]} fill={fill} line={line} />
            <rect x={191} y={393.5} width={18} height={18} rx={2} fill="none" stroke={s.accent} strokeWidth={3} />
            <path d="M194 402.5 L206 402.5" stroke={s.accent} strokeWidth={1.6} />
          </g>,
        ),
      }
    case 'crossbody':
      return {
        body: lit(
          <g filter="url(#layer-shadow)">
            <path d="M150 162 L282 430" stroke={line} strokeWidth={8} strokeLinecap="round" />
            <path d="M150 162 L282 430" stroke={dark} strokeWidth={5.5} strokeLinecap="round" />
            <Cloth shapes={[{ d: 'M258 428 Q258 420 266 420 L326 420 Q334 420 334 428 L334 474 Q334 482 326 482 L266 482 Q258 482 258 474 Z' }]} fill={fill} line={line} />
            <Cloth shapes={[{ d: 'M258 428 Q258 420 266 420 L326 420 Q334 420 334 428 L334 446 Q296 458 258 446 Z' }]} fill={dark} line={line} />
          </g>,
        ),
      }
    case 'tote': {
      const h = mx(wristPoint())
      const hy = h[1] + 40
      return {
        body: lit(
          <g filter="url(#layer-shadow)">
            <path d={`M${r1(h[0] - 20)} ${r1(hy + 30)} Q${r1(h[0])} ${r1(hy - 22)} ${r1(h[0] + 20)} ${r1(hy + 30)}`} stroke={line} strokeWidth={4} fill="none" />
            <Cloth shapes={[{ d: `M${r1(h[0] - 32)} ${r1(hy + 28)} L${r1(h[0] + 32)} ${r1(hy + 28)} L${r1(h[0] + 38)} ${r1(hy + 118)} L${r1(h[0] - 38)} ${r1(hy + 118)} Z` }]} fill={fill} line={line} />
          </g>,
        ),
      }
    }
    case 'backpack': {
      const strap = 'M146 160 Q164 158 164 168 L160 296 Q154 302 148 296 L140 172 Q140 160 146 160 Z'
      return {
        body: lit(
          <g filter="url(#layer-shadow)">
            <Cloth shapes={[{ d: strap }, { d: strap, t: MIRROR }]} fill={fill} line={line} />
          </g>,
        ),
      }
    }
  }
}

/* ---------- Standalone thumbnail ---------- */

function thumbBox(p: Drawable): string {
  switch (KIND_SLOT[p.spec.kind]) {
    case 'top':
    case 'mid': return '30 116 340 360'
    case 'outer': return p.spec.kind === 'overcoat' ? '24 116 352 540' : '24 116 352 400'
    case 'bottom': return p.spec.kind === 'shorts' ? '90 386 220 210' : '90 386 220 476'
    case 'shoes': return '120 780 160 100'
    case 'headwear': return '136 -10 128 84'
    case 'watch': return '56 410 50 50'
    case 'belt': return '108 380 184 44'
    case 'bag': return p.spec.kind === 'tote' ? '262 440 140 170' : p.spec.kind === 'backpack' ? '120 140 160 170' : '130 150 220 340'
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
