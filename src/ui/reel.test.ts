import { describe, expect, it } from 'vitest';
import { REEL_CURVE, REEL_MS, reelTickTimes, timeAtProgress } from './reel';

describe('reel timing', () => {
  it('maps progress to time monotonically, from 0 to the full duration', () => {
    expect(timeAtProgress(0)).toBe(0);
    expect(timeAtProgress(1)).toBe(1);
    let prev = 0;
    for (let p = 0.05; p < 1; p += 0.05) { const t = timeAtProgress(p); expect(t).toBeGreaterThan(prev); prev = t; }
  });

  it('agrees with the CSS curve: the reel covers most of its distance early', () => {
    // cubic-bezier(.08,.75,.16,1) is 75%+ of the way there long before half the time has passed.
    expect(timeAtProgress(0.75)).toBeLessThan(0.3);
    expect(timeAtProgress(0.99)).toBeGreaterThan(0.6);
    expect(REEL_CURVE).toHaveLength(4);
  });

  it('ticks once per item crossing, slowing down as the reel settles', () => {
    const step = 112, half = 300, travel = 3340;
    const ticks = reelTickTimes(travel, half, step);
    expect(ticks.length).toBe(Math.floor((travel + half) / step) - Math.floor(half / step));
    expect(ticks.every((t) => t > 0 && t <= REEL_MS)).toBe(true);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
    const gaps = ticks.slice(1).map((t, i) => t - ticks[i]);
    expect(gaps[gaps.length - 1]).toBeGreaterThan(gaps[0] * 3);
  });

  it('has nothing to tick for no travel', () => {
    expect(reelTickTimes(0, 300, 112)).toEqual([]);
  });
});
