// Draft duels: send your drafted team as a link. Your friend is dealt the same cases you were (the same offers, in order, with spins only where you spun),
// then the two teams play a best-of-three showmatch on equal terms: no match-day form, subs or tactical calls, and maps and sides chosen by one rule
// for both teams (#172). Everything travels in the link: no server.
// A link from before that (`v: 1`) has no case history, so it is a plain challenge to beat a saved team and plays under the rules it was made with.
import { LATEST_RULES, ROLE_ORDER, RULE_SINCE, Role, Roster, isCoach, rostersOn } from '../data/rosters';
import * as G from './logic';
import { isRealDate } from './dates';

export interface Duel {
  /** 2: equal conditions, with the challenger's cases in `offers`. 1: the older challenge, with the same starting seed only. */
  v: 1 | 2;
  /** The challenger's name, as they typed it. */
  name: string;
  /** The seed the challenger drafted from, so the friend opens the same cases. */
  seed: string;
  /** The daily's date when the challenger was playing a daily (it pins the roster pool). */
  date?: string;
  opts?: { era?: 'csgo' | 'cs2'; pool?: 'champions' | 'underdogs'; hard?: boolean };
  /** v2: every case the challenger was shown, by draft round (five players, the coach, the bench) and in the order they spun to them. */
  offers?: string[][][];
  /** The challenger's five: [slot, roster id, player id], in role order. */
  picks: [Role, string, string][];
  coach?: string | null;
  /** The challenger's bench player: [roster id, player id]. */
  bench?: [string, string] | null;
  /** The rules version the challenger drafted under (#24). Missing on links from before versions existed. */
  rules?: number;
}

/** The rules version that first makes a duel an equal-conditions one. */
const EQUAL_FROM = RULE_SINCE.equalDuel;
/** A draft has five player rounds, the coach and the bench. */
export const DUEL_ROUNDS = 7;
/** A run gets two spins, so no more than two cases can have been spun to. */
const MAX_SPINS = 2;

export const DUEL_ID = 'duel-challenger';
const MAX_NAME = 24;

export const cleanName = (s: string) => s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MAX_NAME) || 'A friend';

/** Whether a case history is complete enough to deal a friend the same cases: every round has a case, and no more spins than a run has. */
export const completeLog = (log: unknown): log is string[][][] => Array.isArray(log) && log.length === DUEL_ROUNDS
  && log.every((c) => Array.isArray(c) && c.length >= 1 && c.length <= 1 + MAX_SPINS && c.every((o) => Array.isArray(o) && o.length >= 1 && o.length <= 3))
  && log.reduce((n: number, c: unknown[]) => n + c.length - 1, 0) <= MAX_SPINS;

export function duelFrom(run: { seed: string; mode: string; opts?: Duel['opts']; picks: G.Pick[]; coach?: string | null; bench?: G.Pick | null; rules?: number; offerLog?: string[][][] }, name: string): Duel {
  const byRole = ROLE_ORDER.map((slot) => run.picks.find((p) => p.slot === slot)!);
  const rules = run.rules ?? 1;
  // A run that was dealt its cases under the equal-conditions rules and kept them all sends a v2 link. Anything else can't promise the same cases, so it
  // sends the older challenge, under the last rules that had one.
  const equal = rules >= EQUAL_FROM && completeLog(run.offerLog);
  return {
    v: equal ? 2 : 1, name: cleanName(name), seed: run.seed,
    ...(equal ? { offers: run.offerLog } : {}),
    ...(run.mode === 'daily' ? { date: run.seed.replace('daily-', '') } : {}),
    ...(run.opts ? { opts: run.opts } : {}),
    picks: byRole.map((p) => [p.slot, p.rosterId, p.playerId]),
    coach: run.coach ?? null,
    bench: run.bench ? [run.bench.rosterId, run.bench.playerId] : null,
    rules: equal ? rules : Math.min(rules, EQUAL_FROM - 1),
  };
}

// base64url of UTF-8 JSON, so names with any characters survive the trip through a URL.
const toB64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

export const encodeDuel = (d: Duel) => toB64(JSON.stringify(d));

/** A link's free-play options: only the known values, or none at all (#27). */
const validOpts = (o: unknown) => o === undefined || (typeof o === 'object' && o !== null && !Array.isArray(o)
  && [undefined, 'csgo', 'cs2'].includes((o as Duel['opts'])!.era)
  && [undefined, 'champions', 'underdogs'].includes((o as Duel['opts'])!.pool)
  && [undefined, true, false].includes((o as Duel['opts'])!.hard));
/** Keeps only the known keys, so nothing else from a hand-edited link reaches the run. */
const cleanOpts = (o: NonNullable<Duel['opts']>): NonNullable<Duel['opts']> =>
  ({ ...(o.era ? { era: o.era } : {}), ...(o.pool ? { pool: o.pool } : {}), ...(o.hard ? { hard: true } : {}) });

/**
 * Whether a value is a duel this version can play: real teams and players, a real coach (by own name, so "constructor" is not one), real calendar dates that
 * agree with the seed, known options and a rules version that exists (#27, #170). Used for links and for a saved duel run alike.
 */
