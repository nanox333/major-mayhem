import { useSyncExternalStore } from 'react';
import { Bank, SFX_NAMES, Sfx, SfxOpts, renderSfx } from './sfx';

// Sound: a master switch (remembered in the browser, on by default), the audio context, and `play`. Browsers only allow sound
// after a click or key press, so the context is created on the first one and nothing plays before that. The samples themselves
// (src/sounds/*.mp3, inlined into the build) are decoded at page load, which needs no gesture, so even the first click has sound.

const files = import.meta.glob('../sounds/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const bank = new Map<string, AudioBuffer>();

/** Cuts the digital silence an mp3 encoder puts at the front, so an effect starts on its first sound. */
function trimStart(c: BaseAudioContext, b: AudioBuffer): AudioBuffer {
  const data = b.getChannelData(0);
  let i = 0;
  while (i < data.length && Math.abs(data[i]) < 0.002) i++;
  const from = Math.max(0, i - Math.round(b.sampleRate * 0.001));
  if (from === 0) return b;
  const out = c.createBuffer(b.numberOfChannels, b.length - from, b.sampleRate);
  for (let ch = 0; ch < b.numberOfChannels; ch++) out.copyToChannel(b.getChannelData(ch).subarray(from), ch);
  return out;
}

/** Decodes every sample into the bank, keyed by file name without its extension. A sample that won't decode is just silent. */
async function loadBank() {
  if (typeof OfflineAudioContext === 'undefined') return;
  const decoder = new OfflineAudioContext(1, 1, 44100);
  await Promise.all(Object.entries(files).map(async ([path, url]) => {
    try {
      const data = await (await fetch(url)).arrayBuffer();
      bank.set(path.replace(/^.*\//, '').replace(/\.mp3$/, ''), trimStart(decoder, await decoder.decodeAudioData(data)));
    } catch { /* silent */ }
  }));
}

const KEY = 'mm-sound';
const readOn = () => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } };
let on = typeof localStorage === 'undefined' ? true : readOn();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let lastGesture = -Infinity;
const lastPlayed = new Map<Sfx, number>();
/** Effects that can fire many times a second at 4× playback are thinned to at most one per this many ms. */
const MIN_GAP: Partial<Record<Sfx, number>> = { click: 40, roundWin: 90, roundLoss: 90, hit: 40, near: 40, miss: 40 };
const NAMES = new Set<string>(SFX_NAMES);
const LEVEL = 0.7;
const noop = () => {};

function context(): AudioContext | null {
  if (ctx) return ctx;
  const AC = typeof window === 'undefined' ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = on ? LEVEL : 0;
    // A gentle limiter, so a chime landing on a click never clips.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14; limiter.ratio.value = 6; limiter.attack.value = 0.003; limiter.release.value = 0.15;
    master.connect(limiter); limiter.connect(ctx.destination);
  } catch { ctx = null; }
  return ctx;
}

/** Whether a sound started now would actually be heard: the context is running, or was just unlocked by a gesture. */
function ready(): AudioContext | null {
  if (!on || !ctx || !master) return null;
  if (ctx.state === 'running' || performance.now() - lastGesture < 800) return ctx;
  return null;
}

/** Plays an effect, `delay` ms from now; returns a function that cuts it off. */
export function play(name: Sfx, o: SfxOpts & { delay?: number } = {}): () => void {
  const c = ready();
  if (!c || !master) return noop;
  const now = performance.now();
  const gap = MIN_GAP[name] ?? 0;
  if (!o.delay && gap && now - (lastPlayed.get(name) ?? -Infinity) < gap) return noop;
  lastPlayed.set(name, now);
  return voice(c, master, (bus, t) => renderSfx(c, bus, name, t, o, bank as Bank), o.delay ?? 0);
}

/** Schedules the reel's ticks at the given ms offsets, starting `delay` ms from now. */
export function playTicks(offsets: number[], delay = 0): () => void {
  const c = ready();
  if (!c || !master || offsets.length === 0) return noop;
  return voice(c, master, (bus, t) => {
    offsets.forEach((ms, i) => renderSfx(c, bus, 'tick', t + ms / 1000, { pitch: 1 + ((i * 7) % 5) * 0.035 }, bank as Bank));
    return offsets[offsets.length - 1] / 1000 + 0.1;
  }, delay);
}

/** Runs `draw` on its own bus, so everything it schedules can be cut off together and is released afterwards. */
function voice(c: AudioContext, dest: AudioNode, draw: (bus: GainNode, t: number) => number, delayMs: number): () => void {
  const bus = c.createGain();
  bus.connect(dest);
  const secs = draw(bus, c.currentTime + delayMs / 1000 + 0.01);
  const release = setTimeout(() => bus.disconnect(), delayMs + (secs + 0.2) * 1000);
  return () => { clearTimeout(release); bus.gain.cancelScheduledValues(c.currentTime); bus.gain.setValueAtTime(0, c.currentTime); setTimeout(() => bus.disconnect(), 60); };
}

export function setSoundOn(value: boolean) {
  on = value;
  try { localStorage.setItem(KEY, value ? '1' : '0'); } catch { /* storage unavailable */ }
  if (ctx && master) master.gain.setTargetAtTime(value ? LEVEL : 0, ctx.currentTime, 0.02);
  listeners.forEach((fn) => fn());
}

export function useSoundOn(): [boolean, () => void] {
  const value = useSyncExternalStore(subscribe, () => on, () => true);
  return [value, () => setSoundOn(!on)];
}

let started = false;
/**
 * Call once at start-up. Any click, tap or key press unlocks audio, and every button click makes a sound: a button can name
 * its own with data-sfx="draft", or opt out with data-sfx="none" when its handler plays something better.
 */
export function initSound() {
  if (started || typeof document === 'undefined') return;
  started = true;
  void loadBank();
  const unlock = () => {
    lastGesture = performance.now();
    const c = context();
    if (c && c.state !== 'running') c.resume().catch(noop);
  };
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) document.addEventListener(ev, unlock, true);
  document.addEventListener('click', (e) => {
    const btn = (e.target as Element | null)?.closest?.('button');
    if (!btn || btn.disabled) return;
    const tag = btn.getAttribute('data-sfx') ?? 'click';
    if (NAMES.has(tag)) play(tag as Sfx);
  }, true);
  // A hidden tab shouldn't keep chiming; the next gesture wakes it.
  document.addEventListener('visibilitychange', () => { if (document.hidden) ctx?.suspend().catch(noop); else ctx?.resume().catch(noop); });
}
