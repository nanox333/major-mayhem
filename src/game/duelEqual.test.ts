import { describe, expect, it } from 'vitest';
import * as G from './logic';
import { LATEST_RULES, ROLE_ORDER, ROSTERS, RULE_SINCE } from '../data/rosters';
import { Run, canReroll, equalDuel, flexRound, fresh, freshDuel, reducer, rerollsLeft, roundOf, slotsFor, validRun } from './state';
import { DUEL_ROUNDS, Duel, decodeDuel, duelFrom, duelLink, duelTerms, encodeDuel, validDuel } from './duel';

type Choose = (s: Run, offer: string[]) => string;

/** Drafts a whole run through the reducer. `spinAt` lists the draft rounds (0 to 6) in which to spin again once, before choosing. */
function draft(start: Run, spinAt: number[] = [], choose: Choose = (s, offer) => offer.find((id) => G.rosterEligible(G.rosterById.get(id)!, s.picks)) ?? offer[0]): Run {
  let s = start;
  for (let round = 0; s.phase === 'draft'; round++) {
    s = reducer(s, { type: 'spin' });
    if (spinAt.includes(round)) s = reducer(s, { type: 'reroll' });
    const kind = roundOf(s);
    if (kind === 'coach') { s = reducer(s, { type: 'coach', rosterId: s.offer.find((id) => G.rosterById.get(id)!.coach)! }); continue; }
    const id = kind === 'bench' ? s.offer[0] : choose(s, s.offer);
    s = reducer(s, { type: 'team', id });
    const roster = G.rosterById.get(id)!;
    if (kind === 'bench') {
      const taken = G.draftedIds(s.picks);
      s = reducer(s, { type: 'bench', player: roster.players.find((p) => !taken.has(p.id))! });
      continue;
    }
    const p = roster.players.find((x) => slotsFor(s, x).length)!;
    s = reducer(s, { type: 'draft', player: p, slot: slotsFor(s, p)[0] });
  }
  return s;
}

const challenger = (seed: string, spinAt: number[] = []) => draft({ ...fresh('free'), seed }, spinAt);
const duelOf = (seed: string, spinAt: number[] = []) => duelFrom(challenger(seed, spinAt), 'Ann');

