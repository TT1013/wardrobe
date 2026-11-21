import type { ReactElement } from 'react'
import { Fit, GarmentSpec, KIND_SLOT } from './garments'
import { luminance, shade } from './palette'

// Illustrated garments drawn on the avatar's 400x880 canvas (before the build transform).
// Each piece returns a body and, for collared shirts, a collar drawn separately so it can sit
// over a sweater's neckline the way a real collar does.

export interface Drawable { id: string; spec: GarmentSpec }
export interface Parts { body: ReactElement; collar?: ReactElement }

const SW = 2.4 // outline width
const edge = (hex: string) => (luminance(hex) < 0.2 ? shade(hex, 0.28) : shade(hex, -0.32))
const detail = (hex: string) => (luminance(hex) < 0.25 ? shade(hex, 0.35) : shade(hex, -0.22))
const fillOf = (p: Drawable) => (p.spec.pattern === 'solid' ? p.spec.color : `url(#pat-${p.id})`)
const X = (x: number, right: boolean) => (right ? 400 - x : x)
const pts = (list: number[][], right = false) => list.map(([x, y]) => `${X(x, right)},${y}`).join(' ')
const mirror = 'translate(400 0) scale(-1 1)'
const fitT = (fit: Fit) => `translate(200 0) scale(${fit === 'slim' ? 0.97 : fit === 'relaxed' ? 1.06 : 1} 1) translate(-200 0)`

/* ---------- Patterns ---------- */

