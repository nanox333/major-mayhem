import { describe, expect, it } from 'vitest';
import * as G from './logic';
import { COACHES, ROSTERS, rostersOn } from '../data/rosters';
import { Run, dailyNumber, fresh, lineupFor, reducer, roundOf, validRun } from './state';
import { addAbandon, addRun, dailyStarted, dailyStreak, emptyStats } from './stats';
import { shareText } from './share';

/** Plays your veto turns with the sensible choice. */
function vetoAll(s: Run): Run {
  const oppL = G.naturalLineup(G.rosterById.get(s.current!.opponentId)!);
  while (G.vetoTurn(s.current!.veto)) s = reducer(s, { type: 'veto', map: G.vetoChoice(s.current!.veto, 'us', G.lineupFromPicks(s.picks), oppL) });
  return s;
}

/** Drafts through the reducer, always taking the first eligible chip, then the first coach and bench player offered. */
function draftThrough(start: Run, rounds = Infinity): Run {
  let s = start;
  for (let n = 0; s.phase === 'draft' && n < rounds; n++) {
    s = reducer(s, { type: 'spin' });
    const round = roundOf(s);
    if (round === 'coach') { s = reducer(s, { type: 'coach', rosterId: s.offer[0] }); continue; }
    if (round === 'bench') {
      s = reducer(s, { type: 'team', id: s.offer[0] });
      const taken = G.draftedIds(s.picks);
      s = reducer(s, { type: 'bench', player: G.rosterById.get(s.offer[0])!.players.find((p) => !taken.has(p.id))! });
      continue;
    }
    const r = G.rosterById.get(s.offer.find((id) => G.rosterEligible(G.rosterById.get(id)!, s.picks))!)!;
    s = reducer(s, { type: 'team', id: r.id });
    const p = r.players.find((p) => G.eligibleSlots(p, s.picks).length)!;
    s = reducer(s, { type: 'draft', player: p, slot: G.eligibleSlots(p, s.picks)[0] });
  }
  return s;
}

