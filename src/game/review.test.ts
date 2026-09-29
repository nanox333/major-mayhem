import { describe, expect, it } from 'vitest';
import { ROSTERS } from '../data/rosters';
import * as G from './logic';
import { teamReview } from './review';

const run = (lineup: G.Lineup[], seed: string) => G.seeded(seed, () => {
  let t = G.newTournament();
  while (t.status === 'running') {
    const stage = G.nextStage(t)!;
    t = G.applyResult(t, G.playMatch(stage, lineup, G.pickOpponent(t, stage, lineup), G.bestOfFor(stage, t)));
  }
  return t;
});

describe('team review (#18)', () => {
  it('counts roles, maps and calls from the run, and always has one suggestion', () => {
    const lineup = G.naturalLineup(ROSTERS[0]);
    const t = run(lineup, 'review-1');
    const r = teamReview(lineup, ROSTERS[0].coach, t);
    expect(r.roles.main + r.roles.secondary + r.roles.off).toBe(5);
    const games = t.matches.flatMap((m) => m.maps);
    expect(r.maps.won + r.maps.lost).toBe(games.length);
    expect(r.maps.won).toBe(games.filter((g) => g.won).length);
    expect(r.suggestion.length).toBeGreaterThan(10);
    expect(r.strongest!.rating).toBeGreaterThanOrEqual(r.weakest!.rating);
  });
  it('suggests fixing off-role picks first', () => {
    const base = G.naturalLineup(ROSTERS[0]);
    // swap the AWPer and the IGL: at least one of them is now off-role
    const swapped = base.map((x) => (x.slot === 'AWP' ? { ...x, slot: 'IGL' as const } : x.slot === 'IGL' ? { ...x, slot: 'AWP' as const } : x));
    const r = teamReview(swapped, null, run(swapped, 'review-2'));
    expect(r.roles.off + r.roles.secondary).toBeGreaterThan(0);
    if (r.roles.off > 0) expect(r.suggestion).toMatch(/role they play/);
  });
});
