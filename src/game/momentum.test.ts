import { describe, expect, it } from 'vitest';
import { BUY_MARK, economyFor, momentumAt, momentumText } from './momentum';

const r = (s: string) => [...s].map((c) => c === 'W');

describe('momentum (#71)', () => {
  it('counts the last six rounds and your share of them', () => {
    const m = momentumAt(r('WWWLLWLL'), 8);
    expect([m.ours, m.theirs]).toEqual([2, 4]);
    expect(m.run).toBeNull(); // only two in a row
    expect(m.share).toBeCloseTo(2 / 6);
  });
  it('sees a run of three or more, and whose it is', () => {
    expect(momentumAt(r('WLLLL'), 5).run).toEqual({ who: 'them', len: 4 });
    expect(momentumAt(r('LWWW'), 4).run).toEqual({ who: 'us', len: 3 });
    expect(momentumAt(r('WWLW'), 4).run).toBeNull();
  });
  it('only looks at rounds already played', () => {
    expect(momentumAt(r('WWWWWW'), 2).ours).toBe(2);
    expect(momentumAt(r('WWWW'), 0)).toMatchObject({ ours: 0, theirs: 0, share: 0.5 });
  });
  it('says it in a sentence', () => {
    expect(momentumText(momentumAt(r('WLLLL'), 5), 'NAVI')).toBe('NAVI are on a 4-round run');
    expect(momentumText(momentumAt(r('LWWW'), 4), 'NAVI')).toBe("You're on a 3-round run");
    expect(momentumText(momentumAt([], 0), 'NAVI')).toBe('Nothing yet');
    expect(momentumText(momentumAt(r('WLWL'), 4), 'NAVI')).toBe('Even');
  });
});

describe('economy (#71)', () => {
  it('is a full buy for both sides except just after a pistol round', () => {
    expect(economyFor([], 0)).toEqual({ mine: 'full', theirs: 'full' });
    expect(economyFor(r('WWWWWWWW'), 5)).toEqual({ mine: 'full', theirs: 'full' });
  });
  it('favours the pistol winner for the next two rounds', () => {
    expect(economyFor(r('W'), 1)).toEqual({ mine: 'full', theirs: 'eco' });
    expect(economyFor(r('WL'), 2)).toEqual({ mine: 'full', theirs: 'eco' });
    expect(economyFor(r('L'), 1)).toEqual({ mine: 'eco', theirs: 'full' });
    expect(economyFor(r('LL'), 2)).toEqual({ mine: 'eco', theirs: 'full' });
  });
  it('shows a force buy, and being broke after a failed one', () => {
    expect(economyFor(r('L'), 1, [1])).toEqual({ mine: 'force', theirs: 'full' });
    expect(economyFor(r('LL'), 2, [1])).toEqual({ mine: 'eco', theirs: 'full' });
    expect(economyFor(r('LW'), 2, [1])).toEqual({ mine: 'full', theirs: 'full' });
  });
  it('does the same after the second half pistol, and never in overtime', () => {
    const first = r('WWWWWWWWWWWW');
    expect(economyFor([...first, true], 13)).toEqual({ mine: 'full', theirs: 'eco' });
    expect(economyFor([...first, false], 13)).toEqual({ mine: 'eco', theirs: 'full' });
    expect(economyFor(Array(25).fill(false), 25)).toEqual({ mine: 'full', theirs: 'full' });
  });
  it('has a mark for each', () => {
    expect(Object.values(BUY_MARK)).toEqual(['$$$', '$$', '$']);
  });
});
