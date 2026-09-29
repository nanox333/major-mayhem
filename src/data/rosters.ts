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
    players: { nick: string; id?: string; roles: string[]; rating: number }[];
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

export const ROSTERS: Roster[] = DATA.rosters.map((r) => {
  const o = DATA.orgs[r.org] ?? { tag: r.org.slice(0, 3).toUpperCase(), color: '#c9a45c' };
  return {
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
      return { id, nick: p.nick, roles: p.roles as Role[], rating: p.rating, country: DATA.players[id]?.country ?? '', portrait: p.id ? undefined : PHOTOS[id]?.src };
    }),
  };
});

export const playerLiquipedia = (nick: string) => lq(nick);

/** The rosters a daily on `date` (YYYY-MM-DD) draws from: later data additions and retirements don't change it. */
export const rostersOn = (date: string) => ROSTERS.filter((r) => (!r.since || r.since <= date) && (!r.until || date <= r.until));
/** Free play draws from every roster that isn't retired. */
export const activeRosters = () => ROSTERS.filter((r) => !r.until);
