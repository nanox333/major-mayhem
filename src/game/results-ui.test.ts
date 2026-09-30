import { describe, expect, it } from 'vitest';
import * as G from './logic';
import { teamReview } from './review';
import { ROSTERS } from '../data/rosters';

describe('result feedback shown by the redesigned UI', () => {
  it('does not attribute the opponent copy of a shared person to our team', () => {
    const map = { rounds: Array(24).fill(true), stats: { mine: [{ id: 'tarik', k: 12, d: 17, rating: .9 }], opp: [{ id: 'tarik', k: 18, d: 15, rating: 1.24 }] } } as G.MapGame;
    expect(G.seriesRatings([map], 'mine').tarik).toEqual({ k: 12, d: 17, rating: .9 });
    expect(G.seriesRatings([map], 'opp').tarik).toEqual({ k: 18, d: 15, rating: 1.24 });
  });
  it('includes an actual bench contributor without treating the bench as a sixth draft role', () => {
    const starters = G.naturalLineup(ROSTERS[0]);
    const bench = G.naturalLineup(ROSTERS.find(r => r.players.some(p => !starters.some(s => s.player.id === p.id)))!).find(x => !starters.some(s => s.player.id === x.player.id))!;
    const map = { map: 'Nuke', won: true, rounds: [true], stats: { mine: [...starters.map(x => ({ id: x.player.id, k: 1, d: 1, rating: .8 })), { id: bench.player.id, k: 3, d: 0, rating: 1.5 }], opp: [] } } as unknown as G.MapGame;
    const t = { ...G.newTournament(), matches: [{ maps: [map] } as G.Match] };
    const review = teamReview(starters, null, t, [...starters, bench]);
    expect(review.strongest?.nick).toBe(bench.player.nick);
    expect(review.roles.main + review.roles.secondary + review.roles.off).toBe(5);
  });
  it('distinguishes the same person in a worse role from their stronger placement', () => {
    const r = ROSTERS.find(r => r.id === 'teamldlccom-2014-dreamhackw')!;
    const p = r.players.find(p => p.id === 'shox')!;
    const review = G.draftReview([{ slot: 'LURK', rosterId: r.id, playerId: p.id, offer: [r.id] }]);
    expect(review.rounds[0].best?.player.id).toBe(p.id);
    expect(review.rounds[0].best?.slot).toBe('ENTRY');
    expect(review.rounds[0].value).toBeLessThan(review.rounds[0].best!.value);
    expect(review.grade).toBeLessThan(1);
  });
});
