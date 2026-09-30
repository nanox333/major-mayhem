import { describe, expect, it } from 'vitest';
import { ROLE_ORDER, ROSTERS } from '../data/rosters';
import * as G from './logic';
import { Run, benchLineup, fresh, reducer, roundOf } from './state';
import { CLUE_ORDER, compare, guessShare, pros } from './guess';
import { coachKnows } from './synergy';
import { sameCandidate } from './draftui';
import { teamReview } from './review';

// Fairness of opponents, ratings and reviews (#167, #168, #169, #175, #177, #178).

function draftThrough(start: Run): Run {
  let s = start;
  for (let n = 0; s.phase === 'draft' && n < 20; n++) {
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
    const p = r.players.find((x) => G.eligibleSlots(x, s.picks).length)!;
    s = reducer(s, { type: 'draft', player: p, slot: G.eligibleSlots(p, s.picks)[0] });
  }
  return s;
}
function vetoAll(s: Run): Run {
  const oppL = G.naturalLineup(G.rosterById.get(s.current!.opponentId)!);
  while (G.vetoTurn(s.current!.veto)) s = reducer(s, { type: 'veto', map: G.vetoChoice(s.current!.veto, 'us', G.lineupFromPicks(s.picks), oppL) });
  return s;
}
/** A whole run in which the bench player replaces the first starter in every match. */
function playWithBench(start: Run): Run {
  let s = reducer(draftThrough(start), { type: 'play' });
  const out = s.picks[0].playerId;
  while (s.phase !== 'final') {
    s = reducer(s, { type: 'sub', out });
    s = reducer(s, { type: 'start' });
    s = vetoAll(s);
    while (!s.current!.done) s = reducer(s, { type: 'side', side: G.autoSide(s.current!.next!) });
    s = reducer(s, { type: 'next' });
  }
  return s;
}

describe('opponents share nobody with your team for as long as any clean ones remain (#167)', () => {
  const cs2 = ROSTERS.filter((r) => r.year >= 2024 && !r.until);
  const team = () => {
    // A drafted team from the era: five players from five different rosters.
    const picks = cs2.slice(0, 5).map((r, i) => ({ slot: ROLE_ORDER[i], rosterId: r.id, playerId: r.players[0].id }));
    return G.lineupFromPicks(picks as G.Pick[]);
  };
  const t = (used: string[]): G.Tournament => ({ ...G.newTournament(), used });
  const cleanFor = (mine: G.Lineup[]) => cs2.filter((r) => !r.players.some((p) => mine.some((x) => x.player.id === p.id)));

  it('from rules v3, picks a clean opponent whenever one is left, even when fewer than eight are', () => {
    const mine = team();
    const clean = cleanFor(mine);
    expect(clean.length).toBeGreaterThan(3);
    for (let left = 1; left <= Math.min(7, clean.length); left++) {
      const used = clean.slice(left).map((r) => r.id);
      for (let seed = 0; seed < 25; seed++) {
        const id = G.withRules(3, () => G.seeded(`audit-${seed}`, () => G.pickOpponent(t(used), 'QUAL', mine, cs2)));
        expect(clean.map((r) => r.id), `${left} left, seed ${seed}`).toContain(id);
      }
    }
  });
  it('falls back only after the clean ones are used up', () => {
    const mine = team();
    const used = cleanFor(mine).map((r) => r.id);
    const id = G.withRules(3, () => G.seeded('audit-x', () => G.pickOpponent(t(used), 'QUAL', mine, cs2)));
    expect(used).not.toContain(id);
  });
  it('keeps the old behaviour for older rules, so an old daily replays as it did', () => {
    const mine = team();
    const clean = cleanFor(mine);
    const used = clean.slice(3).map((r) => r.id); // three clean ones left: fewer than eight
    let unclean = 0;
    for (let seed = 0; seed < 60; seed++) {
      const id = G.withRules(2, () => G.seeded(`audit-${seed}`, () => G.pickOpponent(t(used), 'QUAL', mine, cs2)));
      if (!clean.some((r) => r.id === id)) unclean++;
    }
    expect(unclean).toBeGreaterThan(0);
  });
});

