import { describe, expect, it } from 'vitest';
import { ROSTERS } from '../data/rosters';
import * as G from './logic';
import { debugHooks } from './debugHooks';

const lineupOf = (i: number) => G.naturalLineup(ROSTERS[i]);
const maps = (n: number, rules: number) => G.withRules(rules, () => Array.from({ length: n }, (_, i) =>
  G.seeded(`legend-${i}`, () => G.playMatch('QUAL', lineupOf(i % 20), ROSTERS[(i * 7 + 3) % ROSTERS.length].id, 1)).maps[0]));
const legends = (g: G.MapGame) => g.events.filter((e) => e.kind === 'legend');

describe('legendary moments (#292, #295)', () => {
  const sample = maps(1600, 6);
  const found = sample.flatMap((g) => legends(g).map((e) => ({ g, e })));

  it('are very rare: about one map in 10 to 45', () => {
    const withOne = sample.filter((g) => legends(g).length > 0).length;
    expect(withOne / sample.length).toBeGreaterThan(1 / 45);
    expect(withOne / sample.length).toBeLessThan(1 / 10);
  });
  it('only ever happen in rounds you won, and are good for you', () => {
    expect(found.length).toBeGreaterThan(0);
    for (const { g, e } of found) {
      expect(e.good && e.mine).toBe(true);
      expect(g.rounds[e.round - 1]).toBe(true);
      expect(g.won || e.legend !== 'miracle').toBe(true);
    }
  });
  it('give an ace or a 1v5 to one of your players, who takes five kills in the map', () => {
    for (const { g, e } of found.filter((f) => f.e.legend === 'ace' || f.e.legend === 'clutch5')) {
      const who = g.stats.mine.find((p) => p.id === e.playerId);
      expect(who, e.text).toBeDefined();
      expect(who!.k).toBeGreaterThanOrEqual(5);
    }
  });
  it('include both rolled kinds across a large sample, with aces more common than 1v5s', () => {
    const count = (k: G.LegendKind) => found.filter((f) => f.e.legend === k).length;
    expect(count('ace')).toBeGreaterThan(count('clutch5'));
    expect(count('ace') + count('clutch5')).toBeGreaterThan(0);
  });
  it('do not exist before rules v6, so older runs and dailies play exactly as they did', () => {
    for (const g of maps(300, 5)) expect(legends(g)).toEqual([]);
  });
  it('are only a flavour of a round that was going to be won: they never change who won it', () => {
    // the same seed on v5 and v6 differs only through the extra rolls, so compare rates, not rounds
    const v5 = maps(400, 5).filter((g) => g.won).length / 400, v6 = maps(400, 6).filter((g) => g.won).length / 400;
    expect(Math.abs(v5 - v6)).toBeLessThan(0.12);
  });
  it('can be forced once by the debug hook, and the hook is clear afterwards', () => {
    expect(debugHooks.legend).toBeNull();
    debugHooks.legend = 'ace';
    const g = G.withRules(6, () => G.seeded('forced', () => G.playMatch('QUAL', lineupOf(2), ROSTERS[9].id, 1)).maps[0]);
    expect(legends(g).some((e) => e.legend === 'ace')).toBe(true);
    expect(debugHooks.legend).toBeNull();
  });
});

describe('legendary moments in the record (#294)', () => {
  const run = (kinds: G.LegendKind[]) => ({ t: { matches: [{ maps: [{ events: kinds.map((legend, i) => ({ round: i + 1, text: 'x', mine: true, good: true, kind: 'legend', legend })) }] }] } }) as unknown as import('./state').Run;
  it('counts the moments in a run and earns the matching achievements', async () => {
    const { legendsOf, ACHIEVEMENTS } = await import('./achievements');
    const earned = (legends: Partial<Record<G.LegendKind, number>>) => ACHIEVEMENTS.filter((a) => ['witness', 'ace', 'one-v-five', 'collector'].includes(a.id) && a.test(run([]), { streak: 0, dailyStreak: 0, legends })).map((a) => a.id);
    expect(legendsOf(run(['ace', 'clutch5'])).length).toBe(2);
    expect(earned({ ace: 1 })).toEqual(['witness', 'ace']);
    expect(earned({})).toEqual([]);
    expect(earned({ ace: 2, clutch5: 1, flawless: 1, miracle: 1 })).toEqual(['witness', 'ace', 'one-v-five', 'collector']);
  });
  it('keeps the collection through a save and drops junk', async () => {
    const { sanitizeStats } = await import('./stats');
    const s = sanitizeStats({ v: 1, legends: { ace: 3, clutch5: -2, junk: 9, miracle: 'x' } });
    expect(s.legends).toEqual({ ace: 3 });
    expect(sanitizeStats({ v: 1 }).legends).toBeUndefined();
  });
});
