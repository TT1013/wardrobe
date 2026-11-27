// The body rig every garment is built on. One set of landmarks, so a shirt, a sweater and a jacket
// all wrap the same shoulders, arms and legs, each layer a little larger than the one beneath it.
// Canvas: 400 x 880. Pose: relaxed A-pose (arms slightly away from the body), front view.

export type Pt = [number, number]
export interface Curve { p0: Pt; c: Pt; p1: Pt }

/** Left arm centerline: shoulder -> (elbow) -> wrist. The right arm is its mirror image. */
export const ARM: Curve = { p0: [122, 234], c: [93, 346], p1: [76, 456] }
/** Left leg centerline: hip -> (knee) -> ankle. */
export const LEG: Curve = { p0: [160, 486], c: [158, 646], p1: [154, 800] }

export const armW = (t: number) => 40 - 12 * t // skin width along the arm
export const legW = (t: number) => 70 - 28 * t // skin width along the leg

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

/** Closed outline of a tube along a curve (an arm, a sleeve, a trouser leg). */
export function limb(c: Curve, t0: number, t1: number, w: (t: number) => number, mirror = false, n = 12): string {
  const L: Pt[] = [], R: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n
    const p = at(c, t), d = tangent(c, t), h = w(t) / 2
    L.push([p[0] - d[1] * h, p[1] + d[0] * h])
    R.push([p[0] + d[1] * h, p[1] - d[0] * h])
  }
  const m = (p: Pt) => (mirror ? mx(p) : p)
  return `${smooth(L.map(m))} ${smooth(R.reverse().map(m), false)} Z`
}

/** A straight line across a tube at t (cuff edge, quilting line). */
export function across(c: Curve, t: number, w: number, mirror = false): string {
  const p = at(c, t), d = tangent(c, t), h = w / 2
  const a: Pt = [p[0] - d[1] * h, p[1] + d[0] * h], b: Pt = [p[0] + d[1] * h, p[1] - d[0] * h]
  const m = (q: Pt) => (mirror ? mx(q) : q)
  const [A, B] = [m(a), m(b)]
  return `M${r1(A[0])} ${r1(A[1])} L${r1(B[0])} ${r1(B[1])}`
}

/** Torso contour for a layer `d` units out from the body, from the neck point down to the hem (left side). */
export function torsoSide(d: number, hem: number, flare: number, neckL: Pt): Pt[] {
  return [neckL, [101 - d, 229 - d * 0.2], [133 - d * 0.9, 272], [130 - d, 420], [127 - d - flare, hem]]
}

/** Closed torso of a garment. `neck` runs from the right neck point back to the left one, e.g. "Q200 216 180 200". */
export function torso(d: number, hem: number, flare: number, neckL: Pt, neck: string): string {
  const left = torsoSide(d, hem, flare, neckL)
  const right = left.map(mx).reverse()
  return `${smooth(left)} Q200 ${hem + 5} ${r1(right[0][0])} ${r1(right[0][1])} ${smooth(right, false)} ${neck} Z`
}

/** Left front panel of an open garment (cardigan, jacket); mirror it for the right panel. */
export function panel(d: number, hem: number, flare: number, neckL: Pt, edgeX: number, openY: number): string {
  const left = torsoSide(d, hem, flare, neckL)
  const h = left[left.length - 1]
  return `${smooth(left)} Q${r1((h[0] + edgeX) / 2)} ${hem + 4} ${edgeX} ${hem} L${edgeX} ${openY} L${neckL[0]} ${neckL[1]} Z`
}

/** Armhole seam line (shoulder point down to the armpit), for set-in sleeves. */
export function armhole(d: number, mirror = false): string {
  const a: Pt = [101 - d, 229 - d * 0.2], c: Pt = [124 - d, 246], b: Pt = [133 - d * 0.9, 272]
  const m = (q: Pt) => (mirror ? mx(q) : q)
  const [A, C, B] = [m(a), m(c), m(b)]
  return `M${r1(A[0])} ${r1(A[1])} Q${r1(C[0])} ${r1(C[1])} ${r1(B[0])} ${r1(B[1])}`
}

/** Hand position at the end of the left arm. */
export function handPoint(): Pt {
  const w = at(ARM, 1), d = tangent(ARM, 1)
  return [w[0] + d[0] * 18, w[1] + d[1] * 18]
}

/** Skin silhouette pieces (drawn in two passes so they merge into one outline). */
export function bodyShapes(): { limbs: string[]; torso: string } {
  const left: Pt[] = [[184, 198], [102, 230], [134, 272], [130, 420], [124, 486]]
  const right = left.map(mx).reverse()
  return {
    limbs: [
      limb(LEG, -0.05, 1, legW), limb(LEG, -0.05, 1, legW, true),
      limb(ARM, 0, 1, armW), limb(ARM, 0, 1, armW, true),
    ],
    torso: `${smooth(left)} Q200 494 ${right[0][0]} ${right[0][1]} ${smooth(right, false)} Q200 190 184 198 Z`,
  }
}