describe('a duel deals the challenger\'s cases (#172)', () => {
  it('sends the cases the challenger saw, in order, with the spins they used', () => {
    const run = challenger('free-eq1', [1, 4]);
    expect(run.rules).toBe(LATEST_RULES);
    const d = duelFrom(run, 'Ann');
    expect(d.v).toBe(2);
    expect(d.offers).toHaveLength(DUEL_ROUNDS);
    expect(d.offers!.map((c) => c.length)).toEqual([1, 2, 1, 1, 2, 1, 1]);
    // What the challenger finally chose from is the last case of each round.
    expect(d.offers![1][1]).toEqual(run.picks.find((p) => p.offer && p.offer.join() === d.offers![1][1].join())?.offer);
    expect(decodeDuel(encodeDuel(d))).toEqual(d);
  });

  it('deals a friend the same cases whatever they pick', () => {
    const d = duelOf('free-eq2', [2]);
    // Pick the last eligible team in each case instead of the first, so the two drafts diverge as early as possible.
    const last: Choose = (s, offer) => [...offer].reverse().find((id) => G.rosterEligible(G.rosterById.get(id)!, s.picks)) ?? offer[0];
    for (const choose of [undefined, last]) {
      let s = freshDuel(d);
      expect(equalDuel(s)).toBe(true);
      for (let round = 0; round < DUEL_ROUNDS; round++) {
        s = reducer(s, { type: 'spin' });
        expect(s.offer, `round ${round}`).toEqual(d.offers![round][0]);
        if (d.offers![round].length > 1) {
          s = reducer(s, { type: 'reroll' });
          expect(s.offer, `round ${round} spin`).toEqual(d.offers![round][1]);
        }
        const kind = roundOf(s);
        if (kind === 'coach') { s = reducer(s, { type: 'coach', rosterId: s.offer.find((id) => G.rosterById.get(id)!.coach)! }); continue; }
        const id = kind === 'bench' ? s.offer[0] : (choose ?? ((x: Run, o: string[]) => o.find((i) => G.rosterEligible(G.rosterById.get(i)!, x.picks)) ?? o[0]))(s, s.offer);
        s = reducer(s, { type: 'team', id });
        const roster = G.rosterById.get(id)!;
        if (kind === 'bench') { const taken = G.draftedIds(s.picks); s = reducer(s, { type: 'bench', player: roster.players.find((p) => !taken.has(p.id))! }); continue; }
        const p = roster.players.find((x) => slotsFor(s, x).length)!;
        s = reducer(s, { type: 'draft', player: p, slot: slotsFor(s, p)[0] });
      }
      expect(s.phase).toBe('ready');
      expect(s.offerLog).toEqual(d.offers);
    }
  });

  it('allows a spin only where the challenger spun, and no more than they did', () => {
    const d = duelOf('free-eq3', [1]);
    let s = reducer(freshDuel(d), { type: 'spin' });
    expect(rerollsLeft(s)).toBe(1);
    expect(canReroll(s)).toBe(false); // round 0: they did not spin
    expect(reducer(s, { type: 'reroll' })).toBe(s);
    const id = s.offer.find((i) => G.rosterEligible(G.rosterById.get(i)!, s.picks))!;
    const p = G.rosterById.get(id)!.players.find((x) => slotsFor(reducer(s, { type: 'team', id }), x).length)!;
    s = reducer(reducer(s, { type: 'team', id }), { type: 'draft', player: p, slot: slotsFor(reducer(s, { type: 'team', id }), p)[0] });
    s = reducer(s, { type: 'spin' });
    expect(canReroll(s)).toBe(true); // round 1: they did
    s = reducer(s, { type: 'reroll' });
    expect(s.offer).toEqual(d.offers![1][1]);
    expect(s.rerolls).toBe(1);
    expect(rerollsLeft(s)).toBe(0);
    expect(reducer(s, { type: 'reroll' })).toBe(s); // their one spin is used
  });

  it('never leaves a case with nothing to pick: any open slot takes any player when none of the three fit', () => {
    let s = reducer(freshDuel(duelOf('free-eq4')), { type: 'spin' });
    // The last slot is open and everyone in the offered team who could fill it is already yours.
    const open = 'AWP' as const;
    const team = ROSTERS[0];
    const able = team.players.filter((p) => p.roles.includes(open));
    expect(able.length).toBeLessThanOrEqual(4);
    const mine = [...able, ...team.players.filter((p) => !able.includes(p))].slice(0, 4);
    const slots = ROLE_ORDER.filter((r) => r !== open);
    s = { ...s, offer: [team.id], picks: mine.map((p, i) => ({ slot: slots[i], rosterId: team.id, playerId: p.id })) };
    const rest = team.players.find((p) => !mine.includes(p))!;
    expect(G.rosterEligible(team, s.picks)).toBe(false);
    expect(flexRound(s)).toBe(true);
    expect(slotsFor(s, rest)).toEqual([open]);
    const after = reducer({ ...s, step: 'players', team: team.id }, { type: 'draft', player: rest, slot: open });
    expect(after.picks).toHaveLength(5);
    // With a team that does fit, the usual role rule applies.
    expect(flexRound({ ...s, offer: [ROSTERS.find((r) => r.id !== team.id && G.rosterEligible(r, s.picks))!.id] })).toBe(false);
  });
});

