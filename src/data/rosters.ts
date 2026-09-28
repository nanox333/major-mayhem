// Starter dataset for Major Mayhem.
//
// Rosters and placements: taken from the "Final standings" tables of English Wikipedia
// Major pages, retrieved 2026-09-28 and cached in data/cache/wikipedia-standings.json.
// Liquipedia could not be reached from the build environment, so every roster also links
// to a Liquipedia search for the event so players can check it there.
//
// Roles: Wikipedia and the standings tables don't list roles. They are assigned from
// common knowledge of each lineup and should be read as sensible game roles, not official ones.
// Ratings: invented GAME RATINGS (60–99) for balance. They are not HLTV ratings or any official stat.

import media from './media.json';

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
  players: Player[];
  /** First daily (YYYY-MM-DD) this roster may appear in. Unset for the launch set. */
  since?: string;
  /** Last daily this roster appears in. Retire rosters this way rather than deleting them. */
  until?: string;
}

const ORG: Record<string, { tag: string; color: string }> = {
  'Virtus.pro': { tag: 'VP', color: '#e66b1f' },
  'Ninjas in Pyjamas': { tag: 'NIP', color: '#d4d7da' },
  'Fnatic': { tag: 'FNC', color: '#ff5900' },
  'Team Dignitas': { tag: 'DIG', color: '#f2c200' },
  'Cloud9': { tag: 'C9', color: '#1f9ce3' },
  'Team EnVyUs': { tag: 'NV', color: '#3b73d9' },
  'Natus Vincere': { tag: 'NAVI', color: '#f7e11b' },
  'Luminosity Gaming': { tag: 'LG', color: '#3a8fd8' },
  'Team Liquid': { tag: 'TL', color: '#2a5fa8' },
  'Astralis': { tag: 'AST', color: '#e8374a' },
  'Gambit Esports': { tag: 'GMB', color: '#d8272f' },
  'FaZe Clan': { tag: 'FAZE', color: '#e4002b' },
  'MIBR': { tag: 'MIBR', color: '#e9e9e9' },
  'ENCE': { tag: 'ENCE', color: '#1b78c4' },
  'AVANGAR': { tag: 'AVG', color: '#c43b3b' },
  'Renegades': { tag: 'RNG', color: '#c7a14a' },
  'Team Vitality': { tag: 'VIT', color: '#ffe500' },
  'G2 Esports': { tag: 'G2', color: '#f23a2f' },
  'Heroic': { tag: 'HRC', color: '#f25c3a' },
  'Outsiders': { tag: 'OUT', color: '#b53fd1' },
  'FURIA Esports': { tag: 'FUR', color: '#c9c9c9' },
  'MOUZ': { tag: 'MOUZ', color: '#e2173b' },
  'Team Spirit': { tag: 'TS', color: '#dcdcdc' },
  'Eternal Fire': { tag: 'EF', color: '#ff7a1a' },
  'The MongolZ': { tag: 'MNG', color: '#e8b43c' },
  'Team Falcons': { tag: 'FLC', color: '#1fae6a' },
  'Aurora Gaming': { tag: 'AUR', color: '#8b5cf6' },
};

const WIKI = 'https://en.wikipedia.org/wiki/';
const lq = (q: string) => `https://liquipedia.net/counterstrike/index.php?search=${encodeURIComponent(q)}`;

export const pid = (nick: string) => nick.toLowerCase().replace(/[^a-z0-9]/g, '');

// "nick:ROLE/ROLE:rating"
//
// Dailies must not change once they've started, so data changes only reach future dailies:
// - A new roster gets `{ since: '<tomorrow>' }` as its last element.
// - A roster is never deleted: give it `{ until: '<today>' }` instead.
// - Changing an existing roster's players, roles or ratings changes every daily it appears in, past ones included.
type Row = [org: string, year: number, event: string, dates: string, result: string, wikiPage: string, players: string[], opts?: { since?: string; until?: string }];

