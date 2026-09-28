import { describe, expect, it } from 'vitest';
import { ROSTERS, ROLE_ORDER } from '../data/rosters';
import * as G from './logic';

const lineupOf = (i: number) => G.naturalLineup(ROSTERS[i]);
const fakeMatch = (stage: G.StageKey, won: boolean, opponentId = ROSTERS[0].id): G.Match =>
  ({ stage, won, opponentId, bestOf: G.BEST_OF[stage], maps: [], impact: {}, form: 0, pool: [], next: null, done: true, score: won ? [2, 0] : [0, 2] });

describe('seeded randomness', () => {
  it('replays the same sequence for the same seed', () => {
    const a = G.seeded('x', () => [G.random(), G.random(), G.rand(100)]);
    const b = G.seeded('x', () => [G.random(), G.random(), G.rand(100)]);
    const c = G.seeded('y', () => [G.random(), G.random(), G.rand(100)]);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
  it('restores the previous generator afterwards, even on error', () => {
    const inner = G.seeded('outer', () => { const v = G.seeded('inner', () => G.random()); return [v, G.random()]; });
    const plain = G.seeded('outer', () => G.random());
    expect(inner[1]).toBe(plain);
    expect(() => G.seeded('boom', () => { throw new Error('x'); })).toThrow();
    const x = G.random();
    expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1);
  });
  it('makes whole matches reproducible', () => {
    const run = () => G.seeded('match', () => G.playMatch('SF', lineupOf(0), ROSTERS[3].id));
    expect(run()).toEqual(run());
  });
});

describe('draft', () => {
  it('offers three distinct, eligible teams from three orgs that cover every open slot', () => {
    for (let i = 0; i < 200; i++) {
      G.seeded(`offer-${i}`, () => {
        const offer = G.makeOffer([], []);
        const rosters = offer.map((id) => G.rosterById.get(id)!);
        expect(new Set(offer).size).toBe(3);
        expect(new Set(rosters.map((r) => r.org)).size).toBe(3);
        const covered = new Set(rosters.flatMap((r) => r.players.flatMap((p) => G.eligibleSlots(p, []))));
        expect(ROLE_ORDER.every((s) => covered.has(s))).toBe(true);
      });
    }
  });
  it('never lets you draft a filled slot or the same person twice', () => {
    const r = ROSTERS[0], p = r.players[0];
    const picks: G.Pick[] = [{ slot: p.roles[0], rosterId: r.id, playerId: p.id }];
    expect(G.eligibleSlots(p, picks)).toEqual([]);
    for (const q of r.players.slice(1)) expect(G.eligibleSlots(q, picks)).not.toContain(p.roles[0]);
  });
  it('penalizes off-role picks', () => {
    const p = ROSTERS[0].players[0];
    const off = ROLE_ORDER.find((s) => !p.roles.includes(s))!;
    expect(G.fit(p, p.roles[0])).toBe(1);
    expect(G.fit(p, off)).toBeLessThan(G.fit(p, p.roles[0]));
  });
});

describe('draft review', () => {
  it('scores 100% when every pick was the best on the board', () => {
    let picks: G.Pick[] = [];
    G.seeded('review', () => {
      for (let i = 0; i < 5; i++) {
        const offer = G.makeOffer(picks, []);
        const best = offer.flatMap((id) => G.rosterById.get(id)!.players.flatMap((p) => G.eligibleSlots(p, picks).map((s) => ({ id, p, s }))))
          .sort((a, b) => G.pickValue(b.p, b.s) - G.pickValue(a.p, a.s))[0];
        picks = [...picks, { slot: best.s, rosterId: best.id, playerId: best.p.id, offer }];
      }
    });
    const { grade, rounds } = G.draftReview(picks);
    expect(grade).toBeCloseTo(1);
    expect(rounds).toHaveLength(5);
  });
  it('has no grade for picks made before offers were recorded', () => {
    const l = lineupOf(0);
    expect(G.draftReview(l.map((x) => ({ slot: x.slot, rosterId: x.roster.id, playerId: x.player.id }))).grade).toBeNull();
  });
});

describe('maps', () => {
  it('plays MR12 to 13, with MR3 overtime when it reaches 12–12', () => {
    for (let i = 0; i < 300; i++) {
      const g = G.seeded(`map-${i}`, () => G.playMatch('QUAL', lineupOf(1), ROSTERS[2].id)).maps[0];
      const [a, b] = g.score, hi = Math.max(a, b), lo = Math.min(a, b);
      expect(a + b).toBe(g.rounds.length);
      expect(g.won).toBe(a > b);
      if (lo < 12) { expect(hi).toBe(13); continue; }
      // overtime: first to 16, 19, ... and the loser is within the same three-round half
      expect(hi >= 16 && (hi - 16) % 3 === 0).toBe(true);
      expect(hi - lo).toBeGreaterThanOrEqual(1);
      expect(hi - lo).toBeLessThanOrEqual(4);
    }
  });
  it('plays a Bo3 until someone has two maps, on distinct maps', () => {
    for (let i = 0; i < 100; i++) {
      const m = G.seeded(`bo3-${i}`, () => G.playMatch('F', lineupOf(4), ROSTERS[7].id));
      const w = m.maps.filter((g) => g.won).length, l = m.maps.length - w;
      expect(Math.max(w, l)).toBe(2);
      expect(new Set(m.maps.map((g) => g.map)).size).toBe(m.maps.length);
      expect(m.won).toBe(w === 2);
    }
  });
});

describe('tournament', () => {
  it('goes qualification (2 wins) → QF → SF → F', () => {
    let t = G.newTournament();
    const path: (G.StageKey | null)[] = [];
    for (const won of [true, false, true, true, true, true]) { path.push(G.nextStage(t)); t = G.applyResult(t, fakeMatch(G.nextStage(t)!, won)); }
    expect(path).toEqual(['QUAL', 'QUAL', 'QUAL', 'QF', 'SF', 'F']);
    expect(t.status).toBe('champion');
    expect(G.nextStage(t)).toBeNull();
    expect(G.placement(t).key).toBe('CHAMP');
  });
  it('knocks you out after two qualification losses or any playoff loss', () => {
    let t = G.applyResult(G.applyResult(G.newTournament(), fakeMatch('QUAL', false)), fakeMatch('QUAL', false));
    expect(t.status).toBe('eliminated');
    expect(G.placement(t).key).toBe('QUAL');
    t = [true, true, true, false].reduce((acc, won) => G.applyResult(acc, fakeMatch(G.nextStage(acc)!, won)), G.newTournament());
    expect(G.placement(t).key).toBe('SF');
  });
  it('never picks an opponent that shares a player with your team, or a repeat opponent', () => {
    for (let i = 0; i < 200; i++) {
      G.seeded(`opp-${i}`, () => {
        const mine = ROLE_ORDER.map((slot, k) => { const r = ROSTERS[G.rand(ROSTERS.length)]; return { slot, roster: r, player: r.players[k] }; });
        const ids = new Set(mine.map((x) => x.player.id));
        let t = G.newTournament();
        for (const stage of ['QUAL', 'QUAL', 'QF', 'SF', 'F'] as G.StageKey[]) {
          const opp = G.rosterById.get(G.pickOpponent(t, stage, mine))!;
          expect(opp.players.some((p) => ids.has(p.id))).toBe(false);
          expect(t.used).not.toContain(opp.id);
          t = G.applyResult(t, fakeMatch(stage, true, opp.id));
        }
      });
    }
  });
});

describe('sides', () => {
  it('swaps at halftime, then every three rounds of overtime starting on the second-half sides', () => {
    const seq = Array.from({ length: 33 }, (_, i) => G.sideAt(i, 'T'));
    expect(seq.slice(0, 12).every((s) => s === 'T')).toBe(true);
    expect(seq.slice(12, 24).every((s) => s === 'CT')).toBe(true);
    expect(seq.slice(24, 27)).toEqual(['CT', 'CT', 'CT']);
    expect(seq.slice(27, 30)).toEqual(['T', 'T', 'T']);
    expect(seq.slice(30, 33)).toEqual(['CT', 'CT', 'CT']);
  });
  it('announces halftime at round 12 with the side you switch to', () => {
    const g = G.seeded('half', () => G.playMatch('QUAL', lineupOf(1), ROSTERS[2].id)).maps[0];
    const half = g.events.find((e) => e.kind === 'half' && e.round === 12)!;
    expect(half.text).toContain(`switch to ${G.otherSide(g.start)}`);
  });
  it('plays a series one map at a time, with a knife round before each', () => {
    G.seeded('series', () => {
      let m = G.startMatch('F', lineupOf(0), ROSTERS[9].id);
      expect(m.maps).toHaveLength(0);
      while (!m.done) {
        const k = m.next!;
        expect(G.MAPS).toContain(k.map);
        m = G.playNextMap(m, lineupOf(0), 'CT');
        expect(m.maps[m.maps.length - 1]).toMatchObject({ map: k.map, start: 'CT' });
      }
      expect(m.next).toBeNull();
      expect(G.playNextMap(m, lineupOf(0), 'T')).toBe(m);
    });
  });
  it('recommends the side that scores higher for you, and the opponent picks theirs the same way', () => {
    const us = lineupOf(0), them = lineupOf(5);
    for (let i = 0; i < 40; i++) {
      const k = G.seeded(`k-${i}`, () => G.startMatch('QUAL', us, ROSTERS[5].id).next!);
      const ours = G.sideScore(k.map, 'CT', us, them) >= G.sideScore(k.map, 'T', us, them) ? 'CT' : 'T';
      const theirs = G.sideScore(k.map, 'CT', them, us) >= G.sideScore(k.map, 'T', them, us) ? 'CT' : 'T';
      expect(k.best).toBe(ours);
      expect(k.oppPick).toBe(theirs);
      expect(G.sideAdvice(k, us)).toContain(k.map);
    }
  });
});