export function PatternDef({ p }: { p: Drawable }) {
  const { pattern, color, accent } = p.spec
  const id = `pat-${p.id}`
  const acc = accent || (luminance(color) > 0.6 ? '#1b2a49' : '#f4f4f1')
  switch (pattern) {
    case 'stripe':
      return <pattern id={id} patternUnits="userSpaceOnUse" width="10" height="14"><rect width="10" height="14" fill={color} /><rect width="10" height="5" fill={acc} /></pattern>
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

/* ---------- Building blocks ---------- */

// Arm centerline: shoulder (124,238) to wrist (92,450), quadratic through (96,340).
const P0 = [124, 238], C = [96, 340], P1 = [92, 450]
function armPoint(t: number): [number, number] {
  const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t
  return [a * P0[0] + b * C[0] + c * P1[0], a * P0[1] + b * C[1] + c * P1[1]]
}
function sleevePath(t: number, right: boolean): string {
  const q = [P0[0] + (C[0] - P0[0]) * t, P0[1] + (C[1] - P0[1]) * t]
  const e = armPoint(t)
  return `M${X(128, right)} 212 L${X(P0[0], right)} ${P0[1]} Q${X(q[0], right)} ${q[1]} ${X(e[0], right)} ${e[1]}`
}
function segment(t0: number, t1: number, right: boolean): string {
  const a = armPoint(t0), b = armPoint(t1)
  return `M${X(a[0], right)} ${a[1]} L${X(b[0], right)} ${b[1]}`
}

function Sleeves({ t, w, fill, line, cuff }: { t: number; w: number; fill: string; line: string; cuff?: string }) {
  return (
    <>
      {[false, true].map((r) => (
        <g key={String(r)}>
          <path d={sleevePath(t, r)} stroke={line} strokeWidth={w + SW * 2} fill="none" strokeLinejoin="round" />
          <path d={sleevePath(t, r)} stroke={fill} strokeWidth={w} fill="none" strokeLinejoin="round" />
          {cuff && <path d={segment(t - 0.055, t, r)} stroke={cuff} strokeWidth={w} fill="none" />}
        </g>
      ))}
    </>
  )
}

type Neck = { type: 'crew'; y: number; drop: number } | { type: 'v'; y: number; depth: number }

function torsoPath(pad: number, hem: number, neck: Neck): string {
  const n = neck.type === 'crew' ? `Q200 ${neck.y + neck.drop} 224 ${neck.y}` : `L200 ${neck.depth} L224 ${neck.y}`
  return `M${120 - pad} 210 Q${150 - pad} 203 176 ${neck.y} ${n} Q${250 + pad} 203 ${280 + pad} 210 L${290 + pad} 300 Q${291 + pad} 400 ${288 + pad} ${hem} L${112 - pad} ${hem} Q${109 - pad} 400 ${110 - pad} 300 Z`
}
/** Left front panel of an open garment; the right panel is its mirror image. */
function panelPath(pad: number, hem: number, neckY: number, openY: number, edgeX = 196): string {
  return `M${120 - pad} 210 Q${150 - pad} 203 176 ${neckY} L${edgeX} ${openY} L${edgeX} ${hem} L${112 - pad} ${hem} Q${109 - pad} 400 ${110 - pad} 300 Z`
}
function Fold({ pad, hem }: { pad: number; hem: number }) {
  return <path d={`M${290 + pad} 300 Q${291 + pad} 400 ${288 + pad} ${hem} L${268 + pad} ${hem} Q${272 + pad} 400 ${276 + pad} 300 Z`} fill="#000" opacity={0.09} />
}
function HemBand({ pad, hem, h, color, gap }: { pad: number; hem: number; h: number; color: string; gap?: boolean }) {
  const l = 112 - pad, r = 288 + pad
  return gap ? (
    <>
      <rect x={l} y={hem - h} width={196 - l} height={h} fill={color} />
      <rect x={204} y={hem - h} width={r - 204} height={h} fill={color} />
    </>
  ) : <rect x={l} y={hem - h} width={r - l} height={h} fill={color} />
}
function Buttons({ x, from, to, n, color }: { x: number; from: number; to: number; n: number; color: string }) {
  return <>{Array.from({ length: n }, (_, i) => <circle key={i} cx={x} cy={from + ((to - from) * i) / Math.max(1, n - 1)} r={2.6} fill={color} />)}</>
}
function PointCollar({ fill, line, size }: { fill: string; line: string; size: 'small' | 'shirt' | 'big' }) {
  const L = size === 'big' ? [[168, 190], [199, 228], [182, 250], [148, 210]]
    : size === 'shirt' ? [[175, 194], [200, 216], [187, 238], [164, 208]]
    : [[178, 197], [200, 213], [190, 229], [170, 208]]
  return (
    <g fill={fill} stroke={line} strokeWidth={SW} strokeLinejoin="round">
      {size !== 'big' && <path d="M176 197 Q200 186 224 197 L224 206 Q200 198 176 206 Z" />}
      <polygon points={pts(L)} />
      <polygon points={pts(L, true)} />
    </g>
  )
}

/* ---------- Garments ---------- */

export function garmentParts(p: Drawable): Parts {
  const s = p.spec
  const fill = fillOf(p)
  const line = edge(s.color)
  const dark = shade(s.color, -0.12)
  const det = detail(s.color)
  const sh = { fill, stroke: line, strokeWidth: SW, strokeLinejoin: 'round' as const }
  const wrap = (el: ReactElement, collar?: ReactElement): Parts => ({
    body: <g transform={fitT(s.fit)}>{el}</g>,
    collar: collar ? <g transform={fitT(s.fit)}>{collar}</g> : undefined,
  })

  switch (s.kind) {
    /* ----- shirts / tees ----- */
    case 'tee':
    case 'longsleeve-tee':
    case 'henley': {
      const long = s.kind !== 'tee'
      const hem = s.tucked ? 522 : 490
      return wrap(
        <>
          <Sleeves t={long ? 1 : 0.34} w={long ? 42 : 50} fill={fill} line={line} cuff={long ? dark : undefined} />
          <path d={torsoPath(0, hem, { type: 'crew', y: 203, drop: 14 })} {...sh} />
          <Fold pad={0} hem={hem} />
          <path d="M176 203 Q200 217 224 203" stroke={dark} strokeWidth={4} fill="none" />
          {s.kind === 'henley' && <><path d="M200 214 L200 262" stroke={det} strokeWidth={1.6} /><Buttons x={204} from={224} to={254} n={3} color={det} /></>}
        </>,
      )
    }
    case 'polo':
    case 'polo-ls':
    case 'oxford':
    case 'ss-shirt': {
      const long = s.kind === 'polo-ls' || s.kind === 'oxford'
      const polo = s.kind.startsWith('polo')
      const hem = s.tucked ? 522 : polo ? 490 : 500
      return wrap(
        <>
          <Sleeves t={long ? 1 : polo ? 0.38 : 0.36} w={long ? 42 : 50} fill={fill} line={line} cuff={long || polo ? dark : undefined} />
          <path d={torsoPath(0, hem, { type: 'v', y: 202, depth: 224 })} {...sh} />
          <Fold pad={0} hem={hem} />
          <path d={`M200 216 L200 ${polo ? 266 : hem}`} stroke={det} strokeWidth={1.6} />
          {polo ? <Buttons x={204} from={234} to={258} n={2} color={det} /> : <Buttons x={204} from={244} to={hem - 30} n={6} color={det} />}
          {s.kind === 'oxford' && <rect x={136} y={262} width={34} height={38} rx={3} fill="none" stroke={det} strokeWidth={1.4} />}
        </>,
        <PointCollar fill={fill} line={line} size={polo ? 'small' : 'shirt'} />,
      )
    }

    /* ----- sweaters / mid layers ----- */
    case 'crew-sweater':
    case 'sweatshirt':
    case 'v-sweater':
    case 'hoodie':
    case 'quarter-zip': {
      const hem = 480
      const v = s.kind === 'v-sweater'
      const neck: Neck = v ? { type: 'v', y: 206, depth: 268 } : { type: 'crew', y: s.kind === 'quarter-zip' ? 204 : 206, drop: s.kind === 'quarter-zip' ? 10 : 16 }
      return wrap(
        <>
          <Sleeves t={0.955} w={46} fill={fill} line={line} cuff={dark} />
          <path d={torsoPath(3, hem, neck)} {...sh} />
          <Fold pad={3} hem={hem} />
          <HemBand pad={3} hem={hem} h={s.kind === 'sweatshirt' || s.kind === 'hoodie' ? 16 : 12} color={dark} />
          {v ? <path d="M176 206 L200 268 L224 206" stroke={dark} strokeWidth={6} fill="none" strokeLinejoin="round" />
            : s.kind !== 'quarter-zip' && <path d="M176 206 Q200 222 224 206" stroke={dark} strokeWidth={s.kind === 'sweatshirt' ? 8 : 6} fill="none" />}
          {s.kind === 'quarter-zip' && (
            <>
              <path d="M174 186 L226 186 L228 212 Q200 222 172 212 Z" {...sh} />
              <path d="M200 188 L200 264" stroke={det} strokeWidth={2} />
              <rect x={197} y={258} width={7} height={13} rx={2} fill={det} />
            </>
          )}
          {s.kind === 'hoodie' && (
            <>
              <path d="M154 214 Q158 170 200 172 Q242 170 246 214 Q222 200 200 206 Q178 200 154 214 Z" {...sh} />
              <path d="M190 210 L187 256 M210 210 L213 256" stroke={det} strokeWidth={2.4} strokeLinecap="round" />
              <path d="M146 392 L254 392 L266 452 L134 452 Z" fill="none" stroke={line} strokeWidth={SW} strokeLinejoin="round" />
            </>
          )}
        </>,
      )
    }
    case 'cardigan': {
      const hem = 480
      const panel = panelPath(3, hem, 206, 302)
      return wrap(
        <>
          <Sleeves t={0.955} w={46} fill={fill} line={line} cuff={dark} />
          <path d={panel} {...sh} />
          <path d={panel} {...sh} transform={mirror} />
          <Fold pad={3} hem={hem} />
          <HemBand pad={3} hem={hem} h={12} color={dark} gap />
          <path d="M176 206 L196 302 L196 480 M224 206 L204 302 L204 480" stroke={dark} strokeWidth={5} fill="none" />
          <Buttons x={190} from={318} to={456} n={5} color={det} />
        </>,
      )
    }
    case 'sweater-vest': {
      const hem = 480
      return wrap(
        <>
          <path d="M140 212 Q160 206 176 207 L200 266 L224 207 Q240 206 260 212 Q266 272 289 300 Q290 400 289 480 L111 480 Q110 400 111 300 Q134 272 140 212 Z" {...sh} />
          <Fold pad={1} hem={hem} />
          <HemBand pad={1} hem={hem} h={12} color={dark} />
          <path d="M176 207 L200 266 L224 207 M140 214 Q134 272 112 300 M260 214 Q266 272 288 300" stroke={dark} strokeWidth={5} fill="none" />
        </>,
      )
    }

    /* ----- jackets / coats ----- */
    case 'chore':
    case 'bomber':
    case 'blazer':
    case 'overcoat': {
      const pad = 8
      const hem = s.kind === 'overcoat' ? 650 : s.kind === 'blazer' ? 526 : s.kind === 'bomber' ? 500 : 514
      const openY = s.kind === 'chore' ? 236 : s.kind === 'bomber' ? 214 : 336
      const panel = panelPath(pad, hem, 200, openY, 195)
      const lapel = [[176, 200], [152, 238], [164, 243], [156, 253], [195, 336]]
      return wrap(
        <>
          <Sleeves t={s.kind === 'overcoat' ? 0.99 : 0.985} w={s.kind === 'bomber' ? 54 : 50} fill={fill} line={line} cuff={s.kind === 'bomber' ? dark : undefined} />
          <path d={panel} {...sh} />
          <path d={panel} {...sh} transform={mirror} />
          <Fold pad={pad} hem={hem} />
          {s.kind === 'bomber' && (
            <>
              <rect x={104} y={hem - 16} width={91} height={16} fill={dark} />
              <rect x={205} y={hem - 16} width={91} height={16} fill={dark} />
              <path d="M166 208 Q176 196 195 214 M234 208 Q224 196 205 214" stroke={dark} strokeWidth={9} fill="none" strokeLinecap="round" />
              <path d={`M195 216 L195 ${hem - 16} M205 216 L205 ${hem - 16}`} stroke={det} strokeWidth={1.6} strokeDasharray="3 3" />
            </>
          )}
          {s.kind === 'chore' && (
            <>
              <rect x={126} y={410} width={46} height={48} rx={3} fill="none" stroke={det} strokeWidth={1.5} />
              <rect x={228} y={410} width={46} height={48} rx={3} fill="none" stroke={det} strokeWidth={1.5} />
              <Buttons x={188} from={258} to={490} n={5} color={det} />
              <PointCollar fill={fill} line={line} size="big" />
            </>
          )}
          {(s.kind === 'blazer' || s.kind === 'overcoat') && (
            <>
              <g fill={shade(s.color, -0.06)} stroke={line} strokeWidth={SW} strokeLinejoin="round">
                <polygon points={pts(lapel)} />
                <polygon points={pts(lapel, true)} />
              </g>
              <Buttons x={188} from={370} to={s.kind === 'overcoat' ? 500 : 412} n={s.kind === 'overcoat' ? 3 : 2} color={det} />
              <path d={`M126 ${s.kind === 'overcoat' ? 470 : 452} L170 ${s.kind === 'overcoat' ? 470 : 452} M230 ${s.kind === 'overcoat' ? 470 : 452} L274 ${s.kind === 'overcoat' ? 470 : 452} M220 300 L250 296`} stroke={det} strokeWidth={1.8} />
            </>
          )}
        </>,
      )
    }
    case 'puffer': {
      const pad = 12
      const hem = 500
      return wrap(
        <>
          <Sleeves t={0.985} w={58} fill={fill} line={line} cuff={dark} />
          <path d={torsoPath(pad, hem, { type: 'crew', y: 206, drop: 8 })} {...sh} />
          <Fold pad={pad} hem={hem} />
          {[252, 290, 328, 366, 404, 442, 480].map((y) => <path key={y} d={`M${110 - pad} ${y} Q200 ${y + 7} ${290 + pad} ${y}`} stroke={line} strokeWidth={1.8} fill="none" opacity={0.8} />)}
          <path d="M168 182 L232 182 L236 214 Q200 224 164 214 Z" {...sh} />
          <path d="M200 186 L200 500" stroke={det} strokeWidth={2} />
        </>,
      )
    }

    /* ----- bottoms ----- */
    case 'chinos':
    case 'jeans':
    case 'trousers':
    case 'joggers':
    case 'shorts': {
      const shorts = s.kind === 'shorts'
      const hem = shorts ? 612 : 792
      let [oA, iA] = s.fit === 'slim' ? [126, 186] : s.fit === 'relaxed' ? [112, 198] : [120, 192]
      if (s.kind === 'joggers') [oA, iA] = [130, 182]
      if (shorts) [oA, iA] = s.fit === 'slim' ? [112, 194] : [104, 198]
      const d = `M114 462 L286 462 Q292 500 290 540 L${400 - oA} ${hem} L${400 - iA} ${hem} L203 556 L197 556 L${iA} ${hem} L${oA} ${hem} L110 540 Q108 500 114 462 Z`
      const stitch = s.kind === 'jeans' ? s.accent : det
      return {
        body: (
          <>
            <path d={d} {...sh} />
            <path d={`M290 540 L${400 - oA} ${hem} L${400 - oA - 16} ${hem} L276 548 Z`} fill="#000" opacity={0.08} />
            <path d={`M114 462 L286 462 L287 ${s.kind === 'joggers' ? 484 : 476} L113 ${s.kind === 'joggers' ? 484 : 476} Z`} fill={dark} stroke={line} strokeWidth={SW} strokeLinejoin="round" />
            <path d="M200 478 L200 530" stroke={stitch} strokeWidth={1.6} />
            {s.kind === 'jeans'
              ? <path d="M124 482 Q150 500 162 478 M276 482 Q250 500 238 478" stroke={stitch} strokeWidth={1.6} fill="none" />
              : <path d="M118 478 L134 522 M282 478 L266 522" stroke={det} strokeWidth={1.6} />}
            {s.kind === 'trousers' && <path d={`M157 566 L${(oA + iA) / 2} ${hem} M243 566 L${400 - (oA + iA) / 2} ${hem}`} stroke={shade(s.color, 0.12)} strokeWidth={1.4} opacity={0.8} />}
            {s.kind === 'joggers' && <><rect x={oA} y={hem - 20} width={iA - oA} height={20} fill={dark} /><rect x={400 - iA} y={hem - 20} width={iA - oA} height={20} fill={dark} /></>}
          </>
        ),
      }
    }

    /* ----- shoes ----- */
    case 'sneakers':
    case 'runners':
    case 'loafers':
    case 'derbies':
    case 'boots': {
      const foot = (cx: number, flip: boolean) => {
        const low = s.kind === 'loafers' || s.kind === 'derbies' || s.kind === 'boots'
        const upper = low
          ? `M${cx - 38} 832 Q${cx - 38} 812 ${cx - 10} 808 Q${cx + 30} 807 ${cx + 41} 822 L${cx + 41} 832 Z`
          : `M${cx - 40} 832 Q${cx - 42} 804 ${cx - 12} 800 Q${cx + 6} 798 ${cx + 20} 806 Q${cx + 42} 813 ${cx + 42} 832 Z`
        const soleH = s.kind === 'runners' ? 13 : low ? 7 : 11
        return (
          <g key={cx} transform={flip ? `translate(${cx * 2} 0) scale(-1 1)` : undefined}>
            {s.kind === 'boots' && <path d={`M${cx - 28} 768 L${cx + 22} 768 L${cx + 26} 814 L${cx - 30} 814 Z`} {...sh} />}
            <path d={upper} {...sh} />
            <rect x={cx - 43} y={829} width={86} height={soleH} rx={low ? 3 : 5} fill={s.accent} stroke={edge(s.accent)} strokeWidth={1.5} />
            {(s.kind === 'sneakers' || s.kind === 'runners' || s.kind === 'derbies') && <path d={`M${cx - 10} 810 L${cx + 2} 806 M${cx - 8} 816 L${cx + 6} 812`} stroke={det} strokeWidth={2} strokeLinecap="round" />}
            {s.kind === 'runners' && <path d={`M${cx - 30} 824 Q${cx} 812 ${cx + 30} 820`} stroke={s.accent} strokeWidth={3} fill="none" />}
            {s.kind === 'loafers' && <path d={`M${cx - 4} 812 L${cx + 20} 815`} stroke={det} strokeWidth={2.4} strokeLinecap="round" />}
          </g>
        )
      }
      return { body: <>{foot(148, true)}{foot(252, false)}</> }
    }

    /* ----- headwear (drawn outside the build transform) ----- */
    case 'cap':
      return {
        body: (
          <>
            <path d="M140 86 Q138 24 200 22 Q262 24 260 86 Q200 76 140 86 Z" {...sh} />
            <path d="M200 24 L200 78" stroke={line} strokeWidth={1.6} />
            <circle cx={200} cy={23} r={5} fill={dark} />
            <path d="M144 84 Q200 70 256 84 Q260 99 200 97 Q140 99 144 84 Z" fill={dark} stroke={line} strokeWidth={SW} strokeLinejoin="round" />
          </>
        ),
      }
    case 'beanie':
      return {
        body: (
          <>
            <path d="M138 90 Q134 16 200 14 Q266 16 262 90 Z" {...sh} />
            <rect x={136} y={64} width={128} height={28} rx={10} fill={dark} stroke={line} strokeWidth={SW} />
            {Array.from({ length: 15 }, (_, i) => <path key={i} d={`M${144 + i * 8} 68 L${144 + i * 8} 88`} stroke={line} strokeWidth={1} opacity={0.4} />)}
          </>
        ),
      }
    case 'bucket':
      return {
        body: (
          <>
            <path d="M152 74 Q154 24 200 24 Q246 24 248 74 Z" {...sh} />
            <path d="M132 94 L152 70 L248 70 L268 94 Q200 104 132 94 Z" fill={dark} stroke={line} strokeWidth={SW} strokeLinejoin="round" />
          </>
        ),
      }

    /* ----- accessories ----- */
    case 'watch':
      return {
        body: (
          <>
            <rect x={72} y={440} width={40} height={16} rx={4} fill={s.color} stroke={line} strokeWidth={1.5} />
            <circle cx={92} cy={448} r={11} fill={s.accent} stroke={edge(s.accent)} strokeWidth={1.5} />
            <circle cx={92} cy={448} r={7.5} fill="#f7f7f4" />
            <path d="M92 448 L92 443 M92 448 L95.5 450" stroke="#141416" strokeWidth={1.2} strokeLinecap="round" />
          </>
        ),
      }
    case 'belt':
      return {
        body: (
          <>
            <rect x={113} y={464} width={174} height={12} fill={fill} stroke={line} strokeWidth={1.5} />
            <rect x={189} y={461} width={22} height={18} rx={2} fill="none" stroke={s.accent} strokeWidth={3.5} />
            <path d="M193 470 L207 470" stroke={s.accent} strokeWidth={2} />
          </>
        ),
      }
    case 'crossbody':
      return {
        body: (
          <>
            <path d="M132 214 L280 484" stroke={dark} strokeWidth={7} strokeLinecap="round" />
            <rect x={258} y={470} width={82} height={64} rx={12} {...sh} />
            <path d="M258 478 Q258 470 270 470 L328 470 Q340 470 340 478 L340 500 Q299 512 258 500 Z" fill={dark} stroke={line} strokeWidth={SW} strokeLinejoin="round" />
          </>
        ),
      }
    case 'tote':
      return {
        body: (
          <>
            <path d="M290 502 Q309 452 330 502" stroke={dark} strokeWidth={5} fill="none" />
            <path d="M274 500 L346 500 L354 592 L266 592 Z" {...sh} />
          </>
        ),
      }
    case 'backpack':
      return {
        body: (
          <>
            {[false, true].map((r) => (
              <path key={String(r)} d={`M${X(152, r)} 210 Q${X(140, r)} 280 ${X(146, r)} 344`} stroke={line} strokeWidth={17} fill="none" strokeLinecap="round" />
            ))}
            {[false, true].map((r) => (
              <path key={`f${r}`} d={`M${X(152, r)} 210 Q${X(140, r)} 280 ${X(146, r)} 344`} stroke={s.color} strokeWidth={13} fill="none" strokeLinecap="round" />
            ))}
          </>
        ),
      }
  }
}

/* ---------- Standalone thumbnail ---------- */

function thumbBox(p: Drawable): string {
  switch (KIND_SLOT[p.spec.kind]) {
    case 'top':
    case 'mid': return '52 166 296 360'
    case 'outer': return p.spec.kind === 'overcoat' ? '24 166 352 500' : '40 166 320 380'
    case 'bottom': return p.spec.kind === 'shorts' ? '70 450 260 180' : '60 450 280 360'
    case 'shoes': return '96 750 208 104'
    case 'headwear': return '122 6 156 104'
    case 'watch': return '60 428 66 42'
    case 'belt': return '104 440 192 60'
    case 'bag': return p.spec.kind === 'tote' ? '240 440 140 170' : p.spec.kind === 'backpack' ? '110 196 180 168' : '120 196 240 360'
  }
}

export function GarmentThumb({ p, className }: { p: Drawable; className?: string }) {
  const parts = garmentParts(p)
  return (
    <svg viewBox={thumbBox(p)} className={className} role="img" aria-hidden="true">
      <defs><PatternDef p={p} /></defs>
      {parts.body}
      {parts.collar}
    </svg>
  )
}
