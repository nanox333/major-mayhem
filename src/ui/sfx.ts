// Every sound effect is synthesised from oscillators and filtered noise, so there are no audio files to load or license and the
// single-file build stays small. Nothing here touches the page: each effect is drawn onto whatever audio context it is handed,
// which is what lets the tests run it against a stub and render it offline.

export const SFX_NAMES = [
  'click', 'tick', 'open', 'reveal', 'reroll', 'draft', 'found', 'accept', 'ban', 'call',
  'roundWin', 'roundLoss', 'clutch', 'half', 'mapWin', 'mapLose', 'champion', 'achievement', 'hit', 'near', 'miss',
] as const;
export type Sfx = (typeof SFX_NAMES)[number];
export interface SfxOpts {
  /** 'reveal': the rarity of the team the case landed on; a rarer one gets a longer chime. */
  rarity?: string;
  /** 'tick': a pitch multiplier, so a run of ticks doesn't sound machine-gunned. */
  pitch?: number;
}

type Ctx = BaseAudioContext;
interface Tone { f: number; to?: number; d: number; v: number; type?: OscillatorType; at?: number; attack?: number }
interface Hiss { d: number; v: number; f: number; to?: number; q?: number; type?: BiquadFilterType; at?: number }

/** A gain envelope: near silence, a quick rise to `peak`, then an exponential fall back to near silence. */
function envelope(c: Ctx, out: AudioNode, t: number, dur: number, peak: number, attack: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(out);
  return g;
}

function tone(c: Ctx, out: AudioNode, t0: number, o: Tone) {
  const t = t0 + (o.at ?? 0);
  const osc = c.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.d);
  osc.connect(envelope(c, out, t, o.d, o.v, o.attack ?? 0.006));
  osc.start(t);
  osc.stop(t + o.d + 0.03);
}

const noiseBuffers = new WeakMap<Ctx, AudioBuffer>();
function noiseBuffer(c: Ctx): AudioBuffer {
  let b = noiseBuffers.get(c);
  if (!b) {
    b = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = b.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(c, b);
  }
  return b;
}

function hiss(c: Ctx, out: AudioNode, t0: number, o: Hiss) {
  const t = t0 + (o.at ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = o.type ?? 'bandpass';
  filter.Q.value = o.q ?? 1;
  filter.frequency.setValueAtTime(o.f, t);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t + o.d);
  src.connect(filter);
  filter.connect(envelope(c, out, t, o.d, o.v, 0.004));
  src.start(t, 0, o.d + 0.03);
}

