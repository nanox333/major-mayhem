import { describe, expect, it } from 'vitest';
import { SLAM, SLICE_SLAM, WORD_START, slicePose, ember, glint, landingTime, letterPose, settledAt, shake, slash, slice, spark, wave } from './titleAnim';

describe('end-card title animation', () => {
  it('throws the letters in order: the first word from the lens, then the second', () => {
    expect(letterPose(0, 0, 0).visible).toBe(false);
    expect(letterPose(WORD_START[0] + .001, 0, 0).visible).toBe(true);
    expect(landingTime(0, 1)).toBeGreaterThan(landingTime(0, 0));
    expect(landingTime(1, 0)).toBeGreaterThan(landingTime(0, 1));
    expect(letterPose(landingTime(1, 0) - SLAM[1] - .01, 1, 0).visible).toBe(false);
  });
  it('swings each letter up on its base, burning in, and lands it exactly on the page', () => {
    const start = letterPose(WORD_START[1] + .001, 1, 0), landed = letterPose(landingTime(1, 0) + 1, 1, 0);
    expect(start.burn).toBeGreaterThan(.9); expect(Math.abs(start.rotX)).toBeGreaterThan(1); expect(start.z).toBeGreaterThan(.8);
    // the first word rises from below, the second drops from above
    expect(Math.sign(letterPose(WORD_START[0] + .02, 0, 0).y)).toBe(-Math.sign(letterPose(WORD_START[1] + .02, 1, 0).y));
    for (const v of [landed.x, landed.y, landed.z, landed.rotX, landed.rotY, landed.rotZ, landed.burn]) expect(v).toBeCloseTo(0);
    expect(landed.scale).toBe(1);
    // it never goes through the page on the overshoot by more than a hair
    const zs = Array.from({ length: 60 }, (_, i) => letterPose(landingTime(0, 0) - SLAM[0] + i * SLAM[0] / 40, 0, 0).z);
    expect(Math.min(...zs)).toBeGreaterThan(-.35);
  });
  it('flashes warm on each landing and fades', () => {
    expect(letterPose(landingTime(0, 0) - .05, 0, 0).flash).toBe(0);
    expect(letterPose(landingTime(0, 0) + .02, 0, 0).flash).toBeGreaterThan(letterPose(landingTime(0, 0) + .5, 0, 0).flash);
  });
  it('shakes on each landing and settles to nothing', () => {
    expect(shake(0, [2, 5])).toBe(0);
    expect(shake(landingTime(0, 0) + .02, [1, 0])).toBeGreaterThan(shake(landingTime(0, 0) + .5, [1, 0]));
    expect(shake(12, [2, 5])).toBeLessThan(1e-6);
  });
  it('opens with a slash, then runs the wave and the slice in order', () => {
    expect(slash(0)).toEqual({ length: 0, opacity: 1 }); expect(slash(.1).length).toBeGreaterThan(.5); expect(slash(.8).opacity).toBe(0);
    const s = settledAt([2, 5]);
    expect(s).toBeGreaterThan(landingTime(1, 4));
    expect(wave(s + .02, s, 0)).toBeGreaterThan(wave(s + .02, s, 1));       // the wave starts at the left
    expect(wave(s + .55, s, 1)).toBeGreaterThan(wave(s + .55, s, 0));       // and has reached the right
    expect(slice(s + .2, s).power).toBe(0); expect(slice(s + .71, s).power).toBeGreaterThan(.5); expect(slice(s + 1.2, s).power).toBe(0);
  });
  it('is a pure function of time: glint, sparks and embers', () => {
    expect(glint(1, 2).power).toBe(0); expect(glint(4, 2).power).toBeGreaterThanOrEqual(0); expect(glint(3.7, 2)).toEqual(glint(3.7, 2));
    expect(spark(.4, 1, 3)).toBeNull(); expect(spark(3, 1, 3)).toBeNull();
    const a = spark(1.2, 1, 3)!, b = spark(1.8, 1, 3)!; expect(a.alpha).toBeGreaterThan(b.alpha); expect(spark(1.5, 1, 3)).toEqual(spark(1.5, 1, 3));
    expect(ember(0, 2, 0)).toBeNull(); const e = ember(3, 2, 5)!; expect(e.x).toBeGreaterThanOrEqual(0); expect(e.y).toBeLessThan(1); expect(ember(3, 2, 5)).toEqual(e);
  });
  it('slides the two halves of a cut letter in from opposite ends and joins them exactly', () => {
    const land = landingTime(0, 1) - (SLAM[0] - SLICE_SLAM);
    const p = slicePose(land - SLICE_SLAM + .001, 0, 1, 1), q = slicePose(land - SLICE_SLAM + .001, 0, 1, -1);
    expect(p.d).toBeGreaterThan(4); expect(q.d).toBeLessThan(-4);
    const j = slicePose(land + 1, 0, 1, 1); expect(j.d).toBeCloseTo(0); expect(j.z).toBeCloseTo(0); expect(j.burn).toBe(0);
    expect(slicePose(land + .02, 0, 1, 1).flash).toBeGreaterThan(slicePose(land + .6, 0, 1, 1).flash);
    expect(slicePose(land - SLICE_SLAM - .05, 0, 1, 1).visible).toBe(false);
  });
});
