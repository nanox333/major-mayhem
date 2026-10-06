import { describe, expect, it } from 'vitest';
import { KNIFE_DURATION, knifeCues, knifeLayout, knifeTime, realToSpec, specToReal } from './timeline';

const at = (spec: number) => knifeTime(specToReal(spec));
describe('KNIFE KILL clock', () => {
  it('plays at the pace of the ACE highlight: a few seconds, with the title landing after the slashes', () => {
    expect(KNIFE_DURATION).toBeGreaterThanOrEqual(4); expect(KNIFE_DURATION).toBeLessThanOrEqual(5);
    expect(specToReal(1.10) - specToReal(.85)).toBeGreaterThanOrEqual(.9); expect(specToReal(1.10) - specToReal(.85)).toBeLessThanOrEqual(1.2); // a short hold on the title and the player, then out
    expect(specToReal(.58)).toBeGreaterThan(1.9); expect(realToSpec(specToReal(.3))).toBeCloseTo(.3, 6);
    expect(specToReal(.16) - specToReal(.08)).toBeLessThan(.3); // the sweeps are fast
    expect(at(.7).slashHold).toBeLessThan(1); expect(at(.3).slashA).toBe(1); // and the slashes stay on screen after they land
  });
  it('follows the beats of the brief', () => {
    expect(at(0).hud).toBe(0); expect(at(.08).hud).toBeCloseTo(1, 5);
    expect(at(.08).slashA).toBe(0); expect(at(.12).slashA).toBeGreaterThan(0); expect(at(.16).slashA).toBe(1);
    expect(at(.16).slashB).toBe(0); expect(at(.25).slashB).toBe(1);
    expect(at(.19).burst).toBe(-1); expect(at(.25).burst).toBeGreaterThan(0);
    expect(at(.26).knife).toBe(0); expect(at(.42).knife).toBe(1);
    expect(at(.5).splat).toBeGreaterThan(0); expect(at(.58).splat).toBe(1);
    expect(at(.58).knifeWord).toBe(0); expect(at(.72).knifeWord).toBe(1);
    expect(at(.72).killWord).toBe(0); expect(at(.85).killWord).toBe(1);
    expect(knifeTime(2.7).person).toBe(0); expect(knifeTime(3.3).person).toBe(1);
    expect(knifeTime(3.7).fade).toBe(1); expect(knifeTime(4.15).fade).toBeLessThan(1); expect(knifeTime(KNIFE_DURATION).fade).toBe(0);
  });
  it('keeps KNIFE then KILL in order and never shows KILL first', () => {
    for (let t = 0; t <= KNIFE_DURATION; t += .02) { const s = knifeTime(t); if (s.killWord > 0) expect(s.knifeWord).toBe(1); }
  });
  it('punches the post stack at the cut and the title, and settles in between', () => {
    expect(at(.2).slam).toBeGreaterThan(.5); expect(knifeTime(4.0).slam).toBeLessThan(.05); expect(at(.2).split).toBeGreaterThan(knifeTime(4.0).split);
  });
  it('shakes at the cut and at the title, and is calm in the hold', () => {
    expect(Math.hypot(at(.21).shakeX, at(.21).shakeY)).toBeGreaterThan(0);
    expect(Math.abs(knifeTime(.2).shakeX)).toBe(0);
    expect(Math.hypot(knifeTime(4.0).shakeX, knifeTime(4.0).shakeY)).toBeLessThan(.5);
  });
  it('completes at the same elapsed time at 30, 60 and 120 fps and seeks backwards cleanly', () => {
    for (const fps of [30, 60, 120]) {
      const first = Array.from({ length: 900 }, (_, i) => i / fps).find((t) => knifeTime(t).done)!;
      expect(first).toBeGreaterThanOrEqual(KNIFE_DURATION); expect(first).toBeLessThan(KNIFE_DURATION + 1 / fps);
    }
    knifeTime(4.2); expect(knifeTime(1.8)).toMatchObject({ killWord: 0, done: false });
  });
  it('schedules sounds in order and uses a lighter pool on phones', () => {
    const c = knifeCues(); expect(c.slashA).toBeLessThan(c.slashB); expect(c.hit).toBeLessThan(c.knifeWord); expect(c.knifeWord).toBeLessThan(c.killWord);
    expect(knifeLayout(390, 800).particles).toBeLessThan(knifeLayout(1280, 720).particles); expect(knifeLayout(390, 800).title).toBeGreaterThan(1);
  });
});