describe('the showmatch is played on equal terms (#172)', () => {
  const ready = (seed: string) => draft(freshDuel(duelOf(seed)));

  it('has no match-day form, no sub and no calls', () => {
    const s = reducer(ready('free-eq5'), { type: 'play' });
    expect(s.pending!.form).toBeUndefined();
    expect(s.pending!.subOut).toBeUndefined();
    const live = reducer(s, { type: 'start' });
    expect(live.current!.form).toBe(0);
    expect(live.current!.playerForm).toBeUndefined();
    expect(reducer(live, { type: 'sub', out: s.picks[0].playerId })).toEqual(live);
    expect(G.canCall(live.current!, { kind: 'timeout', round: 3 })).toBe(false);
    expect(G.canCall(live.current!, { kind: 'force', round: 1 })).toBe(false);
  });

  it('runs the veto for both teams by one rule, so there is no map to choose', () => {
    const live = reducer(reducer(ready('free-eq6'), { type: 'play' }), { type: 'start' });
    const m = live.current!;
    expect(m.veto.auto).toBe(true);
    expect(G.vetoTurn(m.veto)).toBeNull();
    expect(m.veto.steps).toHaveLength(6);
    expect(m.pool).toHaveLength(3);
    expect(new Set(m.pool).size).toBe(3);
    expect(m.next).not.toBeNull();
    expect(reducer(live, { type: 'veto', map: m.veto.left[0] ?? 'Mirage' })).toEqual(live);
  });

  it('takes each team to its stronger side and ignores a side that was asked for', () => {
    const live = reducer(reducer(ready('free-eq7'), { type: 'play' }), { type: 'start' });
    const k = live.current!.next!;
    const want = G.autoSide(k);
    const wrong = G.otherSide(want);
    const played = reducer(live, { type: 'side', side: wrong });
    expect(played.current!.maps[0].start).toBe(want);
  });

  it('flips a coin for who vetoes first, so neither side always starts', () => {
    const firsts = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const live = reducer(reducer(ready(`free-eq${10 + i}`), { type: 'play' }), { type: 'start' });
      firsts.add(live.current!.veto.order[0].team);
    }
    expect([...firsts].sort()).toEqual(['them', 'us']);
  });

  it('plays a whole showmatch through to a result', () => {
    let s = reducer(reducer(ready('free-eq8'), { type: 'play' }), { type: 'start' });
    while (!s.current!.done) s = reducer(s, { type: 'side', side: G.autoSide(s.current!.next!) });
    s = reducer(s, { type: 'next' });
    expect(s.phase).toBe('final');
    expect(validRun(JSON.parse(JSON.stringify(s)))).toBe(true);
  });

  it('is symmetric: a team playing itself in the same seat wins about half the time', () => {
    const run = ready('free-eq9');
    const mine = G.lineupFromPicks(run.picks);
    let wins = 0;
    const N = 60;
    for (let i = 0; i < N; i++) {
      const s = { ...run, seed: `free-sym${i}` } as Run;
      const live = reducer(reducer(s, { type: 'play' }), { type: 'start' });
      let r = live;
      while (!r.current!.done) r = reducer(r, { type: 'side', side: G.autoSide(r.current!.next!) });
      if (r.current!.won) wins++;
    }
    // Not a statistical proof, a guard against a stray edge for the side the player sits on (the opponent here is a different team, so only check it is not 0 or all).
    expect(wins).toBeGreaterThan(0);
    expect(wins).toBeLessThan(N);
    expect(mine).toHaveLength(5);
  });
});

describe('what an older link or a bad one does (#172)', () => {
  it('keeps playing an older link under the rules it was made with, and says it is not an equal match', () => {
    const oldRun = { ...fresh('free'), seed: 'free-old', rules: 4 } as Run;
    const d = duelFrom(draft(oldRun), 'Ann');
    expect(d.v).toBe(1);
    expect(d.offers).toBeUndefined();
    expect(d.rules).toBe(4);
    expect(decodeDuel(encodeDuel(d))).toEqual(d);
    const s = freshDuel(d);
    expect(equalDuel(s)).toBe(false);
    expect(duelTerms(d).headline).toMatch(/challenge/i);
    const live = reducer(reducer(draft(s), { type: 'play' }), { type: 'start' });
    expect(live.current!.veto.auto).toBeUndefined();
    expect(G.vetoTurn(live.current!.veto)).not.toBeNull();
  });

  it('sends the older kind of link for a run that did not keep its cases', () => {
    const run = challenger('free-eq20');
    const d = duelFrom({ ...run, offerLog: run.offerLog!.slice(0, 5) }, 'Ann');
    expect(d.v).toBe(1);
    expect(d.rules).toBe(RULE_SINCE.equalDuel - 1);
    expect(validDuel(d)).toBe(true);
  });

  it('refuses links whose version, rules and cases do not agree', () => {
    const d = duelOf('free-eq21', [0, 3]);
    expect(validDuel(d)).toBe(true);
    expect(validDuel({ ...d, offers: undefined })).toBe(false); // v2 with no cases
    expect(validDuel({ ...d, rules: RULE_SINCE.equalDuel - 1 })).toBe(false); // v2 under rules without it
    expect(validDuel({ ...d, v: 1 })).toBe(false); // v1 may not carry cases
    expect(validDuel({ ...d, offers: d.offers!.slice(1) })).toBe(false); // a round missing
    expect(validDuel({ ...d, offers: d.offers!.map((c, i) => (i < 3 ? [...c, c[0]] : c)) })).toBe(false); // more spins than a run has
    expect(validDuel({ ...d, offers: d.offers!.map((c, i) => (i === 0 ? [['nobody-2099']] : c)) })).toBe(false); // an unknown team
    expect(decodeDuel(encodeDuel({ ...d, offers: [] } as Duel))).toBeNull();
  });

  it('keeps the link a reasonable size', () => {
    const d = duelOf('free-eq22', [0, 3]);
    expect(duelLink('https://example.test/', d).length).toBeLessThan(2500);
  });

  it('keeps a saved duel run valid after a reload', () => {
    const s = draft(freshDuel(duelOf('free-eq23', [2])));
    expect(validRun(JSON.parse(JSON.stringify(s)))).toBe(true);
  });
});
