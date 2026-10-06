/** The 1v5 CLUTCH clock. Elapsed seconds are the only animation state: every value is a pure function of `t`, so playback, the scrubber and the tests
 *  agree at any frame rate and at any seek.
 *
 *  It is cut like a slow, deliberate shot, not a montage: one camera that never cuts, a reticle that glides from enemy to enemy so it is always clear who
 *  is being shot, and every enemy falling in slow motion where it can be seen.
 *
 *   0.0   the scene fades up out of black on a wide view: the survivor in the foreground, five enemies facing him
 *   0.6   "1 VS 5" over it, held long enough to read
 *   2.1   the markers move up into the tally and the reticle appears, then glides to the first enemy
 *   2.7   kill 1; the reticle slides on to the next while the first one falls: 3.7, 4.6, 5.4 and 6.1 (the rhythm tightens)
 *   6.1   after the fifth kill a bright flash, a moment to see it fall, then a slow dip to dark
 *   7.3   the hero shot: the survivor standing among the five, backlit; the camera creeps forward
 *   8.2   1V5 / CLUTCH lands (the 3D title); the player plate follows at 9.2
 *   10.1  fade back to the match */
export const CLUTCH_DURATION = 10.8;
export const KILLS = [2.7, 3.7, 4.6, 5.4, 6.1] as const;
export const RETICLE_ON = 2.1;
/** The reticle sits on an enemy from just before its kill until just after it, then glides to the next. */
const HOLD_BEFORE = .22, HOLD_AFTER = .16;
export const DIP_AT = 6.85, SWAP_AT = 7.25, HERO_AT = 7.3;
export const TITLE_AT = 8.2;
export const PERSON_AT = 9.2;
export const FADE_AT = 10.1;
/** How hard each kill shakes the frame, as a fraction of its height (kill 5 is the strongest). */
export const SHAKE = [.002, .0025, .003, .0035, .006] as const;
/** The fall runs slower than real time (the ragdoll was tuned for a fast head shot), so it can be watched. */
export const FALL_SLOW = .5;

export const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const line = (a: number, b: number, t: number) => clamp((t - a) / (b - a));
export const out = (a: number, b: number, t: number) => 1 - (1 - line(a, b, t)) ** 3;
export const smooth = (a: number, b: number, t: number) => { const u = line(a, b, t); return u * u * (3 - 2 * u); };

export type ShotId = 'track' | 'hero';

/** Seconds on the 3D title's own clock. */
export const titleAge = (t: number) => t - TITLE_AT;

/** Where the reticle is, as an enemy index that may sit between two (`p`, from -1 for the middle of the group to 4), how tight it is (0 wide open, 1 locked) and
 *  whether it is on screen. */
export function reticle(t: number) {
  if (t < RETICLE_ON) return { on: 0, p: -1, lock: 0 };
  let p = 4, lock = 0;
  const arrive = (i: number) => KILLS[i] - HOLD_BEFORE, leave = (i: number) => KILLS[i] + HOLD_AFTER;
  // before the first kill it glides in from the middle of the group; after that it holds on each enemy, then slides to the next
  if (t < arrive(0)) p = -1 + smooth(RETICLE_ON + .1, arrive(0), t);
  else for (let i = 0; i < 4; i++) { if (t < leave(i)) { p = i; break; } if (t < arrive(i + 1)) { p = i + smooth(leave(i), arrive(i + 1), t); break; } }
  for (let i = 0; i < 5; i++) if (t < KILLS[i] + HOLD_AFTER) { lock = smooth(KILLS[i] - .75, KILLS[i] - .06, t); break; }
  if (t >= KILLS[4] + HOLD_AFTER) lock = 1;
  const on = out(RETICLE_ON, RETICLE_ON + .3, t) * (1 - smooth(KILLS[4] + .3, KILLS[4] + .7, t));
  return { on, p, lock };
}

export function clutchTime(seconds: number) {
  const t = Math.max(0, Math.min(CLUTCH_DURATION, seconds));
  const kills = KILLS.filter((k) => t >= k).length;
  const shot: ShotId = t >= HERO_AT ? 'hero' : 'track';
  // each marker: lit until its kill, flashes orange for a moment, then is crossed out and fades
  const markers = KILLS.map((k) => ({ alive: t < k, flash: t >= k ? Math.exp(-(t - k) * 3.2) : 0, gone: out(k + .15, k + .7, t), hit: t >= k }));
  // the shake is a short kick, so it stays on real time
  const shake = KILLS.reduce((sum, k, i) => sum + (t >= k ? SHAKE[i] * Math.exp(-(t - k) * 9) : 0), 0);
  const lastKill = KILLS[KILLS.length - 1];
  return {
    t, shot, kill: kills - 1, hero: shot === 'hero', swapped: t >= SWAP_AT,
    /** the scene fades up out of black at the start */
    reveal: out(0, .9, t),
    /** the "1 VS 5" situation graphic: in, held, and out before the reticle takes over */
    versus: out(.6, 1.2, t) * (1 - smooth(1.9, 2.4, t)),
    /** the slow push of the whole shot: 0 at the start, 1 after the last kill */
    push: smooth(1.2, lastKill + .8, t),
    reticle: reticle(t),
    kills, markers, counter: `${kills} / 5`, counterOn: smooth(1.9, 2.3, t) * (1 - smooth(DIP_AT - .1, DIP_AT + .3, t)),
    shake, shakeX: Math.sin(t * 91) * shake, shakeY: Math.cos(t * 113) * shake * .8,
    /** a muzzle flash at the shot (a tenth of a second), the tracer that follows the round, and the hit flash on the enemy */
    muzzle: Math.max(0, ...KILLS.map((k) => (t >= k && t < k + .1 ? 1 - (t - k) / .1 : 0))),
    tracer: Math.max(0, ...KILLS.map((k) => (t >= k && t < k + .16 ? 1 - (t - k) / .16 : 0))),
    impact: Math.max(0, ...KILLS.map((k, i) => (t >= k + .03 && t < k + .3 ? (1 - (t - k - .03) / .27) * (i === 4 ? 1.5 : 1) : 0))),
    /** after the fifth kill: a bright flash that clears slowly, then a long dip to dark, then the hero shot */
    flash: t >= lastKill ? Math.exp(-(t - lastKill - .04) * 4.5) * smooth(lastKill, lastKill + .05, t) : 0,
    black: .96 * smooth(DIP_AT, SWAP_AT - .1, t) * (1 - smooth(HERO_AT + .05, HERO_AT + .75, t)),
    /** the hero shot's slow push forward and the light behind the survivor coming up */
    heroPush: line(HERO_AT, CLUTCH_DURATION, t), glow: .4 + .6 * out(HERO_AT, HERO_AT + 1.4, t) * (t >= SWAP_AT ? 1 : 0),
    titleAge: titleAge(t), title: t >= TITLE_AT,
    /** the player plate slides in after the title has landed */
    person: out(PERSON_AT, PERSON_AT + .6, t),
    /** the HUD frame */
    frame: out(.4, 1.2, t),
    fade: 1 - out(FADE_AT, CLUTCH_DURATION, t),
    done: seconds >= CLUTCH_DURATION,
  };
}

/** The moments sounds are scheduled at (seconds). */
export const clutchCues = () => ({ open: .3, versus: .7, lock: RETICLE_ON + .1, kills: [...KILLS], dip: DIP_AT, title: TITLE_AT + .1 });

export function clutchLayout(width: number, height: number) {
  const mobile = width < 600 || height > width;
  return { mobile, dust: mobile ? 20 : 48, dpr: mobile ? 1 : 1.5 };
}
