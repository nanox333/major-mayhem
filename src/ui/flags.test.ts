import { describe, expect, it } from 'vitest';
import { ROSTERS } from '../data/rosters';
import { COUNTRY } from '../game/synergy';
import { FLAG_CODES } from './flags';

describe('flags (#106)', () => {
  it('has a flag for every country a player in the data is from', () => {
    const used = new Set(ROSTERS.flatMap((r) => r.players.map((p) => p.country)));
    expect([...used].filter((c) => !FLAG_CODES.includes(c))).toEqual([]);
  });
  it('names every country it draws', () => {
    expect(FLAG_CODES.filter((c) => !COUNTRY[c])).toEqual([]);
  });
});
