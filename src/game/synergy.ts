// Synergies: what makes five players more (or less) than the sum of their ratings. All values are team-power
// points, the same scale as ratings; see teamPower in lineup.ts for how they combine and cap.
import { COACHES, ROSTERS, Player, Roster, appliedRules, isCoach } from '../data/rosters';
import type { Lineup } from './lineup';

export type SynergyKind = 'lineup' | 'nation' | 'duo' | 'era' | 'awp' | 'coach';
export interface Synergy { kind: SynergyKind; label: string; value: number }

/** Countries that count together for a core. The CIS scene shares a language and a talent pipeline. */
const REGION: Record<string, string> = { RU: 'CIS', UA: 'CIS', KZ: 'CIS', BY: 'CIS' };
export const NATION: Record<string, string> = {
  AU: 'Australian', BA: 'Bosnian', BE: 'Belgian', BG: 'Bulgarian', BR: 'Brazilian', CA: 'Canadian', CH: 'Swiss', CZ: 'Czech', DE: 'German', DK: 'Danish',
  EE: 'Estonian', FI: 'Finnish', FR: 'French', GB: 'British', GT: 'Guatemalan', HU: 'Hungarian', IL: 'Israeli', JO: 'Jordanian', KZ: 'Kazakh',
  LT: 'Lithuanian', LV: 'Latvian', ME: 'Montenegrin', MK: 'Macedonian', MN: 'Mongolian', NL: 'Dutch', NO: 'Norwegian', PL: 'Polish',
  PT: 'Portuguese', RO: 'Romanian', RS: 'Serbian', RU: 'Russian', SE: 'Swedish', SK: 'Slovak', TR: 'Turkish', UA: 'Ukrainian',
  US: 'American', XK: 'Kosovar', CIS: 'CIS',
};
export const COUNTRY: Record<string, string> = {
  AU: 'Australia', BA: 'Bosnia and Herzegovina', BE: 'Belgium', BG: 'Bulgaria', BR: 'Brazil', CA: 'Canada', CH: 'Switzerland', CZ: 'Czechia', DE: 'Germany',
  DK: 'Denmark', EE: 'Estonia', FI: 'Finland', FR: 'France', GB: 'United Kingdom', GT: 'Guatemala', HU: 'Hungary', IL: 'Israel', JO: 'Jordan',
  KZ: 'Kazakhstan', LT: 'Lithuania', LV: 'Latvia', ME: 'Montenegro', MK: 'North Macedonia', MN: 'Mongolia', NL: 'Netherlands', NO: 'Norway',
  PL: 'Poland', PT: 'Portugal', RO: 'Romania', RS: 'Serbia', RU: 'Russia', SE: 'Sweden', SK: 'Slovakia', TR: 'Türkiye',
  UA: 'Ukraine', US: 'United States', XK: 'Kosovo',
};
/** Nation core bonus by the size of the biggest group sharing a country (or the CIS). */
const CORE = [0, 0, 0, 0.6, 1.0, 1.4];

/** Famous pairs who won (or nearly won) together. Player ids. */
export const DUOS: [string, string, string][] = [
  ['f0rest', 'getright', 'The NiP duo'], ['dupreeh', 'xyp9x', 'Astralis mainstays'], ['dev1ce', 'dupreeh', 'The Danish backbone'],
  ['fallen', 'coldzera', 'The Brazilian dynasty'], ['fallen', 'fer', 'The Brazilian dynasty'], ['flusha', 'olofmeister', 'Fnatic 2015'],
  ['jw', 'flusha', 'Fnatic 2015'], ['niko', 'hunter', 'The cousins'], ['s1mple', 'electronic', 'NaVi 2021'], ['apex', 'zywoo', 'Vitality core'],
  ['karrigan', 'rain', 'FaZe veterans'], ['taz', 'neo', 'The Golden Five'], ['donk', 'sh1ro', 'Spirit 2024'], ['stewie2k', 'tarik', 'Boston miracle'],
  ['elige', 'twistzz', 'Liquid core'], ['yuurih', 'kscerato', 'FURIA core'], ['xantares', 'woxic', 'Turkish stars'], ['jame', 'qikert', 'AVANGAR core'],
  ['zeus', 'edward', 'Old NaVi'], ['kennys', 'apex', 'EnVyUs 2015'],
];

/** CS:GO Majors ran to Paris 2023; everything from Copenhagen 2024 on is Counter-Strike 2. */
export const era = (r: Roster) => (r.year >= 2024 ? 'CS2' : 'CS:GO');

export const coachBonus = (coach?: string | null) => (isCoach(coach) ? (COACHES[coach].rating - 75) * 0.06 : 0);

/**
 * Players who played under each coach at a Major, by player id, as the roster data reads under one rules version (#169): a coach corrected after
 * launch is the old one for runs that started under the old rules, so an old daily or challenge keeps its chemistry however the data changes later.
 */
