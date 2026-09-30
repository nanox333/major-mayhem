// Guess the pro: a second daily. Everyone gets the same hidden player each day and has eight guesses; each guess
// shows how it compares on nation, role, Majors, best finish, first year and teams. Majors, best finish and first
// year describe the rosters included in the game, not a player's whole career (#14), and the UI labels them so.
import { ROSTERS, Roster, Role, rostersOn, rulesOn } from '../data/rosters';
import * as G from './logic';
import { dailyNumber } from './state';

export interface Pro {
  id: string;
  nick: string;
  country: string;
  /** The role they played most often as their main role (the latest one on a tie). */
  role: Role;
  roles: Role[];
  /** Top-eight Major finishes in the game's data. */
  majors: number;
  /** Best finish: 3 champion, 2 runner-up, 1 semifinal, 0 quarterfinal. */
  best: number;
  first: number;
  orgs: string[];
  portrait?: string;
  rosters: Roster[];
}

export const MAX_GUESSES = 8;
export const BEST_LABEL = ['Quarterfinal', 'Semifinal', 'Runner-up', 'Champion'];
const RESULT_RANK: Record<string, number> = { Champions: 3, 'Runner-up': 2, Semifinalist: 1, Quarterfinalist: 0 };

/** Every player in `rosters`, with the facts the clues compare. */
export function pros(rosters: Roster[] = ROSTERS): Map<string, Pro> {
  const out = new Map<string, Pro>();
  for (const r of [...rosters].sort((a, b) => a.year - b.year)) for (const p of r.players) {
    const e = out.get(p.id) ?? { id: p.id, nick: p.nick, country: p.country, role: p.roles[0], roles: [], majors: 0, best: 0, first: r.year, orgs: [], portrait: p.portrait, rosters: [] };
    e.majors++;
    e.best = Math.max(e.best, RESULT_RANK[r.result] ?? 0);
    if (!e.orgs.includes(r.org)) e.orgs.push(r.org);
    for (const role of p.roles) if (!e.roles.includes(role)) e.roles.push(role);
    e.rosters.push(r);
    out.set(p.id, e);
  }
  for (const e of out.values()) {
    const count = new Map<Role, number>();
    for (const r of e.rosters) { const role = r.players.find((x) => x.id === e.id)!.roles[0]; count.set(role, (count.get(role) ?? 0) + 1); }
    e.role = [...count].reduce((best, cur) => (cur[1] >= best[1] ? cur : best))[0];
  }
  return out;
}

/** Every player a Guess the pro daily on `date` knows about, with roles as that date's rules had them (#24). */
export const prosOn = (date: string) => G.withRules(rulesOn(date), () => pros(rostersOn(date)));

/**
 * Today's answer: seeded by the date, from rosters available that day (so data additions don't change it), and only
 * from players people can reasonably know: two or more Majors in the data, or a top game rating.
 */
export function answerFor(date: string): Pro {
  const all = prosOn(date);
  const known = [...all.values()].filter((p) => p.majors >= 2 || p.rosters.some((r) => r.players.find((x) => x.id === p.id)!.rating >= 88))
    .sort((a, b) => a.id.localeCompare(b.id));
  return G.seeded(`guess-${date}`, () => known[G.rand(known.length)]);
}

export type ClueState = 'hit' | 'near' | 'miss';
export interface Clue { key: 'country' | 'role' | 'majors' | 'best' | 'first' | 'orgs'; text: string; state: ClueState; dir?: 'up' | 'down' }

const REGION: Record<string, string> = { RU: 'CIS', UA: 'CIS', KZ: 'CIS', BY: 'CIS', SE: 'Nordic', DK: 'Nordic', NO: 'Nordic', FI: 'Nordic', EE: 'Baltic', LV: 'Baltic', LT: 'Baltic' };
const dir = (guess: number, answer: number) => (answer > guess ? 'up' : 'down') as 'up' | 'down';

