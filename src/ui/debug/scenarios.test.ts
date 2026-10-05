import { describe, expect, it } from 'vitest';
import { validRun } from '../../game/state';
import { SCENARIOS, gameOf } from './scenarios';

// Rare things (a miracle comeback, a 13–0, a legendary run) may legitimately not turn up within the search budget, so they are only checked when found.
const RARE = new Set(['live-comeback', 'live-stomp', 'results-legend']);

describe('debug scenarios (#296)', () => {
  it('has unique ids and titles', () => {
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
  });
  for (const sc of SCENARIOS) {
    it(`builds a valid run: ${sc.title}`, () => {
      const b = sc.build();
      if (!b) { expect(RARE.has(sc.id), `${sc.id} should have been found`).toBe(true); return; }
      expect(validRun(b.run)).toBe(true);
      if (b.seen) {
        const g = gameOf(b.run);
        expect(g, 'a live scenario has a map').toBeDefined();
        expect(b.seen.n).toBeGreaterThanOrEqual(0);
        expect(b.seen.n).toBeLessThanOrEqual(g!.rounds.length);
      }
    }, 60000);
  }
});