export function validDuel(d: any): d is Duel {
  const player = (rid: unknown, pid: unknown) => typeof rid === 'string' && typeof pid === 'string' && !!G.rosterById.get(rid)?.players.some((p) => p.id === pid);
  if (!(typeof d === 'object' && d !== null && !Array.isArray(d))) return false;
  const datedSeed = typeof d.seed === 'string' && d.seed.startsWith('daily-');
  const caseHistory = d.offers === undefined || (completeLog(d.offers) && d.offers.every((c: string[][]) => c.every((o) => o.every((id) => typeof id === 'string' && G.rosterById.has(id)))));
  // The two versions can't be mixed: an equal-conditions link must carry the cases and the rules that go with them, and an older one must carry neither.
  const versioned = d.v === 2 ? d.offers !== undefined && Number.isInteger(d.rules) && d.rules >= EQUAL_FROM : d.v === 1 && d.offers === undefined && (d.rules === undefined || d.rules < EQUAL_FROM);
  return versioned && caseHistory && typeof d.seed === 'string' && d.seed.length <= 40 && typeof d.name === 'string'
    && Array.isArray(d.picks) && d.picks.length === 5
    && d.picks.every((x: unknown, i: number) => Array.isArray(x) && x.length === 3 && x[0] === ROLE_ORDER[i] && player(x[1], x[2]))
    && new Set(d.picks.map((p: [Role, string, string]) => p[2])).size === 5
    && (d.coach == null || isCoach(d.coach))
    && (d.bench == null || (Array.isArray(d.bench) && player(d.bench[0], d.bench[1]) && !d.picks.some((p: [Role, string, string]) => p[2] === d.bench[1])))
    // A dated duel is a daily: its date is a real day and is the one in the seed. An undated one is not a daily.
    && (d.date === undefined ? !datedSeed : isRealDate(d.date) && d.seed === `daily-${d.date}`)
    && validOpts(d.opts)
    && (d.rules === undefined || (Number.isInteger(d.rules) && d.rules >= 1 && d.rules <= LATEST_RULES));
}

/** Reads a duel from a link, or null if it's malformed or names teams, players or a coach this version doesn't have. */
export function decodeDuel(code: string): Duel | null {
  try {
    const d = JSON.parse(fromB64(code)) as Duel;
    return validDuel(d) ? { ...d, name: cleanName(d.name), ...(d.opts ? { opts: cleanOpts(d.opts) } : {}) } : null;
  } catch { return null; }
}

export const duelLink = (base: string, d: Duel) => `${base}#duel=${encodeDuel(d)}`;
/** The duel code in a URL's hash, if any. */
export const duelCode = (hash: string) => /^#duel=([A-Za-z0-9_-]+)$/.exec(hash)?.[1] ?? null;

export function challengerLineup(d: Duel): G.Lineup[] {
  return d.picks.map(([slot, rid, pid]) => {
    const roster = G.rosterById.get(rid)!;
    return { slot, roster, player: roster.players.find((p) => p.id === pid)! };
  });
}

const initials = (name: string) => (name.match(/[A-Za-z0-9]/g) ?? ['?']).slice(0, 3).join('').toUpperCase();

/** Makes the challenger's team available as an opponent (the showmatch looks it up like any roster). */
export function registerDuel(d: Duel): Roster {
  const lineup = challengerLineup(d);
  const r: Roster = {
    id: DUEL_ID, org: `${d.name}'s team`, tag: initials(d.name), color: '#e0a33b',
    year: Math.max(...lineup.map((x) => x.roster.year)), event: 'Draft duel showmatch', dates: '', result: 'Challenger',
    sourceUrl: '', liquipediaUrl: '', coach: d.coach ?? undefined, players: lineup.map((x) => x.player),
  };
  G.registerTeam(r, lineup);
  return r;
}

/** The rosters a duel drafts from: the daily's pinned set when the challenger played a daily. */
export const duelRosters = (d: Duel) => (d.date ? rostersOn(d.date) : null);

/**
 * What a duel promises, in words (#172): shown on the invite, in the lobby and when sending, so the claim and the rules agree. An equal-conditions duel says
 * what is the same for both; an older link says plainly that it is a challenge to beat a saved team.
 */
export function duelTerms(d: Pick<Duel, 'v' | 'name'>): { headline: string; lines: string[] } {
  return d.v === 2 ? {
    headline: 'Same cases, equal terms',
    lines: [
      `You are dealt the cases ${d.name} saw, in the same order. You can spin only where they spun, and no more often than they did.`,
      'The showmatch is a best of three on equal terms: no match-day form, no substitutions and no tactical calls for either team. Your bench player and theirs sit it out.',
      'Both teams ban, pick and take sides by the same rule, and a coin flip decides who vetoes first.',
    ],
  } : {
    headline: 'A challenge to beat their saved team',
    lines: [
      `You draft from cases dealt from the same starting seed as ${d.name}, but what you pick and spin changes what you see after the first case.`,
      `This is not an equal match: you get match-day form, substitutions, the veto and tactical calls, and ${d.name}'s team plays without them.`,
    ],
  };
}
