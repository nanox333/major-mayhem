/** The NINJA DEFUSE clock. Elapsed seconds are the only animation state: every phase below is a pure function of `t`, so playback, scrubbing,
 *  the HTML fallback and the tests all agree, at 30, 60 or 120 fps. The timer is a cinematic one: it does not run in real time. */
export const NINJA_DURATION = 2.0;
/** The whole thing plays this many times slower than the keyframes below are written: tension needs time to be felt. Real length is NINJA_REAL. */
export const NINJA_SLOW = 3.4;
export const NINJA_REAL = NINJA_DURATION * NINJA_SLOW;
/** The moment the defuse completes; everything before is tension, everything after is release. */
export const NINJA_CLICK = 1.0;
export const NINJA_DEFUSED = 1.02;
/** Timer readout keyframes [time, hundredths of a second]. */
const TIMER: readonly (readonly [number, number])[] = [[.05, 11], [.30, 8], [.55, 5], [.75, 3], [.90, 2], [.98, 1]];
const PROGRESS: readonly (readonly [number, number])[] = [[.05, .55], [.30, .65], [.55, .78], [.75, .90], [.95, .98], [NINJA_CLICK, 1]];
/** Red LED pulses per second over time: [from, rate]. */
const LED_RATE: readonly (readonly [number, number])[] = [[0, 2], [.4, 4], [.75, 7.5]];

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = (a: number, b: number, t: number) => { const x = clamp((t - a) / (b - a)); return 1 - (1 - x) ** 3; };
const keys = (k: readonly (readonly [number, number])[], t: number) => {
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (t <= k[i][0]) { const [t0, v0] = k[i - 1], [t1, v1] = k[i]; return v0 + (v1 - v0) * (t - t0) / (t1 - t0); }
  return k[k.length - 1][1];
};

/** The hundredths shown on the display at `t`, given where it starts (the very late defuse is 11, an extremely late one 4). */
export function ninjaHundredths(t: number, start = 11) {
  const s = clamp(Math.round(start), 3, 11);
  const v = keys(TIMER, t) * (s / 11);
  return Math.max(1, Math.round(v));
}
export const ninjaTimerText = (hundredths: number) => `0:00.${String(hundredths).padStart(2, '0')}`;

/** How many red-LED pulses have started by `t` (the integral of the rate), so the pulse speeds up with no jump in phase. */
export function ledPhase(t: number) {
  let phase = 0;
  for (let i = 0; i < LED_RATE.length; i++) {
    const [from, rate] = LED_RATE[i], to = i + 1 < LED_RATE.length ? LED_RATE[i + 1][0] : NINJA_DEFUSED;
    if (t <= from) break;
    phase += (Math.min(t, to) - from) * rate;
  }
  return phase;
}

export function ninjaTime(t: number, start = 11) {
  const success = t >= NINJA_CLICK, defused = t >= NINJA_DEFUSED;
  const hundredths = success ? ninjaHundredths(NINJA_CLICK, start) : ninjaHundredths(t, start);
  const phase = ledPhase(t), pulse = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;
  const tension = ease(.5, 1, t) * (success ? 0 : 1);
  return {
    hundredths, text: ninjaTimerText(hundredths), success, defused, label: defused ? 'DEFUSED' : 'DEFUSING...',
    progress: success ? 1 : keys(PROGRESS, t),
    led: defused ? 0 : .25 + .75 * pulse,
    green: defused ? .55 + .45 * (1 - ease(NINJA_DEFUSED, NINJA_DEFUSED + .25, t)) : 0,
    /** 0 until the 0:00.02 beat, then a brief orange-red swell around it. */
    critical: success ? 0 : Math.max(0, 1 - Math.abs(t - .9) / .08),
    shake: success ? 0 : tension < .001 ? 0 : t < .8 ? .35 * tension : .35 + 1.0 * ease(.8, 1, t),
    vignette: success ? .12 * (1 - ease(NINJA_CLICK, 1.3, t)) : .08 + .3 * ease(.75, 1, t),
    /** Push-in towards the display until the click, then the camera eases back and the tension releases. */
    push: success ? 1 - .35 * ease(1.05, 1.22, t) : ease(.05, 1, t),
    relax: (() => { const k = clamp((t - NINJA_CLICK - .03) / .24); return k * k * k * (k * (k * 6 - 15) + 10); })(),
    /** Fully opaque from the first beat to the end of the hold; the match only shows through during the final fade. */
    dim: .88 * ease(0, .05, t),
    ninja: ease(1.15, 1.25, t), defuse: ease(1.21, 1.28, t),
    person: ease(1.34, 1.5, t),
    /** The title and the player hold on screen from about 1.3 to 1.9, then the whole thing fades. */
    fade: 1 - ease(1.9, NINJA_DURATION, t),
    done: t >= NINJA_DURATION,
  };
}

/** Micro-shake of the camera: handheld tremor that grows with the tension and stops dead at the click. */
export function ninjaShake(t: number, amount: number) {
  if (amount <= 0) return { x: 0, y: 0, roll: 0 };
  return { x: Math.sin(t * 91 + 1) * .004 * amount, y: Math.cos(t * 117) * .0035 * amount, roll: Math.sin(t * 73) * .006 * amount };
}

/** The moments the sounds are scheduled at (seconds): a beep at each LED pulse (faster as the display falls), the low tone, the click, the confirmation, the sting. */
export function ninjaCues() {
  const beeps: number[] = [];
  for (let n = 1; ledPhase(NINJA_CLICK) >= n; n++) {
    let a = 0, b = NINJA_CLICK;
    for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (ledPhase(m) >= n) b = m; else a = m; }
    beeps.push(+b.toFixed(3));
  }
  return { beeps, tension: .78, click: NINJA_CLICK, confirm: NINJA_DEFUSED + .03, sting: 1.15 };
}

/** Phone layouts need a bigger readout and a bar of 70 to 85% of the width. */
export function ninjaLayout(width: number) {
  const mobile = width < 600;
  return { mobile, bar: mobile ? .78 : .46, dpr: mobile ? 1 : 1.5 };
}
