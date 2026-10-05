import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LATEST_RULES, ROSTERS, RULES, RULE_SINCE, rulesInclude, rulesOn } from '../data/rosters';
import * as G from './logic';
import { decodeDuel, duelFrom, encodeDuel } from './duel';
import { fresh, reducer, validRun } from './state';
import { fingerprints } from '../../scripts/rules-fingerprint';

/**
 * Fingerprints of every rules version that a newer one has replaced, recorded from the code that shipped it. Adding a version to RULES fails the
 * "is pinned" test below until the one it replaces is recorded here (run `npx tsx scripts/rules-fingerprint.ts` with the old version's code).
 * If a pinned version stops matching, a change reached an old version: put it behind a new `RULE_SINCE` switch instead of updating these values.
 */
const PINNED: Record<number, ReturnType<typeof fingerprints>> = {
  // Recorded by running scripts/rules-fingerprint.ts on the launch commit (afeb745).
  1: {
    runs: {
      'daily 2026-09-28': 'c33f075b', 'daily 2026-09-29': 'b8787ff3',
      'free a': 'ddcfb951', 'free b': '292004f3', 'free c': 'f54b6a94', 'free d': '28c17bfa',
    },
    lineups: 'fa35ca9c',
    guesses: '62577e7b',
  },
  // Recorded from the code at the end of v2 (before #167): the dailies of 28 to 30 September and four free seeds under v2.
  2: {
    runs: {
      'daily 2026-09-28': 'c33f075b', 'daily 2026-09-29': 'b8787ff3', 'daily 2026-09-30': '9d5d95e0',
      'free a': '2e496025', 'free b': '71bfafaf', 'free c': 'f0c0cc7', 'free d': '2f593148',
    },
    lineups: '383254de',
    guesses: '62577e7b',
  },
  // Recorded from the code at the end of v3 (before the stronger timeout).
  3: {
    runs: {
      'daily 2026-09-28': 'c33f075b', 'daily 2026-09-29': 'b8787ff3', 'daily 2026-09-30': '9d5d95e0',
      'free a': '2e496025', 'free b': '71bfafaf', 'free c': 'f0c0cc7', 'free d': '2f593148',
    },
    lineups: '383254de',
    guesses: '62577e7b',
  },
  // Recorded from the code at the end of v4 (before equal-conditions duels).
  4: {
    runs: {
      'daily 2026-09-28': 'c33f075b', 'daily 2026-09-29': 'b8787ff3', 'daily 2026-09-30': '9d5d95e0',
      'free a': '6fd8bbeb', 'free b': '71bfafaf', 'free c': 'cb7f95', 'free d': '3e0d449c',
    },
    lineups: '383254de',
    guesses: '62577e7b',
  },
  // Recorded from the code at the end of v5 (before legendary moments).
  5: {
    runs: {
      'daily 2026-09-28': 'c33f075b', 'daily 2026-09-29': 'b8787ff3', 'daily 2026-09-30': '9d5d95e0',
      'free a': '6fd8bbeb', 'free b': '71bfafaf', 'free c': 'cb7f95', 'free d': '3e0d449c',
    },
    lineups: '383254de',
    guesses: '62577e7b',
  },
};

describe('rules versions (#24)', () => {
  it('pins the fingerprints of every version a newer one has replaced', () => {
    const replaced: number[] = RULES.filter((r) => r.v < LATEST_RULES).map((r) => r.v);
    expect(replaced.filter((v) => !PINNED[v]), 'add the old version\'s fingerprints to PINNED before adding a new one').toEqual([]);
    expect(Object.keys(PINNED).map(Number).filter((v) => !replaced.includes(v))).toEqual([]);
  });
  it('replays rules v1 exactly as the launch code (afeb745) played it', () => {
    expect(fingerprints(1)).toEqual(PINNED[1]);
  });
  it('replays rules v2 as it was when v3 was added', () => {
    expect(fingerprints(2)).toEqual(PINNED[2]);
  });
  it('replays rules v3 as it was when v4 was added', () => {
    expect(fingerprints(3)).toEqual(PINNED[3]);
  });
  it('replays rules v4 as it was when v5 was added', () => {
    expect(fingerprints(4)).toEqual(PINNED[4]);
  });
  it('replays rules v5 as it was when v6 was added', () => {
    expect(fingerprints(5)).toEqual(PINNED[5]);
  });
  it('names every behaviour switch after a version that exists', () => {
    const versions = RULES.map((r) => r.v as number);
    for (const [name, since] of Object.entries(RULE_SINCE)) expect(versions, name).toContain(since);
    expect(rulesInclude(1, 'oneDeathPerRound')).toBe(false);
    expect(rulesInclude(2, 'oneDeathPerRound')).toBe(true);
    expect(rulesInclude(2, 'cleanOpponentPool')).toBe(false);
    expect(rulesInclude(3, 'cleanOpponentPool')).toBe(true);
    expect(G.withRules(1, () => G.hasRule('cleanOpponentPool'))).toBe(false);
    expect(G.withRules(LATEST_RULES, () => G.hasRule('cleanOpponentPool'))).toBe(true);
  });
  it('keeps version numbers out of the code: behaviour is read through hasRule', () => {
    // A bare `rules() < 2` says nothing about what it switches and is easy to get wrong when a version is added.
    const dir = fileURLToPath(new URL('.', import.meta.url));
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    const bare = /\b(rules\(\)|activeRules)\s*(<=|>=|<|>|===|!==)/;
    const offenders = files.filter((f) => readFileSync(dir + f, 'utf8').split('\n').some((l) => bare.test(l.replace(/\/\/.*$/, ''))));
    expect(offenders).toEqual([]);
  });
  it('gives each daily the rules of its date, and new free runs the latest', () => {
    expect(rulesOn('2026-09-28')).toBe(1);
    expect(rulesOn('2026-09-29')).toBe(1);
    expect(rulesOn('2026-09-30')).toBe(2);
    expect(rulesOn('2026-10-01')).toBe(3);
    expect(rulesOn('2026-10-04')).toBe(4);
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