describe('series ratings keep each side apart (#168)', () => {
  const stat = (id: string, k: number, d: number, rating: number) => ({ id, nick: id, k, d, rating });
  const map = (mine: ReturnType<typeof stat>[], opp: ReturnType<typeof stat>[]) => ({ rounds: Array(24).fill(true), stats: { mine, opp } }) as unknown as G.MapGame;
  it('gives a shared player their own numbers on each side', () => {
    const maps = [map([stat('tarik', 12, 17, 0.9), stat('a', 1, 1, 1)], [stat('tarik', 18, 15, 1.24), stat('b', 1, 1, 1)])];
    expect(G.seriesRatings(maps, 'mine').tarik).toEqual({ k: 12, d: 17, rating: 0.9 });
    expect(G.seriesRatings(maps, 'opp').tarik).toEqual({ k: 18, d: 15, rating: 1.24 });
    expect(Object.keys(G.seriesRatings(maps, 'mine'))).toEqual(['tarik', 'a']);
  });
  it('leaves an ordinary report unchanged', () => {
    const maps = [map([stat('a', 10, 12, 0.95)], [stat('b', 14, 9, 1.1)]), map([stat('a', 14, 10, 1.05)], [stat('b', 9, 14, 0.9)])];
    expect(G.seriesRatings(maps, 'mine').a.rating).toBe(1);
    expect(G.seriesRatings(maps, 'mine').b).toBeUndefined();
    expect(G.seriesRatings(maps, 'opp').b.rating).toBe(1);
  });
});

describe('coach familiarity follows the rules dataset (#169)', () => {
  it('knows the coach a team had under each version', () => {
    const vitality = ROSTERS.find((r) => r.org === 'Team Vitality' && r.year === 2023)!;
    const ids = vitality.players.map((p) => p.id);
    G.withRules(1, () => { for (const id of ids) expect(coachKnows('XTQZZZ', id), `v1 ${id}`).toBe(true); });
    G.withRules(2, () => { for (const id of ids) expect(coachKnows('zonic', id), `v2 ${id}`).toBe(true); });
    // And a newer version keeps the corrected coach.
    G.withRules(3, () => { for (const id of ids) expect(coachKnows('zonic', id), `v3 ${id}`).toBe(true); });
  });
});

describe('the team review credits the players who played (#177)', () => {
  const run = playWithBench(fresh('free'));
  const mine = G.lineupFromPicks(run.picks);
  const bench = benchLineup(run)!;
  // The starter the bench player replaces in every match is the first one drafted (not the first in slot order).
  const subbed = mine.find((x) => x.player.id === run.picks[0].playerId)!;
  it('rates the bench player and not the starter who never played', () => {
    const ratings = G.seriesRatings(run.t.matches.flatMap((m) => m.maps));
    expect(ratings[bench.player.id]).toBeDefined();
    expect(ratings[subbed.player.id]).toBeUndefined();
  });
  it('can name the bench player as who stood out or was quietest, and never the unused starter', () => {
    const r = teamReview(mine, run.coach, run.t, [...mine, bench]);
    const names = [r.strongest?.nick, r.weakest?.nick];
    expect(names).not.toContain(subbed.player.nick);
    const played = [...mine.filter((x) => x.player.id !== subbed.player.id), bench].map((x) => x.player.nick);
    for (const n of names) expect(played).toContain(n);
    // Without the bench in the picture (the old call) the bench player could never be named.
    const old = teamReview(mine, run.coach, run.t);
    expect([old.strongest?.nick, old.weakest?.nick]).not.toContain(bench.player.nick);
  });
  it('still describes the drafted lineup for roles and chemistry', () => {
    const r = teamReview(mine, run.coach, run.t, [...mine, bench]);
    expect(r.roles.main + r.roles.secondary + r.roles.off).toBe(5);
  });
});