const ROWS: Row[] = [
  ['Ninjas in Pyjamas', 2014, 'EMS One Katowice 2014', 'Mar 13–16, 2014', 'Runner-up', 'EMS_One_Katowice_2014',
    ['f0rest:ENTRY/LURK:91', 'GeT_RiGhT:LURK/ENTRY:93', 'Xizt:IGL/SUP:80', 'friberg:ENTRY/SUP:82', 'Fifflaren:SUP/AWP:78']],
  ['Virtus.pro', 2014, 'EMS One Katowice 2014', 'Mar 13–16, 2014', 'Champions', 'EMS_One_Katowice_2014',
    ['TaZ:IGL/ENTRY:81', 'NEO:LURK/SUP/IGL:87', 'pashaBiceps:AWP/ENTRY:83', 'Snax:LURK/ENTRY:89', 'byali:ENTRY/SUP:82']],
  ['Team Dignitas', 2014, 'ESL One Cologne 2014', 'Aug 14–17, 2014', 'Semifinalist', 'ESL_One_Cologne_2014',
    ['FeTiSh:IGL/SUP:76', 'dev1ce:AWP:86', 'aizy:ENTRY/LURK:80', 'dupreeh:ENTRY/SUP:84', 'Xyp9x:SUP/LURK:82']],
  ['Cloud9', 2014, 'ESL One Cologne 2014', 'Aug 14–17, 2014', 'Quarterfinalist', 'ESL_One_Cologne_2014',
    ['sgares:IGL/SUP:76', 'Semphis:AWP/SUP:78', 'shroud:ENTRY/LURK:84', 'n0thing:LURK/SUP:81', 'Hiko:SUP/LURK:83']],
  ['Fnatic', 2015, 'ESL One Katowice 2015', 'Mar 12–15, 2015', 'Champions', 'ESL_One_Katowice_2015',
    ['pronax:IGL/SUP:79', 'JW:AWP/ENTRY:89', 'olofmeister:ENTRY/AWP:95', 'flusha:LURK/SUP:90', 'KRiMZ:SUP/LURK:89']],
  ['Team EnVyUs', 2015, 'DreamHack Open Cluj-Napoca 2015', 'Oct 28 – Nov 1, 2015', 'Champions', 'DreamHack_Open_Cluj-Napoca_2015',
    ['Happy:IGL/ENTRY:83', 'kennyS:AWP:93', 'apEX:ENTRY:84', 'NBK-:LURK/SUP:86', 'kioShiMa:SUP/ENTRY:80']],
  ['Natus Vincere', 2016, 'MLG Major Championship: Columbus', 'Mar 29 – Apr 3, 2016', 'Runner-up', 'MLG_Major_Championship:_Columbus',
    ['Zeus:IGL/SUP:78', 'GuardiaN:AWP:90', 'seized:ENTRY/SUP:84', 'flamie:ENTRY/LURK:85', 'Edward:LURK/SUP:84']],
  ['Luminosity Gaming', 2016, 'MLG Major Championship: Columbus', 'Mar 29 – Apr 3, 2016', 'Champions', 'MLG_Major_Championship:_Columbus',
    ['FalleN:IGL/AWP:89', 'coldzera:LURK/ENTRY:93', 'fer:ENTRY:89', 'fnx:LURK/SUP:81', 'TACO:SUP:80']],
  ['Team Liquid', 2016, 'ESL One Cologne 2016', 'Jul 5–10, 2016', 'Runner-up', 'ESL_One_Cologne_2016',
    ['nitr0:IGL/SUP:78', 's1mple:AWP/ENTRY/LURK:94', 'Hiko:LURK/SUP:82', 'EliGE:ENTRY/LURK:84', 'jdm64:AWP/SUP:80']],
  ['Astralis', 2017, 'ELEAGUE Major: Atlanta 2017', 'Jan 22–29, 2017', 'Champions', 'ELEAGUE_Major_2017',
    ['gla1ve:IGL/SUP:80', 'dev1ce:AWP:92', 'Kjaerbye:ENTRY/LURK:86', 'dupreeh:ENTRY/SUP:87', 'Xyp9x:SUP/LURK:87']],
  ['Virtus.pro', 2017, 'ELEAGUE Major: Atlanta 2017', 'Jan 22–29, 2017', 'Runner-up', 'ELEAGUE_Major_2017',
    ['NEO:IGL/LURK/SUP:84', 'TaZ:ENTRY/SUP:79', 'pashaBiceps:AWP/ENTRY:80', 'Snax:LURK/ENTRY:88', 'byali:ENTRY/SUP:83']],
  ['Gambit Esports', 2017, 'PGL Major: Kraków 2017', 'Jul 16–23, 2017', 'Champions', 'PGL_Major:_Krak%C3%B3w_2017',
    ['Zeus:IGL/SUP:80', 'mou:AWP:85', 'Dosia:ENTRY/SUP:83', 'AdreN:SUP/LURK:86', 'HObbit:LURK/ENTRY:89']],
  ['Cloud9', 2018, 'ELEAGUE Major: Boston 2018', 'Jan 12–28, 2018', 'Champions', 'ELEAGUE_Major:_Boston_2018',
    ['tarik:IGL/SUP:81', 'Skadoodle:AWP:86', 'Stewie2K:ENTRY:87', 'RUSH:SUP/ENTRY:84', 'autimatic:LURK/SUP:86']],
  ['FaZe Clan', 2018, 'ELEAGUE Major: Boston 2018', 'Jan 12–28, 2018', 'Runner-up', 'ELEAGUE_Major:_Boston_2018',
    ['karrigan:IGL/SUP:78', 'GuardiaN:AWP:89', 'NiKo:ENTRY/LURK:94', 'olofmeister:SUP/ENTRY:87', 'rain:ENTRY/LURK:89']],
  ['Astralis', 2018, 'FACEIT Major: London 2018', 'Sep 5–23, 2018', 'Champions', 'FACEIT_Major:_London_2018',
    ['gla1ve:IGL/SUP:84', 'dev1ce:AWP:95', 'Magisk:LURK/SUP:90', 'dupreeh:ENTRY/SUP:89', 'Xyp9x:SUP/LURK:90']],
  ['Natus Vincere', 2018, 'FACEIT Major: London 2018', 'Sep 5–23, 2018', 'Runner-up', 'FACEIT_Major:_London_2018',
    ['Zeus:IGL/SUP:79', 's1mple:AWP/LURK:98', 'electronic:ENTRY/LURK:90', 'flamie:ENTRY/SUP:84', 'Edward:SUP/LURK:80']],
  ['MIBR', 2018, 'FACEIT Major: London 2018', 'Sep 5–23, 2018', 'Semifinalist', 'FACEIT_Major:_London_2018',
    ['FalleN:IGL/AWP:86', 'coldzera:LURK/ENTRY:91', 'fer:ENTRY:86', 'Stewie2K:ENTRY/SUP:85', 'tarik:SUP/LURK:82']],
  ['Team Liquid', 2018, 'FACEIT Major: London 2018', 'Sep 5–23, 2018', 'Semifinalist', 'FACEIT_Major:_London_2018',
    ['nitr0:IGL/AWP:82', 'EliGE:ENTRY/LURK:90', 'NAF:LURK/SUP:89', 'Twistzz:ENTRY/LURK:90', 'TACO:SUP:80']],
  ['ENCE', 2019, 'IEM Katowice Major 2019', 'Feb 13 – Mar 3, 2019', 'Runner-up', 'IEM_Katowice_Major_2019',
    ['Aleksib:IGL/SUP:78', 'allu:AWP:86', 'sergej:ENTRY:88', 'Aerial:SUP/LURK:83', 'xseveN:LURK/SUP:84']],
  ['AVANGAR', 2019, 'StarLadder Major: Berlin 2019', 'Aug 23 – Sep 8, 2019', 'Runner-up', 'StarLadder_Major:_Berlin_2019',
    ['AdreN:IGL/SUP:80', 'Jame:AWP/IGL:88', 'buster:ENTRY/SUP:85', 'qikert:SUP/ENTRY:85', 'Sanji:LURK:83']],
  ['Renegades', 2019, 'StarLadder Major: Berlin 2019', 'Aug 23 – Sep 8, 2019', 'Semifinalist', 'StarLadder_Major:_Berlin_2019',
    ['AZR:IGL/SUP:78', 'Gratisfaction:AWP:84', 'jks:ENTRY/LURK:87', 'Liazz:ENTRY/SUP:82', 'jkaem:SUP/LURK:81']],
  ['Team Vitality', 2019, 'StarLadder Major: Berlin 2019', 'Aug 23 – Sep 8, 2019', 'Quarterfinalist', 'StarLadder_Major:_Berlin_2019',
    ['ALEX:IGL/SUP:79', 'ZywOo:AWP:95', 'apEX:ENTRY/IGL:83', 'NBK-:SUP/LURK:80', 'RpK:LURK/SUP:83']],
  ['Natus Vincere', 2021, 'PGL Major Stockholm 2021', 'Oct 26 – Nov 7, 2021', 'Champions', 'PGL_Major_Stockholm_2021',
    ['Boombl4:IGL/SUP:79', 's1mple:AWP/LURK:99', 'electroNic:LURK/ENTRY:90', 'b1t:ENTRY/SUP:87', 'Perfecto:SUP/LURK:86']],
  ['G2 Esports', 2021, 'PGL Major Stockholm 2021', 'Oct 26 – Nov 7, 2021', 'Runner-up', 'PGL_Major_Stockholm_2021',
    ['nexa:IGL/SUP:79', 'AmaNEk:AWP/SUP/LURK:84', 'NiKo:ENTRY/LURK:92', 'huNter-:LURK/SUP:88', 'JaCkz:ENTRY/SUP:82']],
  ['Heroic', 2021, 'PGL Major Stockholm 2021', 'Oct 26 – Nov 7, 2021', 'Semifinalist', 'PGL_Major_Stockholm_2021',
    ['cadiaN:IGL/AWP:85', 'stavn:ENTRY/LURK:88', 'TeSeS:SUP/ENTRY:85', 'refrezh:SUP/LURK:82', 'sjuush:LURK/SUP:83']],
  ['Gambit Esports', 2021, 'PGL Major Stockholm 2021', 'Oct 26 – Nov 7, 2021', 'Semifinalist', 'PGL_Major_Stockholm_2021',
    ['nafany:IGL/SUP:80', 'sh1ro:AWP:92', 'Ax1Le:LURK/ENTRY:91', 'interz:SUP:81', 'HObbit:LURK/SUP:86']],
  ['FaZe Clan', 2022, 'PGL Major Antwerp 2022', 'May 9–22, 2022', 'Champions', 'PGL_Major_Antwerp_2022',
    ['karrigan:IGL/SUP:81', 'broky:AWP:88', 'rain:ENTRY/SUP:86', 'Twistzz:ENTRY/SUP:89', 'ropz:LURK:92']],
  ['ENCE', 2022, 'PGL Major Antwerp 2022', 'May 9–22, 2022', 'Semifinalist', 'PGL_Major_Antwerp_2022',
    ['Snappi:IGL/SUP:78', 'hades:AWP:84', 'Spinx:LURK/ENTRY:87', 'dycha:SUP/ENTRY:83', 'maden:ENTRY:83']],
  ['Outsiders', 2022, 'IEM Rio Major 2022', 'Oct 31 – Nov 13, 2022', 'Champions', 'IEM_Rio_Major_2022',
    ['Jame:AWP/IGL:88', 'FL1T:ENTRY/SUP:85', 'fame:LURK/ENTRY:85', 'n0rb3r7:ENTRY:83', 'qikert:SUP/LURK:84']],
  ['Heroic', 2022, 'IEM Rio Major 2022', 'Oct 31 – Nov 13, 2022', 'Runner-up', 'IEM_Rio_Major_2022',
    ['cadiaN:IGL/AWP:86', 'stavn:ENTRY/LURK:89', 'TeSeS:SUP/ENTRY:87', 'jabbi:ENTRY/LURK:85', 'sjuush:SUP/LURK:83']],
  ['FURIA Esports', 2022, 'IEM Rio Major 2022', 'Oct 31 – Nov 13, 2022', 'Semifinalist', 'IEM_Rio_Major_2022',
    ['arT:IGL/ENTRY:81', 'saffee:AWP:85', 'KSCERATO:LURK/SUP:89', 'yuurih:SUP/LURK:87', 'drop:ENTRY/SUP:82']],
  ['MOUZ', 2022, 'IEM Rio Major 2022', 'Oct 31 – Nov 13, 2022', 'Semifinalist', 'IEM_Rio_Major_2022',
    ['dexter:IGL/SUP:78', 'torzsi:AWP:86', 'frozen:LURK/ENTRY:88', 'JDC:ENTRY/SUP:80', 'xertioN:ENTRY:84']],
  ['Natus Vincere', 2024, 'PGL Major Copenhagen 2024', 'Mar 17–31, 2024', 'Champions', 'PGL_Major_Copenhagen_2024',
    ['Aleksib:IGL/SUP:80', 'w0nderful:AWP:87', 'jL:ENTRY/SUP:89', 'iM:LURK/ENTRY:86', 'b1t:SUP/ENTRY:88']],
  ['FaZe Clan', 2024, 'PGL Major Copenhagen 2024', 'Mar 17–31, 2024', 'Runner-up', 'PGL_Major_Copenhagen_2024',
    ['karrigan:IGL/SUP:79', 'broky:AWP:87', 'rain:ENTRY/SUP:85', 'frozen:LURK/SUP:88', 'ropz:LURK/SUP:91']],
  ['G2 Esports', 2024, 'PGL Major Copenhagen 2024', 'Mar 17–31, 2024', 'Semifinalist', 'PGL_Major_Copenhagen_2024',
    ['HooXi:IGL/ENTRY:74', 'm0NESY:AWP:94', 'NiKo:ENTRY/LURK:93', 'huNter-:LURK/SUP:88', 'nexa:SUP/IGL:82']],
  ['Team Vitality', 2024, 'PGL Major Copenhagen 2024', 'Mar 17–31, 2024', 'Semifinalist', 'PGL_Major_Copenhagen_2024',
    ['apEX:IGL/ENTRY:82', 'ZywOo:AWP:96', 'flameZ:ENTRY:87', 'Spinx:LURK/SUP:88', 'mezii:SUP/LURK:83']],
  ['Eternal Fire', 2024, 'PGL Major Copenhagen 2024', 'Mar 17–31, 2024', 'Quarterfinalist', 'PGL_Major_Copenhagen_2024',
    ['MAJ3R:IGL/SUP:77', 'woxic:AWP:86', 'XANTARES:ENTRY/LURK:90', 'Calyx:SUP/LURK:82', 'Wicadia:ENTRY/LURK:85']],
  ['Team Spirit', 2024, 'Perfect World Shanghai Major 2024', 'Nov 30 – Dec 15, 2024', 'Champions', 'Perfect_World_Shanghai_Major_2024',
    ['chopper:IGL/SUP:81', 'sh1ro:AWP:91', 'donk:ENTRY:98', 'zont1x:SUP/LURK:85', 'magixx:LURK/SUP:84']],
  ['MOUZ', 2024, 'Perfect World Shanghai Major 2024', 'Nov 30 – Dec 15, 2024', 'Semifinalist', 'Perfect_World_Shanghai_Major_2024',
    ['siuhy:IGL/SUP:80', 'torzsi:AWP:89', 'xertioN:ENTRY:88', 'Brollan:LURK/SUP:87', 'Jimpphat:SUP/LURK:88']],
  ['The MongolZ', 2024, 'Perfect World Shanghai Major 2024', 'Nov 30 – Dec 15, 2024', 'Quarterfinalist', 'Perfect_World_Shanghai_Major_2024',
    ['bLitz:IGL/SUP:80', '910:AWP:87', 'Senzu:ENTRY/LURK:87', 'mzinho:ENTRY/LURK:89', 'Techno4K:SUP/LURK:84']],
  ['Team Vitality', 2025, 'StarLadder Budapest Major 2025', 'Nov 24 – Dec 14, 2025', 'Champions', 'StarLadder_Budapest_Major_2025',
    ['apEX:IGL/ENTRY:83', 'ZywOo:AWP:97', 'flameZ:ENTRY:89', 'ropz:LURK/SUP:92', 'mezii:SUP/LURK:86']],
  ['FaZe Clan', 2025, 'StarLadder Budapest Major 2025', 'Nov 24 – Dec 14, 2025', 'Runner-up', 'StarLadder_Budapest_Major_2025',
    ['karrigan:IGL/SUP:79', 'broky:AWP:86', 'jcobbb:ENTRY/SUP:84', 'frozen:LURK/SUP:88', 'rain:ENTRY/SUP:83']],
  ['Team Spirit', 2025, 'StarLadder Budapest Major 2025', 'Nov 24 – Dec 14, 2025', 'Semifinalist', 'StarLadder_Budapest_Major_2025',
    ['chopper:IGL/SUP:80', 'sh1ro:AWP:90', 'donk:ENTRY:97', 'zont1x:SUP/LURK:84', 'zweih:LURK/ENTRY:85']],
  ['Team Falcons', 2026, 'IEM Cologne Major 2026', 'Jun 2–21, 2026', 'Champions', 'IEM_Cologne_Major_2026',
    ['kyxsan:IGL/SUP:80', 'm0NESY:AWP:96', 'NiKo:ENTRY/LURK:91', 'kyousuke:ENTRY/LURK:90', 'TeSeS:SUP/LURK:85']],
  ['FURIA Esports', 2026, 'IEM Cologne Major 2026', 'Jun 2–21, 2026', 'Runner-up', 'IEM_Cologne_Major_2026',
    ['FalleN:IGL/AWP:79', 'molodoy:AWP/SUP:89', 'YEKINDAR:ENTRY:88', 'KSCERATO:LURK/SUP:90', 'yuurih:SUP/LURK:87']],
  ['Aurora Gaming', 2026, 'IEM Cologne Major 2026', 'Jun 2–21, 2026', 'Semifinalist', 'IEM_Cologne_Major_2026',
    ['MAJ3R:IGL/SUP:77', 'woxic:AWP:87', 'XANTARES:ENTRY/LURK:89', 'Wicadia:LURK/ENTRY:87', 'soulfly:SUP/ENTRY:83']],
];

