/** A CSS cubic-bezier timing curve as its x(t) and y(t) polynomials, so a transition can be sampled both ways. */
export type Bezier = readonly [number, number, number, number];
/** The curve the case reel's CSS transition uses (see CaseReel): a fast start that settles slowly. */
export const REEL_CURVE: Bezier = [0.08, 0.75, 0.16, 1];
export const REEL_MS = 2400;

const at = (a: number, b: number, t: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;

/** When (0 to 1 of the duration) a transition on this curve reaches `progress` (0 to 1 of the distance). */
export function timeAtProgress(progress: number, [x1, y1, x2, y2]: Bezier = REEL_CURVE): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (at(y1, y2, mid) < progress) lo = mid; else hi = mid;
  }
  return at(x1, x2, (lo + hi) / 2);
}

/**
 * The moments, in ms after the transition starts, at which the reel's centre marker passes from one item to the next.
 * The strip moves `travel` px to the left over `duration` ms; the marker sits `half` px in from the strip's left edge
 * and items repeat every `step` px, so the ticks bunch up at the start and stretch out as the reel settles.
 */
export function reelTickTimes(travel: number, half: number, step: number, duration = REEL_MS, curve: Bezier = REEL_CURVE): number[] {
  const times: number[] = [];
  if (travel <= 0 || step <= 0) return times;
  for (let k = Math.floor(half / step) + 1; k * step <= travel + half; k++) {
    times.push(timeAtProgress((k * step - half) / travel, curve) * duration);
  }
  return times;
}
