import { describe, expect, it } from 'vitest';
import { CLUTCH_DURATION, DIP_AT, HERO_AT, KILLS, PERSON_AT, RETICLE_ON, SWAP_AT, TITLE_AT, clutchLayout, clutchTime, reticle } from './timeline';
import { FULL_PAGE_LEGENDS, isFullPage } from '../legend3d/kinds';
import { LEGENDS } from '../../game/match';

describe('1v5 CLUTCH clock', () => {
  it('is a slow, deliberate piece: about ten seconds, with at least a second between the early kills', () => {
    expect(CLUTCH_DURATION).toBeGreaterThan(9);
    expect(CLUTCH_DURATION).toBeLessThan(12);
    expect(KILLS[1] - KILLS[0]).toBeGreaterThanOrEqual(.9);
    expect(KILLS.slice(1).every((k, i) => k - KILLS[i] >= .65)).toBe(true);
  });
  it('is a full-page highlight, and ordinary legends are not routed to it', () => {
    expect(isFullPage('clutch5')).toBe(true);
    expect(FULL_PAGE_LEGENDS.every((k) => (LEGENDS as readonly string[]).includes(k))).toBe(true);
    for (const k of ['flawless', 'miracle', 'marathon'] as const) expect(isFullPage(k)).toBe(false);
  });
  it('plays the five kills in order and the rhythm tightens', () => {
    expect(clutchTime(0).kills).toBe(0);
    KILLS.forEach((k, i) => { expect(clutchTime(k - .001).kills).toBe(i); expect(clutchTime(k).kills).toBe(i + 1); expect(clutchTime(k + .02).kill).toBe(i); });
    expect([...KILLS].sort((a, b) => a - b)).toEqual([...KILLS]);
    const gaps = KILLS.slice(1).map((k, i) => k - KILLS[i]);
    expect(gaps[0]).toBeGreaterThan(gaps[3]);
  });
  it('never cuts: the camera is one shot until the hero shot, after a dip to dark', () => {
    for (const t of [0, 1, KILLS[0], KILLS[2], KILLS[4], DIP_AT - .01]) expect(clutchTime(t).shot).toBe('track');
    expect(clutchTime(HERO_AT).shot).toBe('hero');
    // the scene swaps to the hero layout only while it is dark
    expect(clutchTime(SWAP_AT - .001).swapped).toBe(false);
    expect(clutchTime(SWAP_AT).black).toBeGreaterThan(.9);
    expect(clutchTime(DIP_AT - .01).black).toBe(0);
    expect(clutchTime(HERO_AT + 1).black).toBe(0);
  });
  it('slides a reticle from enemy to enemy, on each at its kill, so it is clear who is being shot', () => {
    expect(reticle(RETICLE_ON - .01).on).toBe(0);
    expect(reticle(RETICLE_ON + .5).on).toBeGreaterThan(.9);
    KILLS.forEach((k, i) => { expect(reticle(k).p).toBeCloseTo(i, 5); expect(reticle(k).lock).toBeGreaterThan(.95); });
    // between two kills it is part-way along, never jumping
    for (let i = 0; i < 4; i++) {
      const mid = (KILLS[i] + KILLS[i + 1]) / 2, p = reticle(mid).p;
      expect(p).toBeGreaterThan(i); expect(p).toBeLessThan(i + 1);
    }
    let last = reticle(RETICLE_ON).p;
    for (let t = RETICLE_ON; t < KILLS[4]; t += 1 / 60) { const p = reticle(t).p; expect(Math.abs(p - last)).toBeLessThan(.12); last = p; }
    expect(reticle(KILLS[4] + 1).on).toBe(0);
  });
  it('takes the enemy markers away one at a time', () => {
    KILLS.forEach((k, i) => {
      const s = clutchTime(k + .02);
      s.markers.forEach((m, j) => { expect(m.hit).toBe(j <= i); expect(m.alive).toBe(j > i); if (j > i) expect(m.gone).toBe(0); });
      expect(clutchTime(k - .001).markers[i].alive).toBe(true);
      expect(s.markers[i].flash).toBeGreaterThan(.8);
      expect(s.counter).toBe(`${i + 1} / 5`);
    });
    const gone = (t: number) => clutchTime(t).markers.map((m) => m.gone);
    expect(gone(KILLS[0] + .5)[0]).toBeGreaterThan(0);
    expect(gone(KILLS[0] + .5)[1]).toBe(0);
    expect(gone(DIP_AT).every((g) => g === 1)).toBe(true);
  });
  it('shows 1 VS 5 first, holds it long enough to read, and clears it before the reticle', () => {
    expect(clutchTime(.5).versus).toBeLessThan(.3);
    const readable = Array.from({ length: 400 }, (_, i) => i / 100).filter((t) => clutchTime(t).versus > .95);
    expect(readable.length / 100).toBeGreaterThan(.6);
    expect(clutchTime(RETICLE_ON + .4).versus).toBe(0);
  });
  it('shakes harder toward the fifth kill', () => {
    const peaks = KILLS.map((k) => clutchTime(k + .001).shake);
    expect(peaks[4]).toBeGreaterThan(peaks[3]);
    expect(peaks[2]).toBeGreaterThan(peaks[0]);
    expect(clutchTime(KILLS[4] + 2).shake).toBeLessThan(.0005);
  });
  it('flashes after the fifth kill, then the hero shot, and only then the title and the plate', () => {
    expect(clutchTime(KILLS[4] + .06).flash).toBeGreaterThan(.5);
    expect(DIP_AT).toBeGreaterThan(KILLS[4]);
    expect(HERO_AT).toBeGreaterThan(SWAP_AT);
    expect(TITLE_AT).toBeGreaterThan(HERO_AT);
    for (const t of [0, KILLS[0], KILLS[4], HERO_AT, TITLE_AT - .01]) expect(clutchTime(t).title).toBe(false);
    expect(clutchTime(TITLE_AT).title).toBe(true);
    expect(clutchTime(TITLE_AT - .5).titleAge).toBeLessThan(0);
    expect(clutchTime(TITLE_AT + 1).titleAge).toBeCloseTo(1, 5);
    expect(PERSON_AT).toBeGreaterThan(TITLE_AT + .8);
    expect(clutchTime(PERSON_AT - .01).person).toBe(0);
    expect(clutchTime(PERSON_AT + .7).person).toBe(1);
  });
  it('holds the title before it fades, and finishes exactly once at the same time at 30, 60 and 120 fps', () => {
    expect(clutchTime(CLUTCH_DURATION - 1).fade).toBe(1);
    for (const fps of [30, 60, 120]) {
      const frames = Array.from({ length: Math.ceil((CLUTCH_DURATION + 1) * fps) }, (_, i) => i / fps);
      const done = frames.filter((t) => clutchTime(t).done);
      expect(done[0]).toBeGreaterThanOrEqual(CLUTCH_DURATION);
      expect(done[0]).toBeLessThan(CLUTCH_DURATION + 1 / fps);
      expect(clutchTime(done[0]).fade).toBe(0);
      expect(frames.filter((t) => !clutchTime(t).done).every((t) => t < CLUTCH_DURATION)).toBe(true);
    }
  });
  it('seeks backwards without retaining any state', () => {
    clutchTime(CLUTCH_DURATION);
    expect(clutchTime(KILLS[1] + .02)).toMatchObject({ kills: 2, kill: 1, shot: 'track', title: false, black: 0, swapped: false });
  });
  it('lays out for phones with fewer particles and a lower pixel ratio', () => {
    const phone = clutchLayout(390, 844), desktop = clutchLayout(1280, 720);
    expect(phone).toMatchObject({ mobile: true, dpr: 1 });
    expect(phone.dust).toBeLessThan(desktop.dust);
    expect(desktop.dpr).toBeLessThanOrEqual(1.5);
    expect(desktop.dust).toBeLessThanOrEqual(50);
  });
});
