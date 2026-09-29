// The dataset: rosters, players, coaches and organizations, loaded from rosters.json (see its "_readme").
//
// Rosters and placements come from the "Final standings" tables of English Wikipedia's Major pages, cached in
// data/cache/wikipedia-standings.json. A few rosters are marked "unverified": written from knowledge because the
// build machine couldn't reach Wikipedia, to be checked with `npm run fetch-data`. Every roster links to Liquipedia.
//
// Roles are assigned from common knowledge of each lineup: sensible game roles, not official ones. Ratings (60–99)
// and coach ratings are invented GAME RATINGS for balance, not HLTV ratings or any official stat.

import media from './media.json';
import data from './rosters.json';

export type Role = 'IGL' | 'AWP' | 'ENTRY' | 'LURK' | 'SUP';

export const ROLE_ORDER: Role[] = ['IGL', 'AWP', 'ENTRY', 'LURK', 'SUP'];

export const ROLE_LABEL: Record<Role, string> = {
  IGL: 'IGL',
  AWP: 'AWPer',
  ENTRY: 'Entry',
  LURK: 'Lurker',
  SUP: 'Support / Anchor',
};

export const ROLE_SHORT: Record<Role, string> = {
  IGL: 'IGL', AWP: 'AWP', ENTRY: 'ENTRY', LURK: 'LURK', SUP: 'SUPPORT',
};

export interface Player {
  id: string;         // person id, shared across rosters (prevents drafting the same person twice)
  nick: string;
  roles: Role[];      // first = main role, rest = roles they can also fill
  rating: number;     // game rating
  /** ISO 3166-1 alpha-2 country code (XK for Kosovo). */
  country: string;
  portrait?: string;  // optional image URL (filled by the fetch script when images are permitted)
}

export interface Roster {
  id: string;
  org: string;
  tag: string;        // 2-4 letter monogram for the fallback badge
  color: string;      // badge color
  year: number;
  event: string;
  dates: string;
  result: string;
  sourceUrl: string;  // Wikipedia page the roster was read from
  liquipediaUrl: string;
  logo?: string;
  /** The team's coach at that Major, when the source lists one. */
  coach?: string;
  /** Written from knowledge rather than read from the cached source; check with `npm run fetch-data`. */
  unverified?: boolean;
  players: Player[];
  /** First daily (YYYY-MM-DD) this roster may appear in. Unset for the launch set. */
  since?: string;
  /** Last daily this roster appears in. Retire rosters this way rather than deleting them. */
  until?: string;
}

/** The shape of rosters.json. */
export interface RosterFile {
  orgs: Record<string, { tag: string; color: string }>;
  players: Record<string, { country: string }>;
  coaches: Record<string, { rating: number }>;
  rosters: {
    org: string; year: number; event: string; dates: string; result: string; wiki: string;
    coach?: string; source?: string; since?: string; until?: string;
    /** The coach rules v1 used (null: none), when a later correction changed it. */
    coachV1?: string | null;
    /** `rolesV1`: the roles rules v1 used, when a later correction changed them (see RULES). */
    players: { nick: string; id?: string; roles: string[]; rolesV1?: string[]; rating: number }[];
  }[];
}
export const DATA = data as RosterFile;

const WIKI = 'https://en.wikipedia.org/wiki/';
const lq = (q: string) => `https://liquipedia.net/counterstrike/index.php?search=${encodeURIComponent(q)}`;

export const pid = (nick: string) => nick.toLowerCase().replace(/[^a-z0-9]/g, '');
export const rosterId = (org: string, year: number, event: string) => `${pid(org)}-${year}-${pid(event).slice(0, 10)}`;

// Images: player photos and team logos from bo3.gg's public pages, with freely licensed Wikimedia Commons
// files filling gaps (see CREDITS). Cropped and embedded at build time by scripts/build-media.mjs.
interface Media { src: string; source: string; file: string; author: string; license: string; page: string }
const PHOTOS = media.players as Record<string, Media>;
const LOGOS = media.logos as Record<string, Media>;
export const CREDITS = {
  photos: Object.entries(PHOTOS).map(([id, m]) => ({ id, ...m, src: undefined })),
  logos: Object.entries(LOGOS).map(([org, m]) => ({ id: org, ...m, src: undefined })),
};

/** Coach ratings: invented game values, like player ratings. */
export const COACHES: Record<string, { rating: number }> = DATA.coaches;

/** Players whose roles were corrected after launch: [player, latest roles, roles under rules v1]. */
const CORRECTED: [Player, Role[], Role[]][] = [];
/** Rosters whose coach was corrected after launch: [roster, latest coach, coach under rules v1]. */
const RECOACHED: [Roster, string | undefined, string | undefined][] = [];

export const ROSTERS: Roster[] = DATA.rosters.map((r) => {
  const o = DATA.orgs[r.org] ?? { tag: r.org.slice(0, 3).toUpperCase(), color: '#c9a45c' };
  const roster: Roster = {
    id: rosterId(r.org, r.year, r.event), org: r.org, tag: o.tag, color: o.color, year: r.year, event: r.event, dates: r.dates, result: r.result,
    sourceUrl: WIKI + r.wiki,
    liquipediaUrl: lq(r.event),
    logo: LOGOS[r.org]?.src,
    coach: r.coach,
    unverified: r.source === 'unverified' || undefined,
    since: r.since,
    until: r.until,
    players: r.players.map((p) => {
      const id = p.id ?? pid(p.nick);
      // Photos are keyed by nick; a player with an explicit id (a nick shared with someone else) has none.
      const player: Player = { id, nick: p.nick, roles: p.roles as Role[], rating: p.rating, country: DATA.players[id]?.country ?? '', portrait: p.id ? undefined : PHOTOS[id]?.src };
      if (p.rolesV1) CORRECTED.push([player, p.roles as Role[], p.rolesV1 as Role[]]);
      return player;
    }),
  };
  if (r.coachV1 !== undefined) RECOACHED.push([roster, r.coach, r.coachV1 ?? undefined]);
  return roster;
});

export const playerLiquipedia = (nick: string) => lq(nick);

/** The rosters a daily on `date` (YYYY-MM-DD) draws from: later data additions and retirements don't change it. */
export const rostersOn = (date: string) => ROSTERS.filter((r) => (!r.since || r.since <= date) && (!r.until || date <= r.until));
/**
 * Rules versions (#24). A daily plays under the rules in force on its date, and a saved run keeps the version it
 * started with, so fixing the simulation or correcting data never changes a challenge that has already begun.
 * - v1: the launch simulation and data.
 * - v2 (from 2026-09-30): one death per player per round, consistent clutches and narration (#12, #15); corrected
 *   IGL labels (#13).
 * To add a version: append it here with tomorrow's date, keep the old behaviour behind `rules() < n` in the code, and
 * put any changed roles in `rolesV1`-style fields.
 */
export const RULES = [{ v: 1, from: '2026-09-28' }, { v: 2, from: '2026-09-30' }] as const;
export const LATEST_RULES: number = RULES[RULES.length - 1].v;
export const rulesOn = (date: string): number => [...RULES].reverse().find((r) => r.from <= date)?.v ?? 1;
/** Puts every corrected role and coach back as it was under rules `v`. */
export function applyRoles(v: number) {
  for (const [p, latest, v1] of CORRECTED) p.roles = v >= 2 ? latest : v1;
  for (const [r, latest, v1] of RECOACHED) r.coach = v >= 2 ? latest : v1;
}

/** Free play draws from every roster that isn't retired. */
export const activeRosters = () => ROSTERS.filter((r) => !r.until);
