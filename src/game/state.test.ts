import { describe, expect, it } from 'vitest';
import * as G from './logic';
import { Run, dailyNumber, fresh, reducer } from './state';
import { addRun, emptyStats } from './stats';
import { shareText } from './share';

/** Plays a whole run through the reducer, always taking the first eligible chip. */
function playThrough(start: Run): Run {
  let s = start;
  while (s.phase === 'draft') {
    s = reducer(s, { type: 'spin' });
    const r = G.rosterById.get(s.offer.find((id) => G.rosterEligible(G.rosterById.get(id)!, s.picks))!)!;
    s = reducer(s, { type: 'team', id: r.id });
    const p = r.players.find((p) => G.eligibleSlots(p, s.picks).length)!;
    s = reducer(s, { type: 'draft', player: p, slot: G.eligibleSlots(p, s.picks)[0] });
  }
  s = reducer(s, { type: 'play' });
  while (s.phase !== 'final') { s = reducer(s, { type: 'start' }); s = reducer(s, { type: 'next' }); }
  return s;
}

describe('daily mode', () => {
  it('deals the same cases to everyone on the same day', () => {
    const a = reducer(fresh('daily', '2026-10-01'), { type: 'spin' });
    const b = reducer(fresh('daily', '2026-10-01'), { type: 'spin' });
    const c = reducer(fresh('daily', '2026-10-02'), { type: 'spin' });
    expect(a.offer).toEqual(b.offer);
    expect(a.offer).not.toEqual(c.offer);
  });
  it('replays identically for the same choices', () => {
    const a = playThrough(fresh('daily', '2026-10-01'));
    const b = playThrough(fresh('daily', '2026-10-01'));
    expect(a.t).toEqual(b.t);
  });
  it('numbers dailies from launch day', () => {
    expect(dailyNumber('2026-09-28')).toBe(1);
    expect(dailyNumber('2026-10-28')).toBe(31);
  });
});

describe('reducer', () => {
  it('records the case each pick came from, for the draft review', () => {
    const s = playThrough(fresh('free'));
    expect(s.picks.every((p) => p.offer?.length === 3)).toBe(true);
    expect(G.draftReview(s.picks).grade).not.toBeNull();
  });
  it('limits rerolls to two', () => {
    let s = reducer(fresh('daily', '2026-10-01'), { type: 'spin' });
    const first = s.offer;
    s = reducer(s, { type: 'reroll' }); s = reducer(s, { type: 'reroll' });
    const after = reducer(s, { type: 'reroll' });
    expect(s.rerolls).toBe(0);
    expect(after).toBe(s);
    expect(s.offer).not.toEqual(first);
  });
});

describe('stats and sharing', () => {
  it('counts a finished run and keeps the first daily result', () => {
    const run = playThrough(fresh('daily', '2026-10-01'));
    const once = addRun(emptyStats(), run);
    const twice = addRun(once, { ...playThrough(fresh('daily', '2026-10-01')) });
    expect(once.runs).toBe(1);
    expect(once.reached.reduce((a, b) => a + b, 0)).toBe(1);
    expect(Object.values(once.drafted).reduce((a, b) => a + b, 0)).toBe(5);
    expect(twice.runs).toBe(2);
    expect(twice.daily['2026-10-01']).toEqual(once.daily['2026-10-01']);
  });
  it('writes a share line with the daily number, the path and all five picks', () => {
    const run = playThrough(fresh('daily', '2026-10-01'));
    const text = shareText(run);
    expect(text).toContain('Daily #4');
    for (const p of G.lineupFromPicks(run.picks)) expect(text).toContain(p.player.nick);
    expect(text.split('\n')[1]).toMatch(/^Q[🟩🟥]/u);
  });
});