const coachedByRules = new Map<number, Map<string, Set<string>>>();
function coachedNow(): Map<string, Set<string>> {
  const v = appliedRules();
  let m = coachedByRules.get(v);
  if (!m) {
    m = new Map();
    for (const r of ROSTERS) if (r.coach) {
      const s = m.get(r.coach) ?? new Set<string>();
      r.players.forEach((p) => s.add(p.id));
      m.set(r.coach, s);
    }
    coachedByRules.set(v, m);
  }
  return m;
}
export const coachKnows = (coach: string, playerId: string) => !!coachedNow().get(coach)?.has(playerId);

export function nationCore(players: Player[]): { key: string; n: number } {
  const count = new Map<string, number>();
  for (const p of players) {
    count.set(p.country, (count.get(p.country) ?? 0) + 1);
    const region = REGION[p.country];
    if (region) count.set(region, (count.get(region) ?? 0) + 1);
  }
  let best = { key: '', n: 0 };
  // A single country beats its region on a tie ("Russian core", not "CIS core").
  for (const [key, n] of count) if (n > best.n || (n === best.n && key !== 'CIS' && best.key === 'CIS')) best = { key, n };
  return best;
}

/** Everything that adds to or takes from a lineup's chemistry, strongest first. */
export function synergies(l: Lineup[], coach?: string | null): Synergy[] {
  const out: Synergy[] = [];
  let lineup = 0;
  for (let i = 0; i < l.length; i++)
    for (let j = i + 1; j < l.length; j++) {
      if (l[i].roster.id === l[j].roster.id) lineup += 0.5;
      else if (l[i].roster.org === l[j].roster.org) lineup += 0.3;
      else if (Math.abs(l[i].roster.year - l[j].roster.year) <= 1) lineup += 0.08;
    }
  if (lineup > 0) out.push({ kind: 'lineup', label: 'Shared history', value: Math.round(lineup * 100) / 100 });

  const core = nationCore(l.map((x) => x.player));
  if (CORE[core.n]) out.push({ kind: 'nation', label: `${NATION[core.key] ?? core.key} core (${core.n})`, value: CORE[core.n] });

  const ids = new Set(l.map((x) => x.player.id));
  for (const [a, b, name] of DUOS) if (ids.has(a) && ids.has(b)) {
    const nick = (id: string) => l.find((x) => x.player.id === id)!.player.nick;
    out.push({ kind: 'duo', label: `${name}: ${nick(a)} + ${nick(b)}`, value: 0.5 });
  }

  const eras = new Set(l.map((x) => era(x.roster)));
  if (eras.size === 1) out.push({ kind: 'era', label: `All ${[...eras][0]} era`, value: 0.3 });

  if (coach) {
    const known = l.filter((x) => coachKnows(coach, x.player.id));
    if (known.length) out.push({ kind: 'coach', label: `${coach} has coached ${known.map((x) => x.player.nick).join(', ')}`, value: Math.min(0.8, 0.4 * known.length) });
  }

  const awpers = l.filter((x) => x.player.roles[0] === 'AWP').length;
  if (awpers > 1) out.push({ kind: 'awp', label: `${awpers} AWPers, one AWP`, value: -1 * (awpers - 1) });
  return out.sort((a, b) => b.value - a.value);
}

/** Chemistry from synergies: the positives cap out, penalties don't. */
export const CHEM_CAP = 3;
export const chemistryOf = (s: Synergy[]) =>
  Math.min(CHEM_CAP, s.filter((x) => x.value > 0).reduce((a, x) => a + x.value, 0)) + s.filter((x) => x.value < 0).reduce((a, x) => a + x.value, 0);

/** "+", "++", "+++" or "−", for showing a synergy's size without the numbers behind the hidden ratings. */
export const strength = (v: number) => (v < 0 ? '−'.repeat(Math.min(3, Math.round(-v))) : v >= 1 ? '+++' : v >= 0.5 ? '++' : '+');

export interface Hint { text: string; good: boolean }
/** What drafting `cand` would add to the players you already have: shown on the player cards while drafting. */
export function draftHints(current: Player[], cand: Player): Hint[] {
  const out: Hint[] = [];
  const after = nationCore([...current, cand]), before = nationCore(current);
  const shared = (key: string) => cand.country === key || REGION[cand.country] === key;
  if (after.n >= 2 && after.n > before.n && shared(after.key)) {
    const nth = ['', '1st', '2nd', '3rd', '4th', '5th'][after.n];
    out.push({ text: `${nth} ${NATION[after.key] ?? after.key}${after.n >= 3 ? ' · core' : ''}`, good: true });
  }
  for (const [a, b] of DUOS) {
    const partner = cand.id === a ? b : cand.id === b ? a : null;
    const p = partner && current.find((x) => x.id === partner);
    if (p) out.push({ text: `Duo with ${p.nick}`, good: true });
  }
  if (cand.roles[0] === 'AWP' && current.some((x) => x.roles[0] === 'AWP')) out.push({ text: '2nd AWPer', good: false });
  return out;
}
