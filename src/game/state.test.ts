import { describe, expect, it } from 'vitest';
import * as G from './logic';
import { Run, dailyNumber, fresh, reducer } from './state';
import { addRun, dailyStreak, emptyStats } from './stats';
import { shareText } from './share';

/** Plays your veto turns with the sensible choice. */
function vetoAll(s: Run): Run {
  const oppL = G.naturalLineup(G.rosterById.get(s.current!.opponentId)!);
  while (G.vetoTurn(s.current!.veto)) s = reducer(s, { type: 'veto', map: G.vetoChoice(s.current!.veto, 'us', G.lineupFromPicks(s.picks), oppL) });
  return s;
}

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
  while (s.phase !== 'final') {
    s = reducer(s, { type: 'start' });
    s = vetoAll(s);
    while (!s.current!.done) s = reducer(s, { type: 'side', side: G.autoSide(s.current!.next!) });
    s = reducer(s, { type: 'next' });
  }
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

describe('daily streak', () => {
  const played = (...dates: string[]) => Object.fromEntries(dates.map((d) => [d, { placement: 'x', reached: 0, mvp: 'x', grade: null }]));
  it('counts consecutive days up to today, or up to yesterday if today is unplayed', () => {
    const daily = played('2026-10-01', '2026-10-02', '2026-10-03', '2026-10-06');
    expect(dailyStreak(daily, '2026-10-03')).toEqual({ current: 3, best: 3 });
    expect(dailyStreak(daily, '2026-10-04')).toEqual({ current: 3, best: 3 });
    expect(dailyStreak(daily, '2026-10-05')).toEqual({ current: 0, best: 3 });
    expect(dailyStreak(daily, '2026-10-06')).toEqual({ current: 1, best: 3 });
  });
  it('keeps the share text of a finished daily', () => {
    const st = addRun(emptyStats(), playThrough(fresh('daily', '2026-10-01')));
    expect(st.daily['2026-10-01'].share).toContain('Daily #4');
  });
});

describe('knife round', () => {
  const toLive = () => {
    let s = fresh('daily', '2026-10-01');
    while (s.phase === 'draft') {
      s = reducer(s, { type: 'spin' });
      const r = G.rosterById.get(s.offer.find((id) => G.rosterEligible(G.rosterById.get(id)!, s.picks))!)!;
      s = reducer(s, { type: 'team', id: r.id });
      const p = r.players.find((p) => G.eligibleSlots(p, s.picks).length)!;
      s = reducer(s, { type: 'draft', player: p, slot: G.eligibleSlots(p, s.picks)[0] });
    }
    return vetoAll(reducer(reducer(s, { type: 'play' }), { type: 'start' }));
  };
  it('lets you pick only the side left to you after losing the knife', () => {
    const s = toLive();
    const k = s.current!.next!;
    const wrong = k.won ? null : k.oppPick;
    if (wrong) expect(reducer(s, { type: 'side', side: wrong })).toBe(s);
    const ok = reducer(s, { type: 'side', side: G.autoSide(k) });
    expect(ok.current!.maps).toHaveLength(1);
  });
  it('replays a map identically for the same side pick, and not before the series is over', () => {
    const s = toLive();
    const side = G.autoSide(s.current!.next!);
    expect(reducer(s, { type: 'side', side }).current).toEqual(reducer(s, { type: 'side', side }).current);
    expect(reducer(s, { type: 'next' })).toBe(s);
  });
});
