import { describe, expect, it } from 'vitest';
import { SFX_NAMES, renderSfx } from './sfx';

/** A stand-in audio context that records what each effect schedules, so the effects can be checked without a browser. */
function stubContext() {
  const log = { starts: [] as number[], stops: [] as number[], ramps: [] as number[], peaks: [] as number[], sources: 0, freqs: [] as number[] };
  const param = (isGain = false) => ({
    value: 0,
    setValueAtTime(v: number) { if (!isGain) log.freqs.push(v); },
    exponentialRampToValueAtTime(v: number) { log.ramps.push(v); if (isGain) log.peaks.push(v); },
  });
  const node = () => ({ connect() {}, disconnect() {} });
  const c = {
    sampleRate: 8000,
    createGain: () => ({ ...node(), gain: param(true) }),
    createOscillator: () => ({ ...node(), type: 'sine', frequency: param(), start(t: number) { log.sources++; log.starts.push(t); }, stop(t: number) { log.stops.push(t); } }),
    createBiquadFilter: () => ({ ...node(), type: 'bandpass', Q: { value: 1 }, frequency: param() }),
    createBufferSource: () => ({ ...node(), buffer: null, loop: false, start(t: number) { log.sources++; log.starts.push(t); } }),
    createBuffer: (_ch: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
  };
  return { c: c as unknown as BaseAudioContext, log };
}

describe('sound effects', () => {
  for (const name of SFX_NAMES) {
    it(`${name} schedules real, bounded audio`, () => {
      const { c, log } = stubContext();
      const t0 = 5;
      const len = renderSfx(c, {} as AudioNode, name, t0, { rarity: 'gold' });
      expect(log.sources).toBeGreaterThan(0);
      expect(len).toBeGreaterThan(0.05);
      expect(len).toBeLessThan(2);
      // Everything starts at or after the requested time, and stops after it starts.
      for (const s of log.starts) { expect(Number.isFinite(s)).toBe(true); expect(s).toBeGreaterThanOrEqual(t0); }
      for (const s of log.stops) expect(s).toBeGreaterThan(t0);
      // exponentialRampToValueAtTime throws on non-positive targets in a real browser.
      for (const r of log.ramps) expect(r).toBeGreaterThan(0);
      for (const f of log.freqs) expect(f).toBeGreaterThan(0);
      // No single voice is loud enough to dominate or clip.
      for (const p of log.peaks) expect(p).toBeLessThanOrEqual(0.3);
    });
  }

  it('gives rarer teams a longer reveal chime', () => {
    const notes = (rarity: string) => { const { c, log } = stubContext(); renderSfx(c, {} as AudioNode, 'reveal', 0, { rarity }); return log.sources; };
    expect(notes('restricted')).toBeGreaterThan(notes('milspec'));
    expect(notes('covert')).toBeGreaterThan(notes('classified'));
    expect(notes('gold')).toBeGreaterThan(notes('covert'));
    expect(notes('nonsense')).toBe(notes('milspec'));
  });
});
