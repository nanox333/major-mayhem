import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import { Bank, RARITIES, RECIPES, Recipe, SFX_NAMES, pickVariant, recipeKey, renderSfx, resetVariants } from './sfx';

/** A stand-in audio context that records each sample as it is started, so the renderer can be checked without a browser. */
function stubContext() {
  const played: { buffer: unknown; at: number; rate: number; gain: number }[] = [];
  type Gain = { gain: { value: number } };
  const c = {
    createGain: () => ({ gain: { value: 1 }, connect() {} }),
    createBufferSource: () => {
      const src = {
        buffer: null as unknown, playbackRate: { value: 1 }, into: null as Gain | null,
        connect(n: Gain) { src.into = n; },
        start(at: number) { played.push({ buffer: src.buffer, at, rate: src.playbackRate.value, gain: src.into!.gain.value }); },
      };
      return src;
    },
  };
  return { c: c as unknown as BaseAudioContext, played };
}

const buf = (duration: number) => ({ duration }) as unknown as AudioBuffer;
const bank: Bank = new Map([['a', buf(0.2)], ['b', buf(0.5)], ['c', buf(1)]]);
const out = {} as AudioNode;
/** A random source that returns the given values in turn. */
const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };

describe('sample playback', () => {
  beforeEach(resetVariants);

  it('plays every layer of the chosen variant at the right time, level and speed', () => {
    const recipes: Record<string, Recipe> = { click: { gain: 0.5, variants: [[{ file: 'a' }, { file: 'b', at: 0.1, gain: 0.4, rate: 2 }]] } };
    const { c, played } = stubContext();
    const len = renderSfx(c, out, 'click', 10, {}, bank, recipes, seq(0.5));
    expect(played).toHaveLength(2);
    expect(played[0]).toMatchObject({ buffer: bank.get('a'), at: 10, rate: 1, gain: 0.5 });
    expect(played[1]).toMatchObject({ buffer: bank.get('b'), at: 10.1, rate: 2, gain: 0.2 });
    // The effect lasts until its last layer ends: b starts at 0.1 s and runs 0.5 s at double speed.
    expect(len).toBeCloseTo(Math.max(0.2, 0.1 + 0.5 / 2), 5);
  });

  it('never repeats the same variant twice in a row, and reaches all of them', () => {
    const recipes = { tick: { variants: [[{ file: 'a' }], [{ file: 'b' }], [{ file: 'c' }]] } };
    const names = new Map([...bank].map(([k, v]) => [v, k]));
    const seen: (string | undefined)[] = [];
    for (let i = 0; i < 300; i++) {
      const { c, played } = stubContext();
      renderSfx(c, out, 'tick', 0, {}, bank, recipes);
      seen.push(names.get(played[0].buffer as AudioBuffer));
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
    expect(new Set(seen)).toEqual(new Set(['a', 'b', 'c']));
  });

  it('jitters the playback rate within its limit and multiplies in the requested pitch', () => {
    const recipes = { tick: { jitter: 0.1, variants: [[{ file: 'a' }]] } };
    // One variant needs no random pick, so the first random value is the jitter.
    for (const [r, want] of [[0, 0.9], [0.5, 1], [1, 1.1]] as const) {
      const { c, played } = stubContext();
      renderSfx(c, out, 'tick', 0, {}, bank, recipes, seq(r));
      expect(played[0].rate).toBeCloseTo(want, 5);
    }
    const { c, played } = stubContext();
    renderSfx(c, out, 'tick', 0, { pitch: 1.05 }, bank, recipes, seq(0.5));
    expect(played[0].rate).toBeCloseTo(1.05, 5);
  });

  it('skips samples that are not loaded and effects that have no recipe', () => {
    const recipes = { click: { variants: [[{ file: 'missing' }, { file: 'a' }]] } };
    const { c, played } = stubContext();
    expect(renderSfx(c, out, 'click', 0, {}, bank, recipes)).toBeCloseTo(0.2, 5);
    expect(played).toHaveLength(1);
    const none = stubContext();
    expect(renderSfx(none.c, out, 'open', 0, {}, bank, recipes)).toBe(0);
    expect(none.played).toHaveLength(0);
  });

  it('keys a reveal by rarity, defaulting to the plainest', () => {
    expect(recipeKey('reveal', { rarity: 'gold' })).toBe('reveal:gold');
    expect(recipeKey('reveal')).toBe('reveal:milspec');
    expect(recipeKey('click', { rarity: 'gold' })).toBe('click');
    const recipes = { 'reveal:gold': { variants: [[{ file: 'c' }]] }, 'reveal:milspec': { variants: [[{ file: 'a' }]] } };
    const { c, played } = stubContext();
    renderSfx(c, out, 'reveal', 0, { rarity: 'gold' }, bank, recipes);
    expect(played[0].buffer).toBe(bank.get('c'));
  });

  it('has nothing to avoid with a single variant', () => {
    expect(pickVariant('x', 1)).toBe(0);
    expect(RARITIES).toHaveLength(5);
    expect(SFX_NAMES).toContain('reveal');
  });
});

describe('the real recipes', () => {
  const dir = path.join(__dirname, '..', 'sounds');
  const sources = path.join(__dirname, '..', '..', 'assets-src', 'sounds');
  const onDisk = new Set(fs.readdirSync(dir).filter((f) => f.endsWith('.mp3')).map((f) => f.replace(/\.mp3$/, '')));
  const keys = [...SFX_NAMES.filter((n) => n !== 'reveal'), ...RARITIES.map((r) => `reveal:${r}`)];

  it('cover every effect and every reveal rarity', () => {
    for (const key of keys) expect(RECIPES[key], key).toBeDefined();
    for (const key of Object.keys(RECIPES)) expect(keys, `unknown recipe ${key}`).toContain(key);
  });

  it('only use samples that exist, with sensible timing and levels', () => {
    for (const [key, r] of Object.entries(RECIPES)) {
      expect(r.variants.length, key).toBeGreaterThan(0);
      expect(r.gain ?? 1, key).toBeGreaterThan(0);
      expect(r.gain ?? 1, key).toBeLessThanOrEqual(1.5);
      for (const layers of r.variants) {
        expect(layers.length, key).toBeGreaterThan(0);
        for (const l of layers) {
          expect(onDisk.has(l.file), `${key} uses ${l.file}, which is not in src/sounds`).toBe(true);
          expect(l.at ?? 0, key).toBeGreaterThanOrEqual(0);
          expect(l.at ?? 0, key).toBeLessThan(1);
          expect(l.rate ?? 1, key).toBeGreaterThan(0.5);
          expect(l.rate ?? 1, key).toBeLessThan(2);
        }
      }
    }
  });

  it('ship no sample that nothing uses, and keep the original of every one', () => {
    const used = new Set(Object.values(RECIPES).flatMap((r) => r.variants.flat().map((l) => l.file)));
    for (const id of onDisk) {
      expect(used.has(id), `${id}.mp3 is in src/sounds but no recipe plays it`).toBe(true);
      expect(fs.existsSync(path.join(sources, `${id}.ogg`)), `${id} has no original in assets-src/sounds`).toBe(true);
    }
  });

  it('keeps the tiny constant sounds well below the big moments', () => {
    const g = (k: string) => RECIPES[k].gain ?? 1;
    // Same-scale samples, so a lower gain means quieter: clicks and ticks sit far under an accept, which sits under a champion.
    expect(g('click')).toBeLessThan(g('accept'));
    expect(g('tick')).toBeLessThan(g('draft'));
    expect(g('reveal:milspec')).toBeLessThan(g('reveal:gold') + 1);
  });
});
