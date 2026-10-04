// Duo Link (#133): two pros who never shared a Major lineup, and one pro who played with both. Everyone gets the same pair each day and has three tries.
// "Played with" means "was on the same Major lineup in this game's data", not a whole career (#14); the screen says so. Normal mode shows four cards (one is
// right), Hard mode hides them and the answer is typed. Both play the same puzzle, so the pick logic is shared.
import { Roster, rostersOn } from '../data/rosters';
import * as G from './logic';
import { Pro, answerFor, isKnown, prosOn } from './guess';
import { dailyNumber } from './state';
import { isRealDate } from './dates';
import { readKey, safeSet } from './persist';

export const MAX_TRIES = 3;
export type DuoMode = 'normal' | 'hard';
export const MODE_LABEL: Record<DuoMode, string> = { normal: 'Normal', hard: 'Hard' };

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Who shared a lineup with whom, in `rosters`: each player's teammates, and the lineups each pair shared. */
export interface Links { teammates: Map<string, Set<string>>; shared: Map<string, Roster[]> }
export function linksOf(rosters: Roster[]): Links {
  const teammates = new Map<string, Set<string>>();
  const shared = new Map<string, Roster[]>();
  for (const r of rosters) {
    const ids = r.players.map((p) => p.id);
    for (const a of ids) {
      if (!teammates.has(a)) teammates.set(a, new Set());
      for (const b of ids) {
        if (a === b) continue;
        teammates.get(a)!.add(b);
        if (a < b) { const k = pairKey(a, b); if (!shared.has(k)) shared.set(k, []); shared.get(k)!.push(r); }
      }
    }
  }
  return { teammates, shared };
}

export interface DuoPuzzle {
  /** The two ends, by id (a sorts before b). */
  a: string;
  b: string;
  /** Everyone who played with both, by id: any of them is a right answer. */
  connectors: string[];
}

/** The most connectors a pair may have for the daily: more than that and the puzzle is a giveaway in Hard mode. */
const MAX_CONNECTORS = 3;

interface Day { all: Map<string, Pro>; known: Pro[]; links: Links; avoid: string }
const days = new Map<string, Day>();
function dayData(date: string): Day {
  let d = days.get(date);
  if (!d) {
    const all = prosOn(date);
    d = { all, known: [...all.values()].filter(isKnown).sort((x, y) => x.id.localeCompare(y.id)), links: linksOf(rostersOn(date)), avoid: answerFor(date).id };
    days.set(date, d);
  }
  return d;
}
/** Every player Duo Link on `date` knows about, with the roles and rosters of that date. */
export const duoPros = (date: string) => dayData(date).all;

/**
 * Every pair that makes a daily puzzle on `date`: two well-known pros who never shared a lineup, with one to three connectors, at least one of them well known
 * (so Normal mode has a fair right answer). Today's Guess the pro answer is kept out, as an end or a connector, so one puzzle never hands out the other.
 */
export function candidates(date: string): DuoPuzzle[] {
  const { known, links, avoid } = dayData(date);
  const out: DuoPuzzle[] = [];
  const knownIds = new Set(known.map((p) => p.id));
  for (let i = 0; i < known.length; i++) {
    const a = known[i].id;
    if (a === avoid) continue;
    const ta = links.teammates.get(a) ?? new Set<string>();
    for (let j = i + 1; j < known.length; j++) {
      const b = known[j].id;
      if (b === avoid || ta.has(b)) continue;
      const tb = links.teammates.get(b);
      if (!tb) continue;
      const connectors = [...ta].filter((c) => tb.has(c)).sort();
      if (connectors.length < 1 || connectors.length > MAX_CONNECTORS || connectors.includes(avoid) || !connectors.some((c) => knownIds.has(c))) continue;
      out.push({ a, b, connectors });
    }
  }
  return out;
}

/** The day's puzzle: seeded by the date from the pairs that existed that day, so later data never changes a played day. */
export function duoFor(date: string): DuoPuzzle {
  const list = candidates(date);
  return G.seeded(`duo-${date}`, () => list[G.rand(list.length)]);
}

const shuffle = <T,>(xs: T[]): T[] => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = G.rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const take = <T,>(xs: T[], n: number): T[] => shuffle(xs).slice(0, n);

/**
 * The four cards for Normal mode: one right answer and three decoys, in a seeded order so everyone sees the same cards. A decoy is never a right answer, never an
 * end, and never someone who shared a team (in any year) with both ends, so a correct card is never marked wrong. Two decoys are near misses (a teammate of just one
 * end), the third is a stranger to both, from another nation when there is one.
 */
export function cardsFor(date: string, p: DuoPuzzle, seed = `duo-opts-${date}`): { options: string[]; right: string } {
  const { all, known, links } = dayData(date);
  return G.seeded(seed, () => {
    const knownConnectors = p.connectors.filter((c) => all.get(c) && isKnown(all.get(c)!));
    const right = knownConnectors[G.rand(knownConnectors.length)];
    const ends = [p.a, p.b];
    const orgsOf = (id: string) => new Set(all.get(id)!.orgs);
    const withBoth = (id: string) => { const o = orgsOf(id); return orgsOf(p.a).size && [...orgsOf(p.a)].some((x) => o.has(x)) && [...orgsOf(p.b)].some((x) => o.has(x)); };
    const pool = known.filter((x) => !ends.includes(x.id) && !p.connectors.includes(x.id) && !withBoth(x.id));
    const ta = links.teammates.get(p.a) ?? new Set<string>(), tb = links.teammates.get(p.b) ?? new Set<string>();
    const near = pool.filter((x) => ta.has(x.id) !== tb.has(x.id));
    const far = pool.filter((x) => !ta.has(x.id) && !tb.has(x.id));
    const countries = new Set([all.get(p.a)!.country, all.get(p.b)!.country]);
    const picked: Pro[] = take(near, 2);
    const strangers = far.filter((x) => !countries.has(x.country));
    picked.push(...take(strangers.length ? strangers : far, 1));
    // Not enough of one kind (a small day): fill from whoever is left.
    for (const x of shuffle(pool)) { if (picked.length >= 3) break; if (!picked.includes(x)) picked.push(x); }
    return { options: shuffle([right, ...picked.slice(0, 3).map((x) => x.id)]), right };
  });
}
export const optionsFor = (date: string, p: DuoPuzzle, seed?: string): string[] => cardsFor(date, p, seed).options;

