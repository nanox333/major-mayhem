// Draft duels: send your drafted team as a link; your friend drafts from the same cases, then the two teams play a
// best-of-three showmatch. Everything travels in the link: no server.
import { COACHES, LATEST_RULES, ROLE_ORDER, Role, Roster, rostersOn } from '../data/rosters';
import * as G from './logic';

export interface Duel {
  v: 1;
  /** The challenger's name, as they typed it. */
  name: string;
  /** The seed the challenger drafted from, so the friend opens the same cases. */
  seed: string;
  /** The daily's date when the challenger was playing a daily (it pins the roster pool). */
  date?: string;
  opts?: { era?: 'csgo' | 'cs2'; pool?: 'champions' | 'underdogs'; hard?: boolean };
  /** The challenger's five: [slot, roster id, player id], in role order. */
  picks: [Role, string, string][];
  coach?: string | null;
  /** The challenger's bench player: [roster id, player id]. */
  bench?: [string, string] | null;
  /** The rules version the challenger drafted under (#24). Missing on links from before versions existed. */
  rules?: number;
}

export const DUEL_ID = 'duel-challenger';
const MAX_NAME = 24;

export const cleanName = (s: string) => s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MAX_NAME) || 'A friend';

export function duelFrom(run: { seed: string; mode: string; opts?: Duel['opts']; picks: G.Pick[]; coach?: string | null; bench?: G.Pick | null; rules?: number }, name: string): Duel {
  const byRole = ROLE_ORDER.map((slot) => run.picks.find((p) => p.slot === slot)!);
  return {
    v: 1, name: cleanName(name), seed: run.seed,
    ...(run.mode === 'daily' ? { date: run.seed.replace('daily-', '') } : {}),
    ...(run.opts ? { opts: run.opts } : {}),
    picks: byRole.map((p) => [p.slot, p.rosterId, p.playerId]),
    coach: run.coach ?? null,
    bench: run.bench ? [run.bench.rosterId, run.bench.playerId] : null,
    rules: run.rules ?? 1,
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

/** Reads a duel from a link, or null if it's malformed or names teams, players or a coach this version doesn't have. */
export function decodeDuel(code: string): Duel | null {
  try {
    const d = JSON.parse(fromB64(code)) as Duel;
    const player = (rid: string, pid: string) => G.rosterById.get(rid)?.players.some((p) => p.id === pid);
    const ok = d?.v === 1 && typeof d.seed === 'string' && d.seed.length <= 40 && typeof d.name === 'string'
      && Array.isArray(d.picks) && d.picks.length === 5
      && d.picks.every(([slot, rid, pid], i) => slot === ROLE_ORDER[i] && player(rid, pid))
      && new Set(d.picks.map((p) => p[2])).size === 5
      && (d.coach == null || d.coach in COACHES)
      && (d.bench == null || (player(d.bench[0], d.bench[1]) && !d.picks.some((p) => p[2] === d.bench![1])))
      && (d.date === undefined || /^\d{4}-\d{2}-\d{2}$/.test(d.date))
      && validOpts(d.opts)
      && (d.rules === undefined || (Number.isInteger(d.rules) && d.rules >= 1 && d.rules <= LATEST_RULES));
    return ok ? { ...d, name: cleanName(d.name), ...(d.opts ? { opts: cleanOpts(d.opts) } : {}) } : null;
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