/** A run of notes, `gap` seconds apart; the last one rings for `tail`. */
function run(c: Ctx, out: AudioNode, t: number, notes: number[], gap: number, len: number, tail: number, v: number, type: OscillatorType = 'triangle') {
  notes.forEach((f, i) => {
    const last = i === notes.length - 1;
    tone(c, out, t, { f, d: last ? tail : len, v, type, at: i * gap });
    if (last) tone(c, out, t, { f: f * 2, d: tail, v: v * 0.35, at: i * gap });
  });
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, G6 = 1568;
const REVEAL: Record<string, number[]> = { milspec: [C5], restricted: [C5, E5], classified: [C5, E5, G5], covert: [C5, E5, G5, C6], gold: [C5, E5, G5, C6, E6] };

type Voice = (c: Ctx, out: AudioNode, t: number, o: SfxOpts) => number;
/** Each effect draws itself starting at `t` and returns how long it lasts, in seconds. */
const VOICES: Record<Sfx, Voice> = {
  click: (c, out, t) => { tone(c, out, t, { f: 1400, to: 900, d: 0.045, v: 0.1, type: 'triangle' }); return 0.08; },
  tick: (c, out, t, o) => {
    tone(c, out, t, { f: 2100 * (o.pitch ?? 1), d: 0.02, v: 0.08, type: 'triangle', attack: 0.002 });
    hiss(c, out, t, { d: 0.02, v: 0.05, f: 3200, q: 2 });
    return 0.06;
  },
  open: (c, out, t) => {
    tone(c, out, t, { f: 170, to: 55, d: 0.22, v: 0.28 });
    hiss(c, out, t, { d: 0.3, v: 0.11, f: 300, to: 3200, q: 1.2 });
    return 0.35;
  },
  reveal: (c, out, t, o) => {
    const notes = REVEAL[o.rarity ?? 'milspec'] ?? REVEAL.milspec;
    run(c, out, t, notes, 0.075, 0.12, 0.35 + notes.length * 0.05, 0.12);
    if (o.rarity === 'gold') hiss(c, out, t, { at: 0.3, d: 0.9, v: 0.05, f: 6000, type: 'highpass', q: 0.5 });
    return 0.4 + notes.length * 0.13;
  },
  reroll: (c, out, t) => {
    hiss(c, out, t, { d: 0.2, v: 0.13, f: 500, to: 3000, q: 0.8 });
    tone(c, out, t, { f: 300, to: 700, d: 0.15, v: 0.05, type: 'triangle' });
    return 0.25;
  },
  draft: (c, out, t) => {
    tone(c, out, t, { f: E5, d: 0.09, v: 0.12, type: 'triangle' });
    tone(c, out, t, { f: 987.77, d: 0.18, v: 0.13, type: 'triangle', at: 0.07 });
    return 0.28;
  },
  found: (c, out, t) => { run(c, out, t, [C5, E5, G5, C6], 0.11, 0.14, 0.5, 0.14); return 0.95; },
  accept: (c, out, t) => {
    tone(c, out, t, { f: E5, d: 0.09, v: 0.12, type: 'triangle' });
    tone(c, out, t, { f: G5, d: 0.14, v: 0.13, type: 'triangle', at: 0.07 });
    return 0.25;
  },
  ban: (c, out, t) => {
    tone(c, out, t, { f: 220, to: 70, d: 0.16, v: 0.25 });
    hiss(c, out, t, { d: 0.1, v: 0.1, f: 1200, type: 'lowpass' });
    return 0.22;
  },
  call: (c, out, t) => {
    tone(c, out, t, { f: 880, d: 0.07, v: 0.05, type: 'square' });
    tone(c, out, t, { f: 880, d: 0.07, v: 0.05, type: 'square', at: 0.11 });
    return 0.22;
  },
  roundWin: (c, out, t) => { tone(c, out, t, { f: 520, to: 820, d: 0.1, v: 0.07, type: 'triangle' }); return 0.14; },
  roundLoss: (c, out, t) => { tone(c, out, t, { f: 330, to: 230, d: 0.14, v: 0.07, type: 'triangle' }); return 0.18; },
  clutch: (c, out, t) => {
    run(c, out, t, [G5, C6, E6, G6], 0.06, 0.1, 0.35, 0.1);
    hiss(c, out, t, { at: 0.18, d: 0.5, v: 0.07, f: 6000, type: 'highpass', q: 0.5 });
    return 0.75;
  },
  half: (c, out, t) => {
    tone(c, out, t, { f: 196, d: 0.9, v: 0.12 });
    tone(c, out, t, { f: 294, d: 0.7, v: 0.06 });
    tone(c, out, t, { f: 392, d: 0.5, v: 0.03 });
    return 0.95;
  },
  mapWin: (c, out, t) => { run(c, out, t, [C5, E5, G5, C6], 0.09, 0.12, 0.45, 0.13); return 0.8; },
  mapLose: (c, out, t) => { run(c, out, t, [392, 329.63, 261.63], 0.16, 0.18, 0.5, 0.12); return 0.9; },
  champion: (c, out, t) => {
    run(c, out, t, [C5, E5, G5, C6], 0.1, 0.12, 0.2, 0.12);
    for (const f of [C5, G5, C6, E6]) tone(c, out, t, { f, d: 1.1, v: 0.09, type: 'triangle', at: 0.45 });
    hiss(c, out, t, { at: 0.45, d: 1.2, v: 0.05, f: 6000, type: 'highpass', q: 0.5 });
    return 1.6;
  },
  achievement: (c, out, t) => {
    for (const at of [0, 0.18]) {
      // A struck bell: the fundamental plus two inharmonic partials that die away faster.
      tone(c, out, t, { f: E6, d: 0.7, v: 0.11, at });
      tone(c, out, t, { f: E6 * 2.76, d: 0.35, v: 0.05, at });
      tone(c, out, t, { f: E6 * 5.4, d: 0.2, v: 0.02, at });
    }
    return 0.95;
  },
  hit: (c, out, t) => {
    tone(c, out, t, { f: C6, d: 0.12, v: 0.11, type: 'triangle' });
    tone(c, out, t, { f: C6 * 2, d: 0.1, v: 0.03 });
    return 0.16;
  },
  near: (c, out, t) => { tone(c, out, t, { f: G5, d: 0.1, v: 0.09, type: 'triangle' }); return 0.14; },
  miss: (c, out, t) => { tone(c, out, t, { f: 262, to: 230, d: 0.1, v: 0.07, type: 'triangle' }); return 0.14; },
};

/** Draws one effect onto `out` starting at audio-clock time `t`; returns its length in seconds. */
export function renderSfx(c: BaseAudioContext, out: AudioNode, name: Sfx, t: number, o: SfxOpts = {}): number {
  return VOICES[name](c, out, t, o);
}
