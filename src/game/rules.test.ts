import { describe, expect, it } from 'vitest';
import { LATEST_RULES, ROSTERS, RULES, rulesOn } from '../data/rosters';
import * as G from './logic';
import { decodeDuel, duelFrom, encodeDuel } from './duel';
import { fresh, reducer, validRun } from './state';
import { fingerprints } from '../../scripts/rules-fingerprint';

describe('rules versions (#24)', () => {
  it('replays rules v1 exactly as the launch code (afeb745) played it', () => {
    // Recorded by running scripts/rules-fingerprint.ts on the launch commit. If this fails, a change reached v1:
    // put it behind `rules() >= 2` (or a new version) instead of updating these values.
    expect(fingerprints(1)).toEqual({
      runs: {
        'daily 2026-09-28': 'c33f075b', 'daily 2026-09-29': 'b8787ff3',
        'free a': 'ddcfb951', 'free b': '292004f3', 'free c': 'f54b6a94', 'free d': '28c17bfa',
      },
      lineups: 'fa35ca9c',
      guesses: 'f539f431',
    });
  });
  it('gives each daily the rules of its date, and new free runs the latest', () => {
    expect(rulesOn('2026-09-28')).toBe(1);
    expect(rulesOn('2026-09-29')).toBe(1);
    expect(rulesOn('2026-09-30')).toBe(2);
    expect(rulesOn('2027-01-01')).toBe(LATEST_RULES);
    expect(fresh('daily', '2026-09-29').rules).toBe(1);
    expect(fresh('daily', '2026-09-30').rules).toBe(2);
    expect(fresh('free').rules).toBe(LATEST_RULES);
    expect(RULES.every((r, i) => i === 0 || r.from > RULES[i - 1].from)).toBe(true);
  });
  it('treats saves from before versions existed as v1, and rejects unknown versions', () => {
    const { rules: _, ...old } = fresh('daily', '2026-09-29');
    expect(validRun(old)).toBe(true);
    expect(validRun({ ...old, rules: LATEST_RULES + 1 })).toBe(false);
    reducer(old, { type: 'spin' });
    expect(G.rules()).toBe(1);
    reducer(fresh('free'), { type: 'spin' });
    expect(G.rules()).toBe(LATEST_RULES);
  });
  it('switches corrected roles and coaches with the rules, and puts them back', () => {
    const liquid = ROSTERS.find((r) => r.org === 'Team Liquid' && r.year === 2024)!;
    const vitality = ROSTERS.find((r) => r.org === 'Team Vitality' && r.year === 2023)!;
    const twistzz = liquid.players.find((p) => p.nick === 'Twistzz')!;
    G.withRules(1, () => {
      expect(twistzz.roles[0]).toBe('ENTRY');
      expect(vitality.coach).toBe('XTQZZZ');
      expect(G.naturalLineup(liquid).find((x) => x.slot === 'IGL')!.player.nick).toBe('jks');
    });
    G.withRules(2, () => {
      expect(twistzz.roles[0]).toBe('IGL');
      expect(vitality.coach).toBe('zonic');
      expect(G.naturalLineup(liquid).find((x) => x.slot === 'IGL')!.player.nick).toBe('Twistzz');
    });
  });
  it('carries the challenger\'s rules in a duel link', () => {
    const picks = G.naturalLineup(ROSTERS[0]).map((x) => ({ slot: x.slot, rosterId: x.roster.id, playerId: x.player.id }));
    const d = duelFrom({ ...fresh('free'), rules: 1, picks }, 'x');
    expect(d.rules).toBe(1);
    expect(decodeDuel(encodeDuel(d))!.rules).toBe(1);
    expect(decodeDuel(encodeDuel({ ...d, rules: 99 }))).toBeNull();
  });
});
