import { describe, expect, it } from 'vitest';
import { ROSTERS } from '../data/rosters';
import { COUNTRY } from '../game/synergy';
import { FLAG_CODES } from './flags';

describe('flags (#106)', () => {
  const used = [...new Set(ROSTERS.flatMap((r) => r.players.map((p) => p.country)))];
  it('has a drawn flag for every country in the data', () => {
    for (const c of used) expect(FLAG_CODES, c).toContain(c);
  });
  it('has a full name for every country in the data, since that is the flag\'s accessible name', () => {
    for (const c of used) expect(COUNTRY[c], c).toBeTruthy();
  });
  it('draws no flag for a country nobody plays from', () => {
    for (const c of FLAG_CODES) expect(used, c).toContain(c);
  });
});
