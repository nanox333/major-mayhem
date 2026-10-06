import { describe, expect, it } from 'vitest';
import { NINJA_CLICK, NINJA_DEFUSED, NINJA_DURATION, ledPhase, ninjaCues, ninjaLayout, ninjaShake, ninjaTime } from './timeline';

describe('NINJA DEFUSE clock', () => {
  it('walks the display through the intended critical readouts', () => {
    const at = (t: number) => ninjaTime(t).text;
    expect(at(.05)).toBe('0:00.11'); expect(at(.30)).toBe('0:00.08'); expect(at(.55)).toBe('0:00.05');
    expect(at(.75)).toBe('0:00.03'); expect(at(.90)).toBe('0:00.02'); expect(at(.98)).toBe('0:00.01');
    let last = 99; for (let t = 0; t <= NINJA_CLICK; t += .01) { const h = ninjaTime(t).hundredths; expect(h).toBeLessThanOrEqual(last); last = h; }
  });
  it('freezes the timer at the click and then reads DEFUSED', () => {
    expect(ninjaTime(NINJA_CLICK).text).toBe('0:00.01'); expect(ninjaTime(1.4).text).toBe('0:00.01');
    expect(ninjaTime(NINJA_DEFUSED - .005).label).toBe('DEFUSING...'); expect(ninjaTime(NINJA_DEFUSED).label).toBe('DEFUSED');
  });
  it('starts the bar part-way and locks it at 100% on the click', () => {
    expect(ninjaTime(.05).progress).toBeCloseTo(.55, 2); expect(ninjaTime(.55).progress).toBeCloseTo(.78, 2);
    expect(ninjaTime(NINJA_CLICK - .001).progress).toBeLessThan(1); expect(ninjaTime(NINJA_CLICK).progress).toBe(1);
  });
  it('shows NINJA DEFUSE only after the defuse succeeds', () => {
    for (let t = 0; t < NINJA_CLICK; t += .02) { expect(ninjaTime(t).ninja).toBe(0); expect(ninjaTime(t).defuse).toBe(0); }
    expect(ninjaTime(1.05).ninja).toBe(0); expect(ninjaTime(1.25).ninja).toBe(1); expect(ninjaTime(1.3).defuse).toBe(1);
    expect(ninjaTime(1.18).ninja).toBeGreaterThan(ninjaTime(1.18).defuse);
  });
  it('pulses the red LED faster as it nears zero, then switches it off and the green on', () => {
    const rate = (a: number, b: number) => (ledPhase(b) - ledPhase(a)) / (b - a);
    expect(rate(.1, .3)).toBeCloseTo(2, 1); expect(rate(.5, .7)).toBeCloseTo(4, 1); expect(rate(.8, .95)).toBeCloseTo(7.5, 1);
    expect(ninjaTime(NINJA_DEFUSED).led).toBe(0); expect(ninjaTime(NINJA_DEFUSED).green).toBeGreaterThan(0); expect(ninjaTime(.9).green).toBe(0);
  });
  it('shakes more as the tension builds and stops dead at the click', () => {
    expect(ninjaTime(.2).shake).toBe(0); expect(ninjaTime(.65).shake).toBeGreaterThan(0); expect(ninjaTime(.95).shake).toBeGreaterThan(ninjaTime(.65).shake);
    expect(ninjaTime(NINJA_CLICK).shake).toBe(0); expect(ninjaShake(.5, 0)).toEqual({ x: 0, y: 0, roll: 0 });
  });
  it('uses a very late real value to start the display lower, never unreadable', () => {
    expect(ninjaTime(.05, 4).text).toBe('0:00.04'); expect(ninjaTime(.98, 4).text).toBe('0:00.01'); expect(ninjaTime(.05, 99).text).toBe('0:00.11');
  });
  it('completes at the same elapsed time at 30, 60 and 120 fps and seeks backwards cleanly', () => {
    for (const fps of [30, 60, 120]) {
      const first = Array.from({ length: 400 }, (_, i) => i / fps).find((t) => ninjaTime(t).done)!;
      expect(first).toBeGreaterThanOrEqual(NINJA_DURATION); expect(first).toBeLessThan(NINJA_DURATION + 1 / fps); expect(ninjaTime(first).fade).toBe(0);
    }
    ninjaTime(1.4); expect(ninjaTime(.3)).toMatchObject({ hundredths: 8, success: false, ninja: 0 });
  });
  it('schedules a beep per LED pulse before the click, then the click and the confirmation', () => {
    const c = ninjaCues(); expect(c.beeps.length).toBeGreaterThanOrEqual(4); expect(c.beeps.every((t) => t < NINJA_CLICK)).toBe(true);
    expect(c.beeps[c.beeps.length - 1] - c.beeps[c.beeps.length - 2]).toBeLessThan(c.beeps[1] - c.beeps[0]);
    expect(c.click).toBeLessThan(c.confirm);
  });
  it('widens the bar and enlarges the readout on phones', () => {
    expect(ninjaLayout(390).bar).toBeGreaterThanOrEqual(.7); expect(ninjaLayout(390).bar).toBeLessThanOrEqual(.85); expect(ninjaLayout(390).dpr).toBe(1); expect(ninjaLayout(1280).dpr).toBe(1.5);
  });
});