/** The lineup the right card shared with each end (their latest one), which Normal mode shows as a clue after a wrong try: a team badge and a year. */
export function hintLineups(date: string, p: DuoPuzzle, right: string): { a: Roster; b: Roster } {
  const links = linksFor(date);
  const last = (end: string) => { const l = sharedLineups(links, right, end); return l[l.length - 1]; };
  return { a: last(p.a), b: last(p.b) };
}

/** The lineups two players shared, oldest first, as "Cloud9 2016": why they are linked. */
export const sharedLineups = (links: Links, a: string, b: string): Roster[] => [...(links.shared.get(pairKey(a, b)) ?? [])].sort((x, y) => x.year - y.year);
export const lineupLabel = (r: Roster) => `${r.org} ${r.year}`;
export const linksFor = (date: string) => dayData(date).links;

// ---------- one day's play ----------
export interface DuoDay { mode: DuoMode | null; picks: string[]; done: boolean; won: boolean }
export const DUO_KEY = 'major-mayhem-duo-v1';
export const emptyDay = (): DuoDay => ({ mode: null, picks: [], done: false, won: false });

/** What was saved for each day: days and picks of the right shape, the rest dropped (like #164). Whether a pick is a real player is checked by `normalizeDuoDay`. */
export function sanitizeDuo(raw: unknown): Record<string, DuoDay> {
  const out: Record<string, DuoDay> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [date, d] of Object.entries(raw as Record<string, any>)) {
    if (!isRealDate(date) || typeof d !== 'object' || d === null || !Array.isArray(d.picks)) continue;
    const picks = [...new Set<string>(d.picks.filter((x: unknown): x is string => typeof x === 'string'))].slice(0, MAX_TRIES);
    out[date] = { mode: d.mode === 'normal' || d.mode === 'hard' ? d.mode : null, picks, done: d.done === true, won: d.won === true };
  }
  return out;
}

/** A saved day as the game should treat it: picks that are not players of that day are dropped, nothing counts after a right answer, and won/done follow from the picks. */
export function normalizeDuoDay(day: DuoDay | undefined, known: { has(id: string): boolean }, p: DuoPuzzle): DuoDay {
  const valid = (day?.picks ?? []).filter((id) => known.has(id) && id !== p.a && id !== p.b);
  const at = valid.findIndex((id) => p.connectors.includes(id));
  const picks = at >= 0 ? valid.slice(0, at + 1) : valid.slice(0, MAX_TRIES);
  const won = at >= 0;
  // A day that has picks has a mode: it was locked by the first pick. A save without one is read as Normal.
  const mode = day?.mode ?? (picks.length ? 'normal' : null);
  return { mode, picks, won, done: won || picks.length >= MAX_TRIES };
}

/** Adds a pick (a player id) to a day, finishing it on a right answer or on the last try. Pure. */
export function addPick(day: DuoDay, id: string, p: DuoPuzzle): DuoDay {
  if (day.done || day.picks.includes(id)) return day;
  const picks = [...day.picks, id];
  const won = p.connectors.includes(id);
  return { ...day, picks, won, done: won || picks.length >= MAX_TRIES };
}

let session: Record<string, DuoDay> | null = null;
export const forgetDuo = () => { session = null; };
export function loadDuo(): Record<string, DuoDay> {
  if (session) return session;
  try { const raw = readKey(DUO_KEY); return sanitizeDuo(raw ? JSON.parse(raw) : {}); } catch { return {}; }
}
export const saveDuo = (d: Record<string, DuoDay>) => { session = d; safeSet(DUO_KEY, JSON.stringify(d), 'your Duo Link history'); };

/** Days in a row with a solved puzzle (today's still counts while unplayed). One streak for both modes. */
export function duoStreak(all: Record<string, DuoDay>, today: string): number {
  const won = new Set(Object.entries(all).filter(([, d]) => d.won).map(([date]) => dailyNumber(date)));
  let d = dailyNumber(today);
  if (!won.has(d)) d--;
  let n = 0;
  while (won.has(d - n)) n++;
  return n;
}

/** Spoiler-free share text: the mode, the tries, and a square per try. */
export function duoShare(date: string, day: DuoDay, url?: string): string {
  const hard = day.mode === 'hard';
  const score = day.won ? `${day.picks.length}/${MAX_TRIES}` : `X/${MAX_TRIES}`;
  const row = day.picks.map((_, i) => (day.won && i === day.picks.length - 1 ? '🟩' : '⬛')).join('');
  return [`Major Mayhem · Duo Link #${dailyNumber(date)} · ${hard ? 'Hard ' : ''}${score}${hard ? ' 💀' : ''}`, row, ...(url ? [url] : [])].join('\n');
}