// A few people appear under different spellings across sources; keep one display name per person.
const DISPLAY: Record<string, string> = { electronic: 'electroNic', hobbit: 'HObbit', elige: 'EliGE', getright: 'GeT_RiGhT', nbk: 'NBK-' };

// Images: player photos and team logos from bo3.gg's public pages, with freely licensed Wikimedia Commons
// files filling gaps (see CREDITS). Cropped and embedded at build time by scripts/build-media.mjs.
interface Media { src: string; source: string; file: string; author: string; license: string; page: string }
const PHOTOS = media.players as Record<string, Media>;
const LOGOS = media.logos as Record<string, Media>;
export const CREDITS = {
  photos: Object.entries(PHOTOS).map(([id, m]) => ({ id, ...m, src: undefined })),
  logos: Object.entries(LOGOS).map(([org, m]) => ({ id: org, ...m, src: undefined })),
};

export const ROSTERS: Roster[] = ROWS.map(([org, year, event, dates, result, page, ps, opts]) => {
  const o = ORG[org] ?? { tag: org.slice(0, 3).toUpperCase(), color: '#c9a45c' };
  const id = `${pid(org)}-${year}-${pid(event).slice(0, 10)}`;
  return {
    id, org, tag: o.tag, color: o.color, year, event, dates, result,
    sourceUrl: WIKI + page,
    liquipediaUrl: lq(event),
    logo: LOGOS[org]?.src,
    since: opts?.since,
    until: opts?.until,
    players: ps.map((s) => {
      const [nick, roles, r] = s.split(':');
      const id = pid(nick);
      return { id, nick: DISPLAY[id] ?? nick, roles: roles.split('/') as Role[], rating: Number(r), portrait: PHOTOS[id]?.src };
    }),
  };
});

export const playerLiquipedia = (nick: string) => lq(nick);

/** The rosters a daily on `date` (YYYY-MM-DD) draws from: later data additions and retirements don't change it. */
export const rostersOn = (date: string) => ROSTERS.filter((r) => (!r.since || r.since <= date) && (!r.until || date <= r.until));
/** Free play draws from every roster that isn't retired. */
export const activeRosters = () => ROSTERS.filter((r) => !r.until);
