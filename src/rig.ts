// The body rig every garment is built on. One set of landmarks, so a shirt, a sweater and a jacket
// all wrap the same shoulders, arms and legs, each layer a little larger than the one beneath it.
// Canvas: 400 x 880. Realistic proportions: about 7.5 heads tall (head 14-131, soles at 874).
// Pose: relaxed A-pose (arms slightly away from the body), front view.

export type Pt = [number, number]
export interface Curve { p0: Pt; c: Pt; p1: Pt }

/** Left arm centerline: shoulder joint -> (elbow) -> wrist. The right arm is its mirror image. */
export const ARM: Curve = { p0: [113, 190], c: [90, 322], p1: [82, 450] }
/** Left leg centerline: hip joint -> (knee) -> ankle. */
export const LEG: Curve = { p0: [156, 440], c: [161, 640], p1: [152, 840] }

const lerpKeys = (keys: [number, number][]) => (t: number) => {
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1]
    if (t <= t1) {
      const u = (t - t0) / (t1 - t0), s = u * u * (3 - 2 * u)
      return v0 + (v1 - v0) * s
    }
  }
  return keys[keys.length - 1][1]
}
/** Skin width along the arm: deltoid, biceps, elbow, forearm, wrist. */
export const armW = lerpKeys([[0, 44], [0.25, 38], [0.48, 32], [0.62, 33], [1, 24]])
/** Skin width along the leg: upper thigh, knee, calf, ankle. */
export const legW = lerpKeys([[0, 86], [0.22, 74], [0.46, 50], [0.6, 55], [0.86, 38], [1, 31]])

export const mx = (p: Pt): Pt => [400 - p[0], p[1]]
const r1 = (n: number) => Math.round(n * 10) / 10

export function at(c: Curve, t: number): Pt {
  const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, d = t * t
  return [a * c.p0[0] + b * c.c[0] + d * c.p1[0], a * c.p0[1] + b * c.c[1] + d * c.p1[1]]
}
export function tangent(c: Curve, t: number): Pt {
  const x = 2 * (1 - t) * (c.c[0] - c.p0[0]) + 2 * t * (c.p1[0] - c.c[0])
  const y = 2 * (1 - t) * (c.c[1] - c.p0[1]) + 2 * t * (c.p1[1] - c.c[1])
  const l = Math.hypot(x, y) || 1
  return [x / l, y / l]
}
/** Rotation (degrees) that turns a shape drawn pointing down (+y) to follow the curve at t. */
export function angleAt(c: Curve, t: number): number {
  const d = tangent(c, t)
  return (Math.atan2(d[1], d[0]) * 180) / Math.PI - 90
}

