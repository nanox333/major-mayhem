import { describe, expect, it } from 'vitest';
import { ROSTERS, ROLE_ORDER } from '../data/rosters';
import * as G from './logic';

const lineupOf = (i: number) => G.naturalLineup(ROSTERS[i]);
/** startMatch plus an automatic veto, so the first map is set up. */
const vetoed = (stage: G.StageKey, us: G.Lineup[], oppId: string) => {
  let m = G.startMatch(stage, us, oppId);
  const oppL = G.naturalLineup(G.rosterById.get(oppId)!);
  while (G.vetoTurn(m.veto)) m = G.applyVeto(m, us, G.vetoChoice(m.veto, 'us', us, oppL));
  return m;
};
const fakeMatch = (stage: G.StageKey, won: boolean, opponentId = ROSTERS[0].id): G.Match =>
  ({ stage, won, opponentId, bestOf: G.BEST_OF[stage], maps: [], impact: {}, form: 0, veto: { order: [], steps: [], left: [] }, pool: [], next: null, done: true, score: won ? [2, 0] : [0, 2] });

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
  it('goes Swiss (3 wins) → QF → SF → F', () => {
    let t = G.newTournament();
    const path: (G.StageKey | null)[] = [];
    for (const won of [true, false, true, false, true, true, true, true]) { path.push(G.nextStage(t)); t = G.applyResult(t, fakeMatch(G.nextStage(t)!, won)); }
    expect(path).toEqual(['QUAL', 'QUAL', 'QUAL', 'QUAL', 'QUAL', 'QF', 'SF', 'F']);
    expect(t.status).toBe('champion');
    expect(G.nextStage(t)).toBeNull();
    expect(G.placement(t).key).toBe('CHAMP');
  });
  it('knocks you out after three Swiss losses or any playoff loss', () => {
    let t = [false, false].reduce((acc, won) => G.applyResult(acc, fakeMatch('QUAL', won)), G.newTournament());
    expect(t.status).toBe('running');
    t = G.applyResult(t, fakeMatch('QUAL', false));
    expect(t.status).toBe('eliminated');
    expect(G.placement(t)).toMatchObject({ key: 'QUAL', label: 'Swiss Stage (0–3)' });
    t = [true, true, true, true, false].reduce((acc, won) => G.applyResult(acc, fakeMatch(G.nextStage(acc)!, won)), G.newTournament());
    expect(G.placement(t).key).toBe('SF');
  });
  it('plays Swiss matches that can send you through or out as Bo3, the rest as Bo1', () => {
    const at = (w: number, l: number): G.Tournament => ({ ...G.newTournament(), qual: { w, l, need: 3 } });
    expect([at(0, 0), at(1, 0), at(0, 1), at(1, 1)].map((t) => G.bestOfFor('QUAL', t))).toEqual([1, 1, 1, 1]);
    expect([at(2, 0), at(0, 2), at(2, 1), at(1, 2), at(2, 2)].map((t) => G.bestOfFor('QUAL', t))).toEqual([3, 3, 3, 3, 3]);
    expect(G.bestOfFor('QF', at(3, 0))).toBe(3);
  });
  it('keeps the old two-win qualification for runs saved before the Swiss stage', () => {
    const old: G.Tournament = { matches: [], qual: { w: 0, l: 0 }, status: 'running', used: [] };
    let t = [true, true].reduce((acc, won) => G.applyResult(acc, fakeMatch('QUAL', won)), old);
    expect(G.nextStage(t)).toBe('QF');
    expect(G.bestOfFor('QUAL', old)).toBe(1);
    t = [false, false].reduce((acc, won) => G.applyResult(acc, fakeMatch('QUAL', won)), old);
    expect(t.status).toBe('eliminated');
  });
  it('never picks an opponent that shares a player with your team, or a repeat opponent', () => {
    for (let i = 0; i < 200; i++) {
      G.seeded(`opp-${i}`, () => {
        const mine = ROLE_ORDER.map((slot, k) => { const r = ROSTERS[G.rand(ROSTERS.length)]; return { slot, roster: r, player: r.players[k] }; });
        const ids = new Set(mine.map((x) => x.player.id));
        let t = G.newTournament();
        for (const stage of ['QUAL', 'QUAL', 'QUAL', 'QF', 'SF', 'F'] as G.StageKey[]) {
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
      let m = vetoed('F', lineupOf(0), ROSTERS[9].id);
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
      const k = G.seeded(`k-${i}`, () => vetoed('QUAL', us, ROSTERS[5].id).next!);
      const ours = G.sideScore(k.map, 'CT', us, them) >= G.sideScore(k.map, 'T', us, them) ? 'CT' : 'T';
      const theirs = G.sideScore(k.map, 'CT', them, us) >= G.sideScore(k.map, 'T', them, us) ? 'CT' : 'T';
      expect(k.best).toBe(ours);
      expect(k.oppPick).toBe(theirs);
      expect(G.sideAdvice(k, us)).toContain(k.map);
    }
  });
});

describe('map veto', () => {
  const us = lineupOf(0), oppId = ROSTERS[9].id;
  it('Bo1: six alternating bans leave one map, decided by a knife round', () => {
    const m = G.seeded('veto1', () => vetoed('QUAL', us, oppId));
    expect(m.veto.steps.map((x) => `${x.team}:${x.action}`)).toEqual(['us:ban', 'them:ban', 'us:ban', 'them:ban', 'us:ban', 'them:ban']);
    expect(m.pool).toEqual(m.veto.left);
    expect(m.pool).toHaveLength(1);
    expect(m.next!.how).toBe('knife');
  });
  it('Bo3: ban, ban, pick, pick, ban, ban; the non-picker chooses sides and the decider gets a knife', () => {
    let m = G.seeded('veto3', () => vetoed('F', us, oppId));
    expect(m.veto.steps.map((x) => `${x.team}:${x.action}`)).toEqual(['us:ban', 'them:ban', 'us:pick', 'them:pick', 'us:ban', 'them:ban']);
    const picks = m.veto.steps.filter((x) => x.action === 'pick').map((x) => x.map);
    expect(m.pool).toEqual([...picks, m.veto.left[0]]);
    expect(new Set([...m.pool, ...m.veto.steps.map((x) => x.map)]).size).toBe(G.MAPS.length);
    expect(m.next).toMatchObject({ how: 'our-pick', won: false });
    G.seeded('veto3-play', () => {
      m = G.playNextMap(m, us, G.autoSide(m.next!));
      expect(m.next).toMatchObject({ how: 'their-pick', won: true });
      if (!m.done) { m = G.playNextMap(m, us, G.autoSide(m.next!)); if (!m.done) expect(m.next!.how).toBe('knife'); }
    });
  });
  it('explains comfort edges from the underlying values, and lists the maps to be played (#65)', () => {
    const us = lineupOf(0), them = lineupOf(7);
    for (const map of G.MAPS) {
      const e = G.comfortEdge(us, them, map);
      expect(e.diff).toBeCloseTo(G.comfort(us, map) - G.comfort(them, map));
      expect(e.who).toBe(Math.abs(e.diff) < G.EDGE_EVEN ? 'even' : e.diff > 0 ? 'us' : 'them');
    }
    let m = vetoed('SF', us, ROSTERS[7].id);
    expect(G.vetoTurn(m.veto)).toBeNull();
    const maps = G.vetoMaps(m.veto);
    expect(maps).toHaveLength(3);
    expect(maps.map((x) => x.by)).toEqual([...m.veto.steps.filter((s) => s.action === 'pick').map((s) => s.team), 'decider']);
    m = G.startMatch('SF', us, ROSTERS[7].id);
    expect(G.vetoNextTurn(m.veto)).toEqual(m.veto.order[1]);
  });
  it('ignores a ban out of turn or on a map that is gone', () => {
    const m = G.startMatch('QUAL', us, oppId);
    const after = G.applyVeto(m, us, 'Nuke');
    expect(G.applyVeto(after, us, 'Nuke')).toBe(after);
    expect(G.applyVeto(after, us, 'Atlantis')).toBe(after);
  });
  it('has the opponent ban the map that suits you most', () => {
    const oppL = G.naturalLineup(G.rosterById.get(oppId)!);
    const edge = (map: string) => G.comfort(us, map) - G.comfort(oppL, map);
    const m = G.applyVeto(G.startMatch('QUAL', us, oppId), us, 'Nuke');
    const left = G.MAPS.filter((x) => x !== 'Nuke');
    expect(m.veto.steps[1].map).toBe([...left].sort((a, b) => edge(b) - edge(a))[0]);
  });
});

describe('pistols and clutches', () => {
  it('marks rounds 1 and 13 as pistol rounds', () => {
    for (let i = 0; i < 20; i++) {
      const g = G.seeded(`pistol-${i}`, () => G.playMatch('QUAL', lineupOf(2), ROSTERS[6].id)).maps[0];
      const pistols = g.events.filter((e) => e.kind === 'pistol');
      expect(pistols.map((e) => e.round)).toEqual(g.rounds.length >= 13 ? [1, 13] : [1]);
      expect(pistols.every((e) => e.good === g.rounds[e.round - 1])).toBe(true);
    }
  });
  it('never lets a player die more than once per round, and kills always match the other side\'s deaths', () => {
    const w = [1, 2, 3, 4, 5];
    for (let i = 0; i < 400; i++) {
      const t = G.seeded(`tally-${i}`, () => G.tallyRound(i % 2 === 0, w, w, w, w, i % 3 === 0 ? i % 5 : undefined));
      for (const d of [...t.ourDeaths, ...t.theirDeaths]) expect(d).toBeLessThanOrEqual(1);
      const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
      expect(sum(t.ourKills)).toBe(sum(t.theirDeaths));
      expect(sum(t.theirKills)).toBe(sum(t.ourDeaths));
      // the winner keeps someone alive
      expect(sum(i % 2 === 0 ? t.ourDeaths : t.theirDeaths)).toBeLessThan(5);
    }
  });
  it('leaves the clutcher as the only survivor, with the last kills', () => {
    const w = [1, 1, 1, 1, 1];
    for (let i = 0; i < 100; i++) {
      const who = i % 5, vs = 2 + (i % 3);
      const t = G.seeded(`clutch-${i}`, () => G.tallyRound(true, w, w, w, w, who, { who, vs }));
      expect(t.ourDeaths).toEqual([0, 1, 2, 3, 4].map((j) => (j === who ? 0 : 1)));
      expect(t.theirDeaths).toEqual([1, 1, 1, 1, 1]);
      expect(t.ourKills[who]).toBeGreaterThanOrEqual(vs);
    }
  });
  it('keeps whole-map scoreboards possible: deaths per player never exceed rounds played', () => {
    for (let i = 0; i < 80; i++) {
      const m = G.seeded(`board-${i}`, () => G.playMatch('F', lineupOf(i % 10), ROSTERS[(i + 5) % 20].id));
      for (const g of m.maps) {
        const r = g.rounds.length;
        for (const s of [...g.stats.mine, ...g.stats.opp]) expect(s.d).toBeLessThanOrEqual(r);
        const total = (l: { k: number; d: number }[], f: 'k' | 'd') => l.reduce((x, s) => x + s[f], 0);
        expect(total(g.stats.mine, 'k')).toBe(total(g.stats.opp, 'd'));
        expect(total(g.stats.opp, 'k')).toBe(total(g.stats.mine, 'd'));
      }
    }
  });
  it('never narrates a buy the player did not make (#15)', () => {
    for (let i = 0; i < 60; i++) {
      const m = G.seeded(`narr-${i}`, () => G.playMatch('F', lineupOf(i % 10), ROSTERS[(i + 3) % 20].id));
      for (const g of m.maps) for (const e of g.events) {
        expect(e.text).not.toMatch(/You're saving/);
        // no calls were made, so your side never forces
        if (e.mine) expect(e.text).not.toMatch(/force buy/);
      }
    }
    const lines = ['{p} deagles two on the force buy', '{t} win the force buy through {s}', '{p} wins the round with a gutsy anti-eco call', '{p} holds {s}'];
    expect(G.fitting(lines, { ourForce: false, theirEco: false })).toEqual(['{p} holds {s}']);
    expect(G.fitting(lines, { ourForce: true, theirEco: false })).toEqual(['{p} deagles two on the force buy', '{p} holds {s}']);
    expect(G.fitting(lines, { ourForce: false, theirEco: true })).toEqual(lines.slice(1));
  });
  it('credits clutches to one of your players in a round you won', () => {
    const clutches = Array.from({ length: 60 }, (_, i) => G.seeded(`c-${i}`, () => G.playMatch('F', lineupOf(3), ROSTERS[8].id)))
      .flatMap((m) => m.maps.flatMap((g) => g.events.filter((e) => e.kind === 'clutch').map((e) => ({ e, g }))));
    expect(clutches.length).toBeGreaterThan(0);
    for (const { e, g } of clutches) {
      expect(g.rounds[e.round - 1]).toBe(true);
      expect(lineupOf(3).map((x) => x.player.id)).toContain(e.playerId);
    }
  });
});
