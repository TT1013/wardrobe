import type { ReactElement } from 'react'
import { PatternDef, SharedDefs, garmentParts } from './GarmentArt'
import { ARM, FINGERS, HAND, LEG, THUMB, angleAt, at, bodyShapes, wristPoint } from './rig'
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

const base = (id: string, kind: 'tee' | 'shorts', color: string): Piece =>
  ({ id, spec: { kind, color, accent: color, pattern: 'solid', fit: 'slim', tucked: false } }) as Piece

export function Avatar({ config, wearing, pieces, className, showBase = true, animate = false }: Props) {
  const bx = config.build === 'slim' ? 0.93 : config.build === 'stocky' ? 1.1 : 1
  const skin = config.skin
  const skinD = shade(skin, -0.14)
  const skinLine = shade(skin, -0.3)
  const hair = config.hair
  const get = (s: Slot) => (wearing[s] ? pieces.find((p) => p.id === wearing[s] && p.spec) : undefined)
  const buildT = `translate(200 0) scale(${bx} 1) translate(-200 0)`

  const top = get('top'), mid = get('mid'), outer = get('outer')
  const parts = (p?: Piece) => (p ? garmentParts(p) : undefined)
  const topP = parts(top), midP = parts(mid), outerP = parts(outer)
  const tucked = !!top?.spec.tucked
  const shadow = (el: ReactElement | undefined, key: string) => el && <g key={key} filter="url(#layer-shadow)">{el}</g>

  // Nothing on top or bottom: a plain fitted base layer, like a character creator's default.
  const baseTop = !top && !mid && !outer && showBase ? garmentParts(base('base-top', 'tee', '#cfd2d6')).body : undefined
  const baseBottom = !get('bottom') && showBase ? garmentParts(base('base-bottom', 'shorts', '#4a4f57')).body : undefined

  // Back to front. A tucked shirt goes under the trousers; a shirt collar lies over a sweater's neckline.
  const stack: (ReactElement | undefined)[] = [
    tucked ? topP?.body : undefined,
    parts(get('shoes'))?.body,
    parts(get('bottom'))?.body ?? baseBottom,
    parts(get('belt'))?.body,
    !tucked ? topP?.body : undefined,
    baseTop,
    midP ? shadow(midP.body, 'mid') : undefined,
    topP?.collar,
    outerP ? shadow(outerP.body, 'outer') : undefined,
    parts(get('bag'))?.body,
    parts(get('watch'))?.body,
  ]
  const worn = pieces.filter((p) => p.spec && Object.values(wearing).includes(p.id))

  const body = bodyShapes()
  const w = wristPoint()
  const handRot = angleAt(ARM, 1)
  const ankle = at(LEG, 1)
  const handT = (mirror: boolean) => `${mirror ? 'translate(400 0) scale(-1 1) ' : ''}translate(${w[0]} ${w[1]}) rotate(${handRot})`
  const footD = (cx: number) => `M${cx - 14} 828 Q${cx - 24} 850 ${cx - 23} 865 Q${cx - 22} 872 ${cx - 14} 872 L${cx + 14} 872 Q${cx + 22} 872 ${cx + 23} 865 Q${cx + 24} 850 ${cx + 14} 828 Z`
  // Every skin piece, so the outline and fill passes merge arms, hands, torso, legs and feet into one figure.
  const skinShapes: { d: string; t?: string }[] = [
    ...body.limbs.map((d) => ({ d })),
    { d: body.limbs[body.limbs.length - 1], t: 'translate(400 0) scale(-1 1)' },
    { d: body.torso },
    ...[false, true].flatMap((m) => [{ d: HAND, t: handT(m) }, { d: THUMB, t: handT(m) }]),
    { d: footD(ankle[0]), t: `rotate(5 ${ankle[0]} 836)` },
    { d: footD(400 - ankle[0]), t: `rotate(-5 ${400 - ankle[0]} 836)` },
  ]

  return (
    <svg viewBox="0 0 400 880" className={className} role="img" aria-label="TT13 avatar">
      <defs>
        <SharedDefs />
        <radialGradient id="floor" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.28" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        {worn.map((p) => <PatternDef key={p.id} p={p} />)}
      </defs>
      <ellipse cx={200} cy={872} rx={110} ry={10} fill="url(#floor)" />
      <g className={animate ? 'breathe' : undefined}>
        {/* body: drawn in two passes so arms, torso and legs read as one figure, then lit for volume */}
        <g transform={buildT}>
          <g filter="url(#vol)">
            {skinShapes.map((s, i) => <path key={`o${i}`} d={s.d} transform={s.t} fill={skinLine} stroke={skinLine} strokeWidth={1.4} strokeLinejoin="round" />)}
            {skinShapes.map((s, i) => <path key={`f${i}`} d={s.d} transform={s.t} fill={skin} />)}
            {[false, true].map((m) => <path key={`h${m}`} d={FINGERS} transform={handT(m)} stroke={skinLine} strokeWidth={0.8} fill="none" opacity={0.45} />)}
            {/* collarbones and kneecaps, faint */}
            <path d="M184 156 Q160 160 136 166 M216 156 Q240 160 264 166" stroke={skinD} strokeWidth={1.4} fill="none" opacity={0.45} />
          </g>
        </g>

        {/* head */}
        <g filter="url(#vol)">
          <path d="M184 104 L183 156 Q200 166 217 156 L216 104 Z" fill={shade(skin, -0.06)} />
          <ellipse cx={154} cy={80} rx={8} ry={14} fill={skin} stroke={skinLine} strokeWidth={1.2} />
          <ellipse cx={246} cy={80} rx={8} ry={14} fill={skin} stroke={skinLine} strokeWidth={1.2} />
          <path d="M200 14 C238 14 248 42 247 72 C246 98 238 114 224 124 C214 131 207 133 200 133 C193 133 186 131 176 124 C162 114 154 98 153 72 C152 42 162 14 200 14 Z" fill={skin} stroke={skinLine} strokeWidth={1.2} />
        </g>
        {/* chin shadow on the neck */}
        <path d="M184 126 Q200 144 216 126 L216 134 Q200 150 184 134 Z" fill="#000" opacity={0.08} filter="url(#soft)" />
        {/* hair: short, dark, a little volume on top */}
        <g filter="url(#vol)">
          <path d="M153 74 C148 38 166 6 204 6 C240 6 254 32 248 74 C246 58 242 46 234 40 C214 48 186 46 164 38 C158 48 155 60 153 74 Z" fill={hair} />
          <path d="M153 74 L155 88 L158 74 Z M247 74 L245 88 L242 74 Z" fill={hair} />
        </g>
        {/* brows */}
        <path d="M166 56 Q179 49 193 54" stroke={hair} strokeWidth={4.2} strokeLinecap="round" fill="none" />
        <path d="M207 54 Q221 49 234 56" stroke={hair} strokeWidth={4.2} strokeLinecap="round" fill="none" />
        {/* eyes, slightly narrowed by the smile */}
        <path d="M172 72 Q180 65 189 72 Q180 76 172 72 Z" fill="#fff" />
        <path d="M211 72 Q220 65 228 72 Q220 76 211 72 Z" fill="#fff" />
        <circle cx={180.5} cy={71} r={3.6} fill="#2b1a12" />
        <circle cx={219.5} cy={71} r={3.6} fill="#2b1a12" />
        <circle cx={181.6} cy={69.8} r={1.1} fill="#fff" />
        <circle cx={220.6} cy={69.8} r={1.1} fill="#fff" />
        <path d="M172 72 Q180 64 189 72 M211 72 Q220 64 228 72" stroke="#2b1a12" strokeWidth={1.4} fill="none" />
        {/* nose */}
        <path d="M199 76 Q196 90 194 96 Q199 101 206 97" stroke={skinD} strokeWidth={1.8} fill="none" strokeLinecap="round" />
        <path d="M193 96 Q190 92 192 89 M207 96 Q210 92 208 89" stroke={skinD} strokeWidth={1.2} fill="none" opacity={0.7} />
        {/* big smile */}
        <path d="M183 109 Q200 124 217 109 Q200 113 183 109 Z" fill="#fbfaf7" stroke="#8a4a42" strokeWidth={1.8} strokeLinejoin="round" />
        <path d="M188 118 Q200 124 212 118" stroke="#b8706a" strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.6} />
        <path d="M178 104 Q176 110 180 114 M222 104 Q224 110 220 114" stroke={skinD} strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={0.55} />
        {/* glasses: thick black frames */}
        {config.glasses && (
          <g fill="rgba(255,255,255,0.1)" stroke="#0e0e0f" strokeWidth={4.4} strokeLinejoin="round">
            <rect x={164} y={60} width={32} height={24} rx={6} />
            <rect x={204} y={60} width={32} height={24} rx={6} />
            <path d="M196 68 Q200 65 204 68" fill="none" />
            <path d="M164 66 L153 70 M236 66 L247 70" fill="none" strokeLinecap="round" />
          </g>
        )}

        {/* clothes */}
        <g transform={buildT}>{stack.map((el, i) => el && <g key={i}>{el}</g>)}</g>
        {parts(get('headwear'))?.body}
      </g>
    </svg>
  )
}