/** Smooth path through points (Catmull-Rom as cubic Beziers). With move=false it continues the current path. */
export function smooth(pts: Pt[], move = true): string {
  let s = `${move ? 'M' : 'L'}${r1(pts[0][0])} ${r1(pts[0][1])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    s += ` C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`
  }
  return s
}

/** The two edges of a tube at t: [outer, inner] for the left limb (outer is screen-left). */
export function edges(c: Curve, t: number, w: number, mirror = false): [Pt, Pt] {
  const p = at(c, t), d = tangent(c, t), h = w / 2
  const a: Pt = [p[0] + d[1] * h, p[1] - d[0] * h]
  const b: Pt = [p[0] - d[1] * h, p[1] + d[0] * h]
  // For a downward curve d≈(0,1): a = p + (h, 0) is screen-right. Swap so index 0 is outer (screen-left).
  const out: [Pt, Pt] = a[0] < b[0] ? [a, b] : [b, a]
  return mirror ? [mx(out[0]), mx(out[1])] : out
}

/** Closed outline of a tube along a curve (an arm, a sleeve, a trouser leg), with a rounded end at t1. */
export function limb(c: Curve, t0: number, t1: number, w: (t: number) => number, mirror = false, n = 14): string {
  const L: Pt[] = [], R: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n
    const [o, inn] = edges(c, t, w(t))
    L.push(o)
    R.push(inn)
  }
  const m = (p: Pt) => (mirror ? mx(p) : p)
  return `${smooth(L.map(m))} ${smooth(R.reverse().map(m), false)} Z`
}

/** A straight line across a tube at t (cuff edge, quilting line). */
export function across(c: Curve, t: number, w: number, mirror = false): string {
  const [A, B] = edges(c, t, w, mirror)
  return `M${r1(A[0])} ${r1(A[1])} L${r1(B[0])} ${r1(B[1])}`
}

/** A point part-way across a tube at t: u=0 outer edge, u=1 inner edge. */
export function on(c: Curve, t: number, w: number, u: number, mirror = false): Pt {
  const [A, B] = edges(c, t, w, mirror)
  return [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u]
}

/**
 * Torso contour for a layer `d` units out from the body, from the neck point down to the hem (left side).
 * The shoulder cap reaches out over the top of the sleeve so sleeve and body read as one piece.
 */
export function torsoSide(d: number, hem: number, flare: number, neckL: Pt): Pt[] {
  return [
    neckL,
    [148 - d * 0.5, 158 - d * 0.4],
    [112 - d, 172 - d * 0.5],
    [98 - d, 200],
    [126 - d * 0.8, 248],
    [128 - d, 296],
    [131 - d, 346],
    [130 - d, 392],
    [126 - d - flare, hem],
  ]
}

/** Closed torso of a garment. `neck` runs from the right neck point back to the left one, e.g. "Q200 176 183 150". */
export function torso(d: number, hem: number, flare: number, neckL: Pt, neck: string): string {
  const left = torsoSide(d, hem, flare, neckL)
  const right = left.map(mx).reverse()
  return `${smooth(left)} Q200 ${hem + 6} ${r1(right[0][0])} ${r1(right[0][1])} ${smooth(right, false)} ${neck} Z`
}

/** Left front panel of an open garment (cardigan, jacket); mirror it for the right panel. */
export function panel(d: number, hem: number, flare: number, neckL: Pt, edgeX: number, openY: number): string {
  const left = torsoSide(d, hem, flare, neckL)
  const h = left[left.length - 1]
  return `${smooth(left)} Q${r1((h[0] + edgeX) / 2)} ${hem + 5} ${edgeX} ${hem} L${edgeX} ${openY} L${neckL[0]} ${neckL[1]} Z`
}

/** Armhole seam line (shoulder point down to the armpit), for set-in sleeves. */
export function armhole(d: number, mirror = false): string {
  const a: Pt = [112 - d, 174 - d * 0.5], c: Pt = [122 - d, 214], b: Pt = [126 - d * 0.8, 248]
  const m = (q: Pt) => (mirror ? mx(q) : q)
  const [A, C, B] = [m(a), m(c), m(b)]
  return `M${r1(A[0])} ${r1(A[1])} Q${r1(C[0])} ${r1(C[1])} ${r1(B[0])} ${r1(B[1])}`
}

/** Round shoulder cap (deltoid) so a sleeve or arm meets the torso in a curve, not a corner. */
export function shoulderCap(ease: number): string {
  const r = (armW(0) + ease) / 2 + 2, cx = ARM.p0[0] - 1, cy = ARM.p0[1] + 9
  return `M${r1(cx - r)} ${cy} a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0 a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0 Z`
}

/** Wrist position at the end of the left arm. */
export function wristPoint(): Pt {
  return at(ARM, 1)
}

/** Skin silhouette pieces (drawn in two passes so they merge into one outline). */
export function bodyShapes(): { limbs: string[]; torso: string } {
  const left: Pt[] = [[184, 148], [148, 160], [112, 174], [98, 200], [126, 248], [128, 296], [133, 350], [127, 410], [119, 452]]
  const right = left.map(mx).reverse()
  return {
    limbs: [
      limb(LEG, 0, 1.01, legW), limb(LEG, 0, 1.01, legW, true),
      limb(ARM, 0.05, 1, armW), limb(ARM, 0.05, 1, armW, true),
      shoulderCap(0), // left only; the avatar mirrors it
    ],
    torso: `${smooth(left)} Q200 476 ${right[0][0]} ${right[0][1]} ${smooth(right, false)} L184 148 Z`,
  }
}

/** Relaxed hand, drawn pointing down from the wrist at the origin; thumb on the inner (+x) side. */
export const HAND = 'M-12 -6 C-15 14 -16 38 -14 58 C-13 74 -8 90 0 92 C8 93 13 84 14 70 C15 50 15 24 12 -6 Z'
export const THUMB = 'M8 8 C18 16 22 32 18 50 C16 56 10 55 9 49 C8 38 6 26 2 16 Z'
/** Finger separations on the hand (drawn faintly). */
export const FINGERS = 'M-6 54 Q-5 74 -2 88 M2 52 Q4 72 5 90 M8 50 Q10 66 10 82'