/** How a guess compares with the answer: hit, near or miss, with ↑/↓ for numbers (the UI adds a symbol and a description to each). */
export function compare(g: Pro, a: Pro): Clue[] {
  const region = (c: string) => REGION[c];
  const sharedOrgs = g.orgs.filter((o) => a.orgs.includes(o));
  return [
    { key: 'country', text: g.country, state: g.country === a.country ? 'hit' : region(g.country) && region(g.country) === region(a.country) ? 'near' : 'miss' },
    { key: 'role', text: g.role, state: g.role === a.role ? 'hit' : a.roles.includes(g.role) ? 'near' : 'miss' },
    { key: 'majors', text: String(g.majors), state: g.majors === a.majors ? 'hit' : 'miss', ...(g.majors !== a.majors ? { dir: dir(g.majors, a.majors) } : {}) },
    { key: 'best', text: BEST_LABEL[g.best], state: g.best === a.best ? 'hit' : 'miss', ...(g.best !== a.best ? { dir: dir(g.best, a.best) } : {}) },
    { key: 'first', text: String(g.first), state: g.first === a.first ? 'hit' : Math.abs(g.first - a.first) <= 1 ? 'near' : 'miss', ...(g.first !== a.first ? { dir: dir(g.first, a.first) } : {}) },
    { key: 'orgs', text: sharedOrgs.length ? sharedOrgs.join(', ') : g.orgs.slice(0, 2).join(', '), state: sharedOrgs.length === a.orgs.length && g.orgs.length === a.orgs.length ? 'hit' : sharedOrgs.length ? 'near' : 'miss' },
  ];
}

/** A symbol for each clue state, so a result never depends on colour alone (#22). */
export const CLUE_MARK: Record<ClueState, string> = { hit: '✓', near: '≈', miss: '✗' };
export const CLUE_LABEL: Record<Clue['key'], string> = { country: 'Nation', role: 'Role', majors: 'Majors', best: 'Best finish', first: 'First year', orgs: 'Teams' };

/** What a clue says, in words: "Same region", "Answer has more Majors". Used for screen readers and hover text. */
export function clueMeaning(c: Clue): string {
  const up = c.dir === 'up';
  switch (c.key) {
    case 'country': return c.state === 'hit' ? 'Same nation' : c.state === 'near' ? 'Same region' : 'Different region';
    case 'role': return c.state === 'hit' ? 'Their main role' : c.state === 'near' ? 'A role they also played' : 'Not a role they played';
    case 'majors': return c.state === 'hit' ? 'Same number of Majors' : `Answer has ${up ? 'more' : 'fewer'} Majors`;
    case 'best': return c.state === 'hit' ? 'Same best finish' : `Answer finished ${up ? 'higher' : 'lower'}`;
    case 'first': {
      const when = up ? 'later' : 'earlier';
      return c.state === 'hit' ? 'Same first year' : c.state === 'near' ? `A year off; answer's first year is ${when}` : `Answer's first year is ${when}`;
    }
    case 'orgs': return c.state === 'hit' ? 'Same teams' : c.state === 'near' ? 'Shares a team' : 'No shared team';
  }
}
/** A clue as one sentence, for `aria-label`: "Nation: Sweden. Same region." */
export const describeClue = (c: Clue, shown: string = c.text) => `${CLUE_LABEL[c.key]}: ${shown}. ${clueMeaning(c)}.`;

