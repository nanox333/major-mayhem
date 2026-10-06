/** The end-card title choreography, as pure functions of the seconds since the title started (same input, same picture, at any frame rate).
 *
 *   0.00  a white-hot slash line cuts across the frame
 *   0.12  the first word's letters swing up into place one after another, burning in out of embers
 *   0.50  the second word's letters drop in from above; every landing flashes warm and throws a few sparks
 *   +0.1  an energy wave runs through the letters left to right, white-hot
 *   +0.6  a diagonal slice flashes across the title and the letters jolt
 *   then  a glint sweeps now and then and the letters breathe, with embers rising. */
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const smooth = (a: number, b: number, t: number) => { const u = clamp((t - a) / (b - a)); return u * u * (3 - 2 * u); };

export const WORD_START = [.12, .5] as const;
export const STAGGER = [.06, .06] as const;
export const SLAM = [.34, .34] as const;

export const landingTime = (word: number, index: number) => WORD_START[word] + index * STAGGER[word] + SLAM[word];
/** When everything has landed (the energy wave starts here). */
export const settledAt = (counts: readonly number[]) => Math.max(...counts.map((n, word) => (n ? landingTime(word, n - 1) : 0))) + .06;
/** easeOutBack: arrives with a small overshoot. */
const back = (x: number) => { const c1 = 1.25, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

/** Each letter swings up into place on a hinge at its base (the first word rises from below, the second drops in from above),
 *  burning in out of embers as it goes, and lands with a small overshoot and a flash of heat. */
export function letterPose(age: number, word: number, index: number) {
  const start = landingTime(word, index) - SLAM[word], u = clamp((age - start) / SLAM[word]);
  const k = 1 - back(u), dir = word === 0 ? 1 : -1, t = Math.max(0, age - landingTime(word, index));
  return {
    visible: age >= start,
    x: 0, y: -dir * k * .6, z: k * 1.1,
    rotX: -dir * k * 1.3, rotY: 0, rotZ: 0,
    scale: 1,
    /** how burnt away the letter still is: it materialises out of embers during the swing and is solid on landing */
    burn: u >= 1 ? 0 : 1 - smooth(.02, .7, u),
    trail: 0, trailAngle: 0, trailLength: 0,
    /** a warm flash on the landing, decaying fast */
    flash: age >= landingTime(word, index) ? Math.exp(-t * 7) * .7 : 0,
  };
}

/** The knife kill's letters are cut in two on the slash line: the halves come in along the cut from opposite ends, fast, and meet with a hard stop
 *  and a flash. Returns the distance along the cut (signed per half, 0 when joined) and the usual flash and burn. */
export const SLICE_SLAM = .22;
export function slicePose(age: number, word: number, index: number, half: number) {
  const land = landingTime(word, index) - (SLAM[word] - SLICE_SLAM), start = land - SLICE_SLAM, u = clamp((age - start) / SLICE_SLAM);
  const e = 1 - Math.pow(1 - u, 4), t = Math.max(0, age - land);
  return {
    visible: age >= start,
    d: half * (1 - e) * 5.5 + half * Math.exp(-t * 16) * Math.sin(t * 48) * .05,
    z: (1 - e) * .6,
    burn: u >= 1 ? 0 : 1 - smooth(.0, .45, u),
    flash: age >= land ? Math.exp(-t * 9) * 1.1 : 0,
    /** the moment the halves meet: a bright line along the cut and a burst of blood */
    impact: age >= land ? land : -1,
  };
}

/** Camera shake: every landing adds a short decaying kick; the second word hits harder. */
export function shake(age: number, counts: readonly number[]) {
  let amount = 0;
  counts.forEach((n, word) => { for (let i = 0; i < n; i++) { const t = age - landingTime(word, i); if (t > 0) amount += Math.exp(-t * 12) * (word ? .008 : .006); } });
  return amount;
}

/** The opening slash: a line that cuts across the frame in about 0.14 s and fades. */
export function slash(age: number) {
  if (age < 0 || age > .55) return { length: 0, opacity: 0 };
  return { length: 1 - Math.pow(1 - clamp(age / .14), 3), opacity: 1 - smooth(.18, .55, age) };
}

/** The energy wave: 0..1 for a letter at normalised position x (0 left, 1 right). */
export function wave(age: number, settled: number, x: number) {
  const d = (age - settled - x * .55) / .13; return Math.exp(-d * d);
}

/** The slice that crosses the title after the wave: its position across the frame (-1..1) and strength, and the jolt it gives the letters. */
export function slice(age: number, settled: number) {
  const t = (age - settled - .6) / .22; if (t < 0 || t > 1) return { x: -9, power: 0, jolt: 0 };
  return { x: -1.3 + 2.6 * t, power: Math.sin(t * Math.PI), jolt: Math.exp(-Math.max(0, t - .45) * 7) * smooth(0, .45, t) };
}

/** A glint that sweeps across the letters every couple of seconds once the slice is done. */
export function glint(age: number, settled: number) {
  const t = age - settled - 1.1; if (t < 0) return { x: -9, power: 0 };
  const k = (t % 2.4) / 2.4, power = Math.sin(Math.min(1, k * 1.6) * Math.PI);
  return { x: -4 + 8 * k, power };
}

/** One spark: a deterministic ballistic particle born at `born` (seconds). Returns null when it is not alive. */
export function spark(age: number, born: number, i: number) {
  const t = age - born; if (t < 0 || t > 1.1) return null;
  const h = (n: number) => { const s = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return s - Math.floor(s); };
  const a = h(1) * Math.PI * 2, speed = 1.2 + h(2) * 4.4;
  return { x: Math.cos(a) * speed * t, y: Math.sin(a) * speed * t * .7 - 3.2 * t * t, z: (h(3) - .3) * 1.6 * t, alpha: 1 - t / 1.1, size: .6 + h(4) };
}

/** Ambient embers that drift up through the title once it has landed: position in a 0..1 box and brightness. */
export function ember(age: number, settled: number, i: number) {
  const t = age - settled + .3; if (t < 0) return null;
  const h = (n: number) => { const s = Math.sin(i * 91.7 + n * 17.3) * 43758.5453; return s - Math.floor(s); };
  const rise = (h(2) * .5 + .3) * t, y = (h(1) + rise * .35) % 1;
  return { x: (h(3) + Math.sin(t * (.8 + h(4)) + i) * .03) % 1, y, alpha: Math.min(1, t * 2) * (.35 + .65 * Math.abs(Math.sin(t * 3 + i))) * (1 - y * .6) };
}
