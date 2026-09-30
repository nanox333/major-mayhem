import { describe, expect, it } from 'vitest';
import * as G from './logic';
import { COACHES, ROSTERS, rostersOn } from '../data/rosters';
import { Opts, Run, dailyNumber, fresh, lineupFor, poolCheck, reducer, roundOf, validRun } from './state';
import { FINISH_SHORT, addAbandon, addRun, dailyStarted, dailyStreak, emptyStats, recentDailies, statsSections } from './stats';
import { shareText } from './share';
import { newAchievements } from './achievements';
import { DUEL_ID, decodeDuel, duelCode, duelFrom, duelLink, encodeDuel } from './duel';

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

describe('drafting straight from the case (#105)', () => {
  /** One player round: spin, optionally look at every team and go back (the old two-screen flow allowed that), then open a team and draft. */
  const round = (start: Run, browse: boolean): Run => {
    let s = reducer(start, { type: 'spin' });
    const r = G.rosterById.get(s.offer.find((id) => G.rosterEligible(G.rosterById.get(id)!, s.picks))!)!;
    if (browse) for (const id of s.offer) { s = reducer(s, { type: 'team', id }); s = reducer(s, { type: 'back' }); }
    s = reducer(s, { type: 'team', id: r.id });
    const p = r.players.find((x) => G.eligibleSlots(x, s.picks).length)!;
    return reducer(s, { type: 'draft', player: p, slot: G.eligibleSlots(p, s.picks)[0] });
  };
  it('reaches exactly the same run whether or not the teams were browsed first, so seeds play out as they did', () => {
    for (const date of ['2026-10-01', '2026-10-02', '2026-10-03']) {
      let direct = fresh('daily', date), browsed = fresh('daily', date);
      for (let i = 0; i < 5; i++) { direct = round(direct, false); browsed = round(browsed, true); }
      expect(direct).toEqual(browsed);
      expect(direct.picks).toHaveLength(5);
    }
  });
  it('a run saved on the old player screen still loads', () => {
    const s = reducer(reducer(fresh('daily', '2026-10-01'), { type: 'spin' }), { type: 'team', id: reducer(fresh('daily', '2026-10-01'), { type: 'spin' }).offer[0] });
    expect(s.step).toBe('players');
    expect(validRun(JSON.parse(JSON.stringify(s)))).toBe(true);
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
  it('writes a short spoiler-light grid: the daily number, the path and which picks were the best in their case (#73)', () => {
    const run = playThrough(fresh('daily', '2026-10-01'));
    const lines = shareText(run, 'https://example.test/').split('\n');
    expect(lines[0]).toContain('Daily #4');
    expect(lines.length).toBeLessThanOrEqual(6);
    expect(lines.some((l) => /^Swiss [🟩🟥]+$/u.test(l))).toBe(true);
    expect(lines.find((l) => l.startsWith('Draft '))).toMatch(/^Draft [🎯⬜]+ {2}\(\d+\/\d+ best picks\)$/u);
    expect(lines[lines.length - 1]).toBe('https://example.test/');
    // Names stay out of it, and hard mode is marked in the title.
    for (const p of G.lineupFromPicks(run.picks)) expect(lines.slice(1, -1).join('\n')).not.toContain(`${p.player.nick} ·`);
    expect(shareText({ ...run, opts: { hard: true } }).split('\n')[0]).toContain('💀');
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
  it('splits runs and titles by mode from when it starts counting, keeping all-time totals (#67)', () => {
    const legacy = { ...emptyStats(), runs: 4, titles: 1 };
    let st = addRun(legacy, playThrough(fresh('daily', '2026-10-01')));
    st = addRun(st, playThrough(fresh('free', undefined, { era: 'cs2', hard: true })));
    st = addRun(st, playThrough(fresh('free')));
    expect(st.runs).toBe(7);
    expect(st.byMode!.since).toBe('2026-10-01');
    expect(st.byMode!.daily.runs).toBe(1);
    expect(Object.keys(st.byMode!.free).sort()).toEqual(['all', 'cs2+hard']);
    const tallied = st.byMode!.daily.titles + Object.values(st.byMode!.free).reduce((n, t) => n + t.titles, 0);
    expect(st.titles).toBe(1 + tallied);
  });
  it('shows duels and abandoned dailies without a finished Major run (#64)', () => {
    expect(statsSections(emptyStats())).toEqual({ runs: false, duels: false, dailies: false, empty: true });
    expect(statsSections({ ...emptyStats(), duels: { w: 0, l: 1 } })).toMatchObject({ runs: false, duels: true, empty: false });
    expect(statsSections(addAbandon(emptyStats(), started()))).toMatchObject({ runs: false, dailies: true, empty: false });
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

describe('free-play modes', () => {
  const offers = (s: Run, n = 12) => {
    const seen: string[] = [];
    for (let i = 0; i < n; i++) { const r = reducer({ ...s, seed: `${s.seed}-${i}` }, { type: 'spin' }); seen.push(...r.offer); }
    return seen.map((id) => G.rosterById.get(id)!);
  };
  it('sets options only before the first case of a free run', () => {
    const s = reducer(fresh('free'), { type: 'opts', opts: { pool: 'champions' } });
    expect(s.opts).toEqual({ pool: 'champions' });
    const spun = reducer(s, { type: 'spin' });
    expect(reducer(spun, { type: 'opts', opts: {} })).toBe(spun);
    expect(reducer(fresh('daily'), { type: 'opts', opts: { hard: true } }).opts).toBeUndefined();
  });
  it('draws from champions, underdogs or one era only', () => {
    expect(offers(fresh('free', undefined, { pool: 'champions' })).every((r) => r.result === 'Champions')).toBe(true);
    expect(offers(fresh('free', undefined, { pool: 'underdogs' })).every((r) => !['Champions', 'Runner-up'].includes(r.result))).toBe(true);
    expect(offers(fresh('free', undefined, { era: 'cs2' })).every((r) => r.year >= 2024)).toBe(true);
    expect(offers(fresh('free', undefined, { era: 'csgo' })).every((r) => r.year <= 2023)).toBe(true);
  });
  it('refuses filters that leave too few teams, and never widens a chosen one (#63)', () => {
    const combos: Opts[] = [{}, { era: 'csgo' }, { era: 'cs2' }, { pool: 'champions' }, { pool: 'underdogs' },
      { era: 'csgo', pool: 'champions' }, { era: 'csgo', pool: 'underdogs' }, { era: 'cs2', pool: 'champions' }, { era: 'cs2', pool: 'underdogs' }];
    const inside = (o: Opts) => (r: { year: number; result: string }) =>
      (!o.era || (o.era === 'cs2') === (r.year >= 2024))
      && (o.pool !== 'champions' || r.result === 'Champions')
      && (o.pool !== 'underdogs' || !['Champions', 'Runner-up'].includes(r.result));
    for (const o of combos) {
      const s = reducer(fresh('free'), { type: 'opts', opts: o });
      if (!poolCheck(o).ok) { expect(s.opts ?? {}).toEqual({}); continue; }
      // a full draft (players, coach, bench) stays inside the filter on several seeds
      for (let i = 0; i < 4; i++) {
        const done = draftThrough({ ...s, seed: `pool-${JSON.stringify(o)}-${i}` });
        expect(done.phase).not.toBe('draft');
        const used = [...done.picks, ...(done.bench ? [done.bench] : [])].map((p) => G.rosterById.get(p.rosterId)!);
        expect(used.every(inside(o))).toBe(true);
      }
    }
    // the case from the issue: CS2 + Champions is too small today, so it can't be selected
    expect(poolCheck({ era: 'cs2', pool: 'champions' }).ok).toBe(false);
  });
  it('lets hard mode put anyone in any open slot', () => {
    let s = reducer(fresh('free', undefined, { hard: true }), { type: 'spin' });
    s = reducer(s, { type: 'team', id: s.offer[0] });
    const p = G.rosterById.get(s.offer[0])!.players[0];
    const off = ['IGL', 'AWP', 'ENTRY', 'LURK', 'SUP'].find((r) => !p.roles.includes(r as never))!;
    expect(reducer(s, { type: 'draft', player: p, slot: off as never }).picks).toHaveLength(1);
    expect(reducer({ ...s, opts: undefined }, { type: 'draft', player: p, slot: off as never }).picks).toHaveLength(0);
  });
  it('keeps the options when playing again, and drops them for a daily', () => {
    const s = fresh('free', undefined, { era: 'cs2', hard: true });
    expect(reducer(s, { type: 'reset' }).opts).toEqual({ era: 'cs2', hard: true });
    expect(reducer(s, { type: 'reset', mode: 'daily' }).opts).toBeUndefined();
  });
});

describe('achievements', () => {
  const run = playThrough(fresh('daily', '2026-10-05'));
  const asChamp: Run = { ...run, t: { ...run.t, status: 'champion' } };
  it('awards on the finished run and never twice', () => {
    const a = addRun(emptyStats(), asChamp);
    expect(a.ach.champion).toBe('2026-10-05');
    expect(a.lastNew).toContain('champion');
    const b = addRun(a, { ...asChamp, seed: 'free-x', mode: 'free' });
    expect(b.lastNew).not.toContain('champion');
    expect(b.ach.champion).toBe('2026-10-05');
  });
  it('checks streaks through the lifetime stats', () => {
    expect(newAchievements(run, { streak: 3, dailyStreak: 7 }, {})).toEqual(expect.arrayContaining(['dynasty', 'daily-3', 'daily-7']));
    expect(newAchievements(run, { streak: 0, dailyStreak: 2 }, {})).not.toContain('daily-3');
  });
});

describe('draft duels', () => {
  const challenger = draftThrough(fresh('free', undefined, { era: 'csgo' }));
  const d = duelFrom(challenger, 'Kristián ⚡');
  it('round-trips a team through a link, names included', () => {
    const back = decodeDuel(encodeDuel(d))!;
    expect(back).toEqual(d);
    expect(back.name).toBe('Kristián ⚡');
    expect(duelCode(duelLink('https://x.test/', d).split('https://x.test/')[1])).toBe(encodeDuel(d));
  });
  it('accepts only known free-play options in a link, and drops extra keys (#27)', () => {
    const bad = (opts: unknown) => decodeDuel(encodeDuel({ ...d, opts } as typeof d));
    expect(bad({ era: 'cs3' })).toBeNull();
    expect(bad({ pool: 'everyone' })).toBeNull();
    expect(bad({ hard: 'yes' })).toBeNull();
    expect(bad('cs2')).toBeNull();
    expect(bad(null)).toBeNull();
    expect(bad([1])).toBeNull();
    expect(bad({ era: 'cs2', hard: true, extra: '<script>' })!.opts).toEqual({ era: 'cs2', hard: true });
    expect(bad({ hard: false })!.opts).toEqual({});
    expect(bad(undefined)!.opts).toBeUndefined();
  });
  it('rejects broken or foreign links', () => {
    expect(decodeDuel('not-a-duel')).toBeNull();
    expect(decodeDuel(encodeDuel({ ...d, picks: d.picks.map((p, i) => (i === 0 ? [p[0], p[1], 'nobody'] : p)) as typeof d.picks }))).toBeNull();
    expect(decodeDuel(encodeDuel({ ...d, coach: 'nobody' }))).toBeNull();
  });
  it('opens the same first case, then plays one showmatch against the challenger', () => {
    let s = reducer(fresh('free'), { type: 'duel', duel: d });
    expect(s.mode).toBe('duel');
    const theirFirstCase = reducer({ ...fresh('free', undefined, { era: 'csgo' }), seed: challenger.seed }, { type: 'spin' }).offer;
    expect(reducer(s, { type: 'spin' }).offer).toEqual(theirFirstCase);
    s = playThrough(s);
    expect(s.t.matches).toHaveLength(1);
    expect(s.t.matches[0].stage).toBe('DUEL');
    expect(s.t.matches[0].opponentId).toBe(DUEL_ID);
    expect(['DUEL-W', 'DUEL-L']).toContain(G.placement(s.t).key);
    expect(shareText(s)).toContain('draft duel vs Kristián ⚡');
  });
  it('survives a reload: the challenger is registered before the save is checked', () => {
    const s = reducer(reducer(draftThrough(reducer(fresh('free'), { type: 'duel', duel: d })), { type: 'play' }), { type: 'start' });
    expect(validRun(JSON.parse(JSON.stringify(s)))).toBe(true);
  });
});

describe('recent dailies for the stats chart (#76)', () => {
  it('lists the last days oldest first, with gaps for days not played and a mark for abandoned ones', () => {
    const daily = {
      '2026-10-01': { placement: 'Champions', reached: 4, mvp: 'a', grade: 0.9 },
      '2026-10-03': { placement: 'Abandoned', reached: 0, mvp: '–', grade: null, abandoned: true },
      '2026-10-04': { placement: 'Semifinals', reached: 2, mvp: 'b', grade: 0.7 },
    };
    const days = recentDailies(daily, '2026-10-04', 5);
    expect(days.map((d) => d.date)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(days.map((d) => d.state)).toEqual(['missed', 'played', 'missed', 'abandoned', 'played']);
    expect(days[1]).toMatchObject({ reached: 4, placement: 'Champions', n: 4 });
    expect(days[4].reached).toBe(2);
  });
  it('crosses a month end and keeps the requested length', () => {
    const days = recentDailies({}, '2026-10-02', 14);
    expect(days).toHaveLength(14);
    expect(days[0].date).toBe('2026-09-19');
    expect(days[13].date).toBe('2026-10-02');
  });
  it('names every finish in a few letters', () => {
    expect(FINISH_SHORT).toHaveLength(5);
  });
});