/** Plays a whole run through the reducer with sensible defaults. */
function playThrough(start: Run): Run {
  let s = reducer(draftThrough(start), { type: 'play' });
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
  const toLive = () => vetoAll(reducer(reducer(draftThrough(fresh('daily', '2026-10-01')), { type: 'play' }), { type: 'start' }));
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

describe('saves', () => {
  const finished = () => playThrough(fresh('free'));
  it('accepts a real run', () => {
    expect(validRun(finished())).toBe(true);
    expect(validRun(fresh())).toBe(true);
  });
  it('rejects saves that point at players, teams or opponents that no longer exist', () => {
    const run = finished();
    const clone = () => JSON.parse(JSON.stringify(run));
    const gonePlayer = clone(); gonePlayer.picks[0].playerId = 'retired-player';
    const goneTeam = clone(); goneTeam.picks[1].rosterId = 'gone-2014-nowhere';
    const goneOpp = clone(); goneOpp.t.matches[0].opponentId = 'gone-2014-nowhere';
    const goneOffer = clone(); goneOffer.offer = ['gone-2014-nowhere'];
    for (const bad of [gonePlayer, goneTeam, goneOpp, goneOffer, { ...clone(), v: 1 }, null]) expect(validRun(bad)).toBe(false);
  });
});

describe('dailies and data changes', () => {
  it('only draws from rosters available on the daily date', () => {
    const date = '2026-10-01';
    const pool = new Set(rostersOn(date).map((r) => r.id));
    let s = fresh('daily', date);
    for (let i = 0; i < 5; i++) {
      s = reducer(s, { type: 'spin' });
      expect(s.offer.every((id) => pool.has(id))).toBe(true);
      const r = G.rosterById.get(s.offer.find((id) => G.rosterEligible(G.rosterById.get(id)!, s.picks))!)!;
      s = reducer(s, { type: 'team', id: r.id });
      const p = r.players.find((p) => G.eligibleSlots(p, s.picks).length)!;
      s = reducer(s, { type: 'draft', player: p, slot: G.eligibleSlots(p, s.picks)[0] });
    }
  });
  it('keeps the launch roster set fixed: new rosters need a `since` date so past dailies stay the same', () => {
    // Adding a roster without `since` changes every daily that has already been played. Give it { since: '<tomorrow>' }.
    expect(ROSTERS.filter((r) => !r.since).length).toBe(46);
    expect(rostersOn('2026-09-28').length).toBe(46);
  });
});

describe('abandoning a daily', () => {
  const started = () => reducer(fresh('daily', '2026-10-01'), { type: 'spin' });
  it('counts once a case is opened, and not for free play or before the first case', () => {
    expect(dailyStarted(fresh('daily', '2026-10-01'))).toBe(false);
    expect(dailyStarted(started())).toBe(true);
    expect(dailyStarted(reducer(fresh('free'), { type: 'spin' }))).toBe(false);
  });
  it('records an abandoned daily that a replay cannot overwrite, and streaks skip it', () => {
    const st = addAbandon(emptyStats(), started());
    expect(st.daily['2026-10-01']).toMatchObject({ placement: 'Abandoned', abandoned: true });
    const replay = addRun(st, playThrough(fresh('daily', '2026-10-01')));
    expect(replay.daily['2026-10-01'].abandoned).toBe(true);
    expect(addAbandon(replay, started())).toBe(replay);
    expect(dailyStreak(replay.daily, '2026-10-01').current).toBe(0);
  });
});

describe('coach, bench and form', () => {
  it('drafts five players, then a coach, then a bench player', () => {
    let s = fresh('free');
    const rounds: string[] = [];
    while (s.phase === 'draft') {
      rounds.push(roundOf(s));
      const before = s.picks.length + (s.coach ? 1 : 0) + (s.bench ? 1 : 0);
      s = draftThrough({ ...s }, 1);
      expect(s.picks.length + (s.coach ? 1 : 0) + (s.bench ? 1 : 0)).toBe(before + 1);
    }
    expect(rounds).toEqual(['player', 'player', 'player', 'player', 'player', 'coach', 'bench']);
    expect(s.coach && s.coach in COACHES).toBe(true);
    expect(s.picks.some((p) => p.playerId === s.bench!.playerId)).toBe(false);
    expect(s.phase).toBe('ready');
  });
  it('keeps five-round drafts for runs saved before the coach and bench', () => {
    const { extras, ...old } = fresh('free');
    let s: Run = { ...old, bench: undefined };
    s = draftThrough(s);
    expect(s.coach).toBeUndefined();
    expect(s.phase).toBe('ready');
  });
  it('rolls match-day form and lets the bench player sub in for one match', () => {
    let s = reducer(draftThrough(fresh('daily', '2026-10-03')), { type: 'play' });
    const ids = [...s.picks.map((p) => p.playerId), s.bench!.playerId];
    expect(Object.keys(s.pending!.form!).sort()).toEqual(ids.sort());
    const out = s.picks[1].playerId;
    s = reducer(s, { type: 'sub', out });
    expect(reducer(s, { type: 'sub', out: 'nobody' })).toBe(s);
    s = reducer(s, { type: 'start' });
    const playing = lineupFor(s, s.current!.subOut, s.current!.playerForm).map((x) => x.player.id);
    expect(playing).toContain(s.bench!.playerId);
    expect(playing).not.toContain(out);
    expect(playing[1]).toBe(s.bench!.playerId); // in the subbed player's slot
  });
});

describe('tactical calls', () => {
  const firstMap = () => {
    let s = reducer(draftThrough(fresh('daily', '2026-10-04')), { type: 'play' });
    s = vetoAll(reducer(s, { type: 'start' }));
    return reducer(s, { type: 'side', side: G.autoSide(s.current!.next!) });
  };
  it('replays the map from the call on, leaving the rounds before it untouched', () => {
    const s = firstMap();
    const g = s.current!.maps[0];
    const at = 6;
    const after = reducer(s, { type: 'call', call: { kind: 'timeout', round: at } });
    const g2 = after.current!.maps[0];
    expect(g2.rounds.slice(0, at)).toEqual(g.rounds.slice(0, at));
    expect(g2.calls!.timeouts).toEqual([at]);
    expect(g2.events.some((e) => e.kind === 'call')).toBe(true);
    // The same call always gives the same map.
    expect(reducer(s, { type: 'call', call: { kind: 'timeout', round: at } }).current).toEqual(after.current);
  });
  it('allows one timeout per half, and a force buy only after a lost pistol', () => {
    const s = firstMap();
    const one = reducer(s, { type: 'call', call: { kind: 'timeout', round: 3 } });
    expect(reducer(one, { type: 'call', call: { kind: 'timeout', round: 8 } })).toBe(one);
    const g = one.current!.maps[0];
    if (g.rounds.length > 14) expect(reducer(one, { type: 'call', call: { kind: 'timeout', round: 14 } })).not.toBe(one);
    const lostPistol = !s.current!.maps[0].rounds[0];
    const forced = reducer(s, { type: 'call', call: { kind: 'force', round: 1 } });
    expect(forced === s).toBe(!lostPistol);
    expect(reducer(s, { type: 'call', call: { kind: 'force', round: 5 } })).toBe(s);
  });
});
