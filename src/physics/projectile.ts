export const GRAVITY = 9.81;

export interface SimPoint {
  /** Horizontal distance from launcher in meters. */
  x: number;
  /** Height above launch plane in meters. */
  y: number;
  /** Time since launch in seconds. */
  t: number;
  /** Horizontal velocity component (m/s). */
  vx: number;
  /** Vertical velocity component (m/s). */
  vy: number;
}

export interface SimParams {
  /** Launch angle in degrees, 0–90. */
  angle: number;
  /** Initial speed in m/s. */
  velocity: number;
  gravity?: number;
  /** Simulation step in seconds. */
  dt?: number;
  /** Hard cap on flight time to keep near-vertical shots bounded. */
  maxT?: number;
}

/**
 * Forward-simulate the parabolic flight under gravity (no drag).
 * Returns points sampled at `dt`, terminated when the projectile lands (y <= 0 after t > 0)
 * or `maxT` is reached. The terminal point is interpolated to y = 0 exactly when applicable.
 */
export function simulate(params: SimParams): SimPoint[] {
  const angle = clamp(params.angle, 0, 90);
  const v0 = Math.max(0, params.velocity);
  const g = params.gravity ?? GRAVITY;
  const dt = params.dt ?? 0.02;
  const maxT = params.maxT ?? 4;

  const rad = (angle * Math.PI) / 180;
  const vx0 = v0 * Math.cos(rad);
  const vy0 = v0 * Math.sin(rad);

  const points: SimPoint[] = [];
  points.push({ x: 0, y: 0, t: 0, vx: vx0, vy: vy0 });

  if (v0 === 0) return points;

  let t = 0;
  while (t < maxT) {
    t += dt;
    const x = vx0 * t;
    const y = vy0 * t - 0.5 * g * t * t;
    const vy = vy0 - g * t;
    if (y <= 0 && t > dt) {
      // Interpolate exact landing point: y(tL) = 0  =>  tL = 2*vy0/g (when y0=0)
      const tL = (2 * vy0) / g;
      const xL = vx0 * tL;
      points.push({ x: xL, y: 0, t: tL, vx: vx0, vy: -vy0 });
      break;
    }
    points.push({ x, y, t, vx: vx0, vy });
  }
  return points;
}

/** Get interpolated point along the precomputed trajectory at time `t` (seconds). */
export function sampleAt(points: SimPoint[], t: number): SimPoint {
  if (points.length === 0) return { x: 0, y: 0, t: 0, vx: 0, vy: 0 };
  if (t <= 0) return points[0];
  const last = points[points.length - 1];
  if (t >= last.t) return last;
  // Binary search for the segment
  let lo = 0;
  let hi = points.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  const span = b.t - a.t || 1;
  const k = (t - a.t) / span;
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    t,
    vx: a.vx + (b.vx - a.vx) * k,
    vy: a.vy + (b.vy - a.vy) * k,
  };
}

/** Magnitude of velocity at a sim point. */
export function speedOf(p: SimPoint): number {
  return Math.hypot(p.vx, p.vy);
}

/** Angle of the current velocity vector (degrees, signed: positive ascending, negative descending). */
export function velocityAngleDeg(p: SimPoint): number {
  return (Math.atan2(p.vy, p.vx) * 180) / Math.PI;
}

/** Max height across all sim points. */
export function maxHeight(points: SimPoint[]): number {
  let m = 0;
  for (const p of points) if (p.y > m) m = p.y;
  return m;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
