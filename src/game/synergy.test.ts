import { describe, expect, it } from 'vitest';
import { ROLE_ORDER, ROSTERS, Player } from '../data/rosters';
import * as G from './logic';
import { CHEM_CAP, chemistryOf, draftHints, nationCore, synergies } from './synergy';

// The latest roster each nick is on, so a test lineup is the era the nick is best known for however many older rosters the data holds.
const byNick = new Map([...ROSTERS].sort((a, b) => a.year - b.year).flatMap((r) => r.players.map((p) => [p.nick, { p, r }] as const)));
/** A lineup from nicks, in role order (slot fit doesn't matter for synergies). */
const team = (...nicks: string[]): G.Lineup[] => nicks.map((n, i) => ({ slot: ROLE_ORDER[i], player: byNick.get(n)!.p, roster: byNick.get(n)!.r }));
const kinds = (l: G.Lineup[], coach?: string) => synergies(l, coach).map((s) => s.kind);

describe('synergies', () => {
  it('counts the biggest national core, and the CIS together when no single country is bigger', () => {
    expect(nationCore(['dupreeh', 'Xyp9x', 'dev1ce', 'NiKo', 's1mple'].map((n) => byNick.get(n)!.p))).toEqual({ key: 'DK', n: 3 });
    expect(nationCore(['s1mple', 'donk', 'mou', 'NiKo', 'ZywOo'].map((n) => byNick.get(n)!.p))).toEqual({ key: 'CIS', n: 3 });
    const danish = synergies(team('karrigan', 'dev1ce', 'dupreeh', 'Magisk', 'Xyp9x')).find((s) => s.kind === 'nation')!;
    expect(danish.label).toBe('Danish core (5)');
  });
  it('rewards famous duos and one era, and penalizes a second AWPer', () => {
    expect(kinds(team('FalleN', 's1mple', 'coldzera', 'NiKo', 'ZywOo'))).toEqual(expect.arrayContaining(['duo', 'awp']));
    expect(kinds(team('kyxsan', 'sh1ro', 'donk', 'kyousuke', 'mezii'))).toEqual(expect.arrayContaining(['duo', 'era']));
    const two = synergies(team('gla1ve', 's1mple', 'NiKo', 'ZywOo', 'Xyp9x')).find((s) => s.kind === 'awp')!;
    expect(two.value).toBeLessThan(0);
  });
  it('caps the positives but never the penalties', () => {
    expect(chemistryOf([{ kind: 'lineup', label: 'a', value: 5 }, { kind: 'nation', label: 'b', value: 1.4 }])).toBe(CHEM_CAP);
    expect(chemistryOf([{ kind: 'lineup', label: 'a', value: 5 }, { kind: 'awp', label: 'b', value: -2 }])).toBe(CHEM_CAP - 2);
  });
  it('credits a coach who coached one of your players', () => {
    const l = team('gla1ve', 'dev1ce', 'NiKo', 'ZywOo', 's1mple');
    expect(kinds(l, 'zonic')).toContain('coach');
    expect(kinds(l, 'hally')).not.toContain('coach');
    expect(G.teamPower(l, 'zonic').total).toBeGreaterThan(G.teamPower(l).total);
  });
  it('hints what a pick would add while drafting', () => {
    const current = ['dupreeh', 'dev1ce'].map((n) => byNick.get(n)!.p);
    const texts = (p: Player) => draftHints(current, p).map((h) => h.text);
    expect(texts(byNick.get('Xyp9x')!.p)).toEqual(expect.arrayContaining(['3rd Danish · core', 'Duo with dupreeh']));
    expect(texts(byNick.get('ZywOo')!.p)).toContain('2nd AWPer');
  });
});
