/** Beats (seconds): approach and spot the enemy, aim without the scope, SHOT, a hard cut to the bullet, slow motion, a rush into the head, a hit-stop,
 *  the fall, then the title. Every phase is a pure function of elapsed time, so playback, scrubbing and the tests agree at any frame rate. */
export const NOSCOPE_SHOT = 1.25;
export const NOSCOPE_CUT = 1.55;
export const NOSCOPE_HIT = 4.0;
export const NOSCOPE_STOP = .12;
export const NOSCOPE_FALL = NOSCOPE_HIT + NOSCOPE_STOP;
export const NOSCOPE_REVEAL = NOSCOPE_FALL + .93;
/** The title starts slamming in at about 5 s, is all in place by 6.2 s and holds before the fade. */
export const NOSCOPE_DURATION = 8.4;
export const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const smooth = (a: number, b: number, t: number) => { const u = clamp((t - a) / (b - a)); return u * u * (3 - 2 * u); };

/** Distance travelled along the bullet's path for progress s (0..1): a slow crawl that keeps moving, then a hard rush into the target. */
const SLOW = .4, POWER = 6;
const travelled = (s: number) => SLOW * s + (1 - SLOW) * Math.pow(s, POWER);
const velocity = (s: number) => SLOW + (1 - SLOW) * POWER * Math.pow(s, POWER - 1);
const acceleration = (s: number) => (1 - SLOW) * POWER * (POWER - 1) * Math.pow(s, POWER - 2);

/** Seconds since the end-card title started slamming in (negative before). */
export const noscopeTitleAge = (seconds: number) => seconds - (NOSCOPE_REVEAL - .1);

export function noscopeTime(seconds: number) {
  const e = Math.max(0, Math.min(NOSCOPE_DURATION, seconds));
  const s = clamp((e - NOSCOPE_CUT) / (NOSCOPE_HIT - NOSCOPE_CUT));
  const flight = e >= NOSCOPE_HIT ? 1 : travelled(s);
  // The ragdoll plays at about 0.6x after the stop, then settles even more slowly.
  const rag = e < NOSCOPE_FALL ? 0 : e < NOSCOPE_FALL + .87 ? (e - NOSCOPE_FALL) / .87 * .55 : Math.min(.7, .55 + (e - NOSCOPE_FALL - .87) / 1.05 * .15);
  return {
    elapsed: e, flight,
    /** 0 in first person, 1 once the camera has cut to the bullet. */
    chase: e >= NOSCOPE_CUT ? 1 : 0,
    /** First-person walk-in progress, easing to a stop as the aim settles. */
    walk: 1 - Math.pow(1 - clamp(e / NOSCOPE_SHOT), 2.2),
    /** The bare crosshair appears as the aim settles, and is gone with the shot. */
    cross: e < NOSCOPE_SHOT ? smooth(.7, 1.0, e) : 0,
    shotAge: Math.max(0, e - NOSCOPE_SHOT),
    cutAge: Math.max(0, e - NOSCOPE_CUT),
    speed: e >= NOSCOPE_CUT && e < NOSCOPE_HIT ? velocity(s) / velocity(1) : 0,
    /** 0 in the crawl, 1 at the hit, then gone within a tenth of a second: drives the speed lines, the radial blur and the field of view. */
    rush: e >= NOSCOPE_HIT ? 1 - smooth(NOSCOPE_HIT, NOSCOPE_HIT + .13, e) : e >= NOSCOPE_CUT ? smooth(.55, 1, s) : 0,
    acceleration: e >= NOSCOPE_CUT && e < NOSCOPE_HIT ? acceleration(s) / acceleration(1) : 0,
    hitAge: Math.max(0, e - NOSCOPE_HIT),
    rag, fall: smooth(.06, .55, rag), drop: smooth(.04, .45, rag),
    reveal: smooth(NOSCOPE_REVEAL - .1, NOSCOPE_REVEAL + .15, e),
    titleScale: 1 + .16 * Math.exp(-Math.max(0, e - NOSCOPE_REVEAL) * 10) * Math.cos(Math.max(0, e - NOSCOPE_REVEAL) * 20),
    opacity: 1 - smooth(NOSCOPE_DURATION - .55, NOSCOPE_DURATION, e),
    done: seconds >= NOSCOPE_DURATION,
  };
}
