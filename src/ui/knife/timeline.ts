/** The KNIFE KILL clock. Elapsed seconds are the only animation state: every value is a pure function of `t`, so playback, the scrubber and the tests
 *  agree at any frame rate. The beats follow the brief (dark overlay and HUD, slash, crossing slash and burst, knife sweep, splatter, KNIFE, KILL,
 *  hold, fade), written in the brief's 1.35 s and played at the pace of the ACE highlight: `SPEC` maps the brief's moments to real seconds. */
export const KNIFE_DURATION = 4.45;
const SPEC: readonly (readonly [number, number])[] = [[0, 0], [.08, .3], [.16, .5], [.25, .78], [.26, .85], [.42, 1.5], [.58, 2.1], [.72, 2.5], [.85, 2.85], [1.10, 3.85], [1.35, KNIFE_DURATION]];
const along = (from: 0 | 1, to: 0 | 1, v: number) => {
  if (v <= SPEC[0][from]) return SPEC[0][to];
  for (let i = 1; i < SPEC.length; i++) if (v <= SPEC[i][from]) { const [a0, b0] = [SPEC[i - 1][from], SPEC[i - 1][to]], [a1, b1] = [SPEC[i][from], SPEC[i][to]]; return b0 + (b1 - b0) * (v - a0) / (a1 - a0); }
  return SPEC[SPEC.length - 1][to];
};
/** Real seconds -> the brief's moment, and back. */
export const realToSpec = (t: number) => along(1, 0, t);
export const specToReal = (s: number) => along(0, 1, s);
export const clamp = (v: number) => Math.max(0, Math.min(1, v));
/** Fast out: sharp and aggressive, never floaty. */
export const out = (a: number, b: number, t: number) => { const x = clamp((t - a) / (b - a)); return 1 - (1 - x) ** 3; };
export const line = (a: number, b: number, t: number) => clamp((t - a) / (b - a));

function brief(t: number) {
  const fade = 1 - out(1.10, 1.35, t), hud = out(0, .08, t);
  // two tremors at the cuts and one when the title lands
  const shake = (t >= .2 ? 12 * Math.exp(-(t - .2) * 14) : 0) + (t >= .58 ? 8 * Math.exp(-(t - .58) * 20) : 0) + (t >= .72 ? 4 * Math.exp(-(t - .72) * 22) : 0);
  return {
    dim: .97 * out(0, .08, t) * fade, hud: hud * fade,
    /** 0 to 1 sweep of each slash along its own axis. */
    slashA: line(.08, .16, t), slashB: line(.16, .25, t),
    /** The slashes stay, quieter, once the title is in. */
    slashHold: 1 - .5 * out(.5, .7, t),
    burst: t >= .2 ? t - .2 : -1,
    knife: line(.26, .42, t), knifeShown: t >= .26 && t < .64 ? 1 - out(.5, .64, t) : 0,
    helmet: out(.34, .46, t) * (1 - out(.5, .66, t)),
    splat: line(.42, .58, t), debris: Math.max(0, t - .42),
    knifeWord: line(.58, .72, t), killWord: line(.72, .85, t),
    hold: out(.85, .95, t),
    shakeX: Math.sin(t * 190) * shake, shakeY: Math.cos(t * 233) * shake * .7,
    fade,
  };
}

const punch = (t: number, at: number, rate: number) => (t >= at ? Math.exp(-(t - at) * rate) : 0);
function punches(t: number) {
  const a = specToReal(.2), b = specToReal(.58), c = specToReal(.72), d = specToReal(.42);
  const slam = Math.min(1, .85 * punch(t, a, 16) + .5 * punch(t, b, 14) + .35 * punch(t, c, 14) + .3 * punch(t, d, 18));
  return { slam, split: 1 + 2.5 * Math.min(1, punch(t, a, 7) + punch(t, b, 7) + punch(t, c, 8) + punch(t, d, 8)), bleed: .1 + .3 * Math.min(1, punch(t, a, 3) + punch(t, d, 3) + punch(t, b, 3)) };
}

export function knifeTime(seconds: number) {
  const t = Math.max(0, Math.min(KNIFE_DURATION, seconds));
  return { ...brief(realToSpec(t)), real: t, /** The player plate slides in after KILL has landed. */ person: out(2.85, 3.2, t),
    /** Post-processing punches in real time: a white slam, a red-cyan split and a red bleed at the cut, the title and KILL. */
    ...punches(t), done: seconds >= KNIFE_DURATION };
}

/** The moments sounds are scheduled at (real seconds). */
export function knifeCues() { return { slashA: specToReal(.08), slashB: specToReal(.16), knife: specToReal(.26), hit: specToReal(.42), knifeWord: specToReal(.58), killWord: specToReal(.72) }; }

export function knifeLayout(width: number, height: number) {
  const mobile = width < 600 || height > width;
  return { mobile, title: mobile ? 1.55 : 1, particles: mobile ? 18 : 36, debris: mobile ? 16 : 28 };
}