export interface GuessDay { guesses: string[]; done: boolean; won: boolean }
const KEY = 'major-mayhem-guess-v1';
export function loadGuesses(): Record<string, GuessDay> {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
export const saveGuesses = (g: Record<string, GuessDay>) => { try { localStorage.setItem(KEY, JSON.stringify(g)); } catch { /* storage unavailable */ } };

/** Adds a guess (by player id) to a day, finishing it on a hit or on the last guess. Pure. */
export function addGuess(day: GuessDay, id: string, answer: Pro): GuessDay {
  if (day.done || day.guesses.includes(id)) return day;
  const guesses = [...day.guesses, id];
  const won = id === answer.id;
  return { guesses, won, done: won || guesses.length >= MAX_GUESSES };
}

/** Days in a row with a solved puzzle (today's still counts while unplayed). */
export function guessStreak(all: Record<string, GuessDay>, today: string): number {
  const won = new Set(Object.entries(all).filter(([, d]) => d.won).map(([date]) => dailyNumber(date)));
  let d = dailyNumber(today);
  if (!won.has(d)) d--;
  let n = 0;
  while (won.has(d - n)) n++;
  return n;
}

const SQUARE: Record<ClueState, string> = { hit: '🟩', near: '🟨', miss: '⬛' };
/** Spoiler-free share text: one row of squares per guess. */
export function guessShare(date: string, day: GuessDay, answer: Pro, all: Map<string, Pro>, url?: string): string {
  const rows = day.guesses.map((id) => compare(all.get(id)!, answer).map((c) => SQUARE[c.state]).join(''));
  return [`Major Mayhem · Guess the Pro #${dailyNumber(date)} ${day.won ? `${day.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`}`, ...rows, ...(url ? [url] : [])].join('\n');
}

/** Players whose nick matches what's typed (start of the nick first), for the guess box. */
export function suggest(all: Map<string, Pro>, text: string, exclude: string[], n = 8): Pro[] {
  const q = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!q) return [];
  const list = [...all.values()].filter((p) => !exclude.includes(p.id) && p.id.includes(q));
  return list.sort((a, b) => Number(!a.id.startsWith(q)) - Number(!b.id.startsWith(q)) || a.nick.localeCompare(b.nick)).slice(0, n);
}

export type SearchState = { kind: 'idle' } | { kind: 'results'; options: Pro[] } | { kind: 'none' } | { kind: 'guessed'; nick: string };
/** What the guess box has to say about the text typed: suggestions, nothing yet, no such player, or someone already guessed (#22). */
export function searchState(all: Map<string, Pro>, text: string, exclude: string[]): SearchState {
  if (!text.replace(/[^a-z0-9]/gi, '')) return { kind: 'idle' };
  const options = suggest(all, text, exclude);
  if (options.length) return { kind: 'results', options };
  const seen = suggest(all, text, [], 1)[0];
  return seen ? { kind: 'guessed', nick: seen.nick } : { kind: 'none' };
}

// ---------- the reveal (#127) ----------
/** Timings in ms, shared by the CSS (as custom properties) and the sound scheduler, so picture and sound can't drift apart. */
export const REVEAL = { pop: 220, stagger: 250, flip: 500, bounce: 100, bounceLen: 500 } as const;

export interface RevealPlan {
  /** When the player-name cell pops in. */
  name: number;
  /** When each clue cell starts to flip, in order. */
  cells: number[];
  /** When each clue cell shows its result: halfway through its flip. The sound for that cell plays then. */
  show: number[];
  /** When the whole row is done. */
  total: number;
  /** When each cell of a winning row starts its bounce, after `total`. */
  bounce: number[];
}
/**
 * The schedule for one guess's reveal: the name pops, then the cells flip left to right, one every `stagger`, each showing its result at the
 * halfway point. With reduced motion nothing waits: every delay is 0, the row is complete at once, and the sounds (which follow the sound
 * setting, not motion) play together.
 */
export function revealPlan(n: number, reduced: boolean): RevealPlan {
  if (reduced) return { name: 0, cells: Array(n).fill(0), show: Array(n).fill(0), total: 0, bounce: Array(n).fill(0) };
  const cells = Array.from({ length: n }, (_, i) => REVEAL.pop + i * REVEAL.stagger);
  const total = n ? cells[n - 1] + REVEAL.flip : REVEAL.pop;
  return { name: 0, cells, show: cells.map((c) => c + REVEAL.flip / 2), total, bounce: Array.from({ length: n }, (_, i) => total + i * REVEAL.bounce) };
}

/** A whole guess as one sentence for a polite live region: "Guess 3, ZywOo. Nation: Sweden. Same region. ..." Announced once, not cell by cell. */
export function spokenGuess(n: number, nick: string, clues: Clue[], named: (c: Clue) => string, right: boolean): string {
  if (right) return `Guess ${n}, ${nick}. Correct.`;
  return `Guess ${n}, ${nick}. ${clues.map((c) => describeClue(c, named(c))).join(' ')}`;
}

/** Best finish as a short label, for tight cells. */
export const BEST_SHORT = ['QF', 'SF', '2nd', '1st'];

/**
 * The teams to show for a guess (#125): up to three, the ones shared with the answer first so they are never the ones left out,
 * each with the roster its badge is drawn from (their latest at that organisation), and how many more there are.
 */
export function teamsFor(g: Pro, a: Pro, max = 3): { shown: { org: string; roster: Roster; shared: boolean }[]; more: number; sharedCount: number } {
  const all = g.orgs.map((org) => ({ org, roster: [...g.rosters].reverse().find((r) => r.org === org)!, shared: a.orgs.includes(org) }));
  const ordered = [...all.filter((x) => x.shared), ...all.filter((x) => !x.shared)];
  return { shown: ordered.slice(0, max), more: Math.max(0, ordered.length - max), sharedCount: all.filter((x) => x.shared).length };
}