describe('pick strength compares the real alternatives (#178)', () => {
  it('counts a hard-mode draft against every legal placement, including roles a player does not cover', () => {
    // Four slots are filled, so only Support is open. A star who never plays Support is not an alternative in normal mode, but hard mode allows any open slot.
    const nat = G.naturalLineup(ROSTERS[0]);
    const four = nat.filter((x) => x.slot !== 'SUP').map((x) => ({ slot: x.slot, rosterId: x.roster.id, playerId: x.player.id }));
    const sup = nat.find((x) => x.slot === 'SUP')!;
    let star: { id: string; rating: number; roles: string[] } | null = null;
    let starRoster = ROSTERS[1];
    for (const r of ROSTERS) for (const p of r.players) {
      if (!p.roles.includes('SUP') && !four.some((f) => f.playerId === p.id) && p.id !== sup.player.id && (!star || p.rating > star.rating)) { star = p; starRoster = r; }
    }
    expect(star).not.toBeNull();
    const fifth = { slot: 'SUP' as const, rosterId: sup.roster.id, playerId: sup.player.id, offer: [sup.roster.id, starRoster.id] };
    const picks = [...four, fifth] as G.Pick[];
    const normal = G.draftReview(picks, false).rounds[4];
    const hard = G.draftReview(picks, true).rounds[4];
    const starPlayer = starRoster.players.find((p) => p.id === star!.id)!;
    expect(hard.best!.value).toBeGreaterThanOrEqual(G.pickValue(starPlayer, 'SUP') - 1e-9);
    expect(hard.best!.value).toBeGreaterThanOrEqual(normal.best?.value ?? 0);
  });
  it('never finds fewer options in hard mode than in normal mode', () => {
    for (let i = 0; i < 12; i++) {
      const run = draftThrough({ ...fresh('free', undefined, { hard: true }), seed: `free-audit-${i}` });
      const normal = G.draftReview(run.picks, false).rounds;
      G.draftReview(run.picks, true).rounds.forEach((h, k) => { if (h.best && normal[k].best) expect(h.best.value).toBeGreaterThanOrEqual(normal[k].best!.value - 1e-9); });
    }
  });
  it('says a pick is not the strongest when the same person in another role was worth more', () => {
    // The pick's own value is role-adjusted, so a secondary-role pick with the main role open scores below the best placement.
    for (let i = 0; i < 40; i++) {
      const run = draftThrough({ ...fresh('free'), seed: `free-fit-${i}` });
      for (const r of G.draftReview(run.picks).rounds) {
        if (r.best && r.best.player.id === r.player.id && r.best.slot !== r.slot && r.best.value > r.value + 0.01) return expect(r.value).toBeLessThan(r.best.value);
      }
    }
  });
});

describe('the clue order is defined once (#175)', () => {
  const all = pros();
  it('returns the clues in the order they are shown', () => {
    const c = compare(all.get('niko')!, all.get('zywoo')!);
    expect(c.map((x) => x.key)).toEqual([...CLUE_ORDER]);
  });
  it('writes the shared row left to right as the cells are shown, for a mixed answer', () => {
    const guess = all.get('niko')!, answer = all.get('zywoo')!;
    const squares = compare(guess, answer).map((c) => ({ hit: '🟩', near: '🟨', miss: '⬛' })[c.state]).join('');
    expect(new Set(squares.match(/./gu)).size).toBeGreaterThan(1); // a mixture, not all one result
    const text = guessShare('2026-10-10', { guesses: [guess.id], done: false, won: false }, answer, all);
    expect(text.split('\n')[1]).toBe(squares);
  });
});

describe('a candidate is a person and a roster (#173)', () => {
  it('tells the same player from two rosters apart', () => {
    const a = { r: { id: 'liquid-2018' }, p: { id: 'twistzz' } };
    expect(sameCandidate(a, { r: { id: 'liquid-2018' }, p: { id: 'twistzz' } })).toBe(true);
    expect(sameCandidate(a, { r: { id: 'faze-2022' }, p: { id: 'twistzz' } })).toBe(false);
    expect(sameCandidate(a, null)).toBe(false);
    expect(sameCandidate(null, null)).toBe(false);
  });
});
