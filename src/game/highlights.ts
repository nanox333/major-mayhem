import type { MapGame } from './match';
import { sideAt } from './sides';

/** What each legendary moment is called in lists (the on-screen card has its own, bigger wording). */
export const LEGEND_NAME = { ace: 'Ace', clutch5: '1v5 clutch', flawless: 'Flawless victory', miracle: 'Miracle comeback' } as const;

export interface Moment {
  kind: 'mvp' | 'legend' | 'pistol' | 'clutch' | 'run' | 'half' | 'comeback' | 'ot';
  /** First round it covers (shown as "R14"), or null for the map as a whole. */
  round: number | null;
  good: boolean | null;
  title: string;
  text: string;
}

/** The moments of a finished map worth a look, read straight from its results: nothing here is made up. */
export function keyMoments(game: MapGame, theirTag: string): Moment[] {
  const r = game.rounds;
  const out: Moment[] = [];
  const mvp = [...game.stats.mine].sort((x, y) => y.rating - x.rating)[0];
  if (mvp) out.push({ kind: 'mvp', round: null, good: true, title: 'Map MVP', text: `${mvp.nick}: ${mvp.k} kills, ${mvp.d} deaths, ${mvp.rating.toFixed(2)} rating.` });
  // Legendary moments (#292) lead the list: they are the thing to remember from the map.
  for (const e of game.events) if (e.kind === 'legend') out.push({ kind: 'legend', round: e.round, good: true, title: LEGEND_NAME[e.legend ?? 'ace'], text: e.text });
  for (const p of [0, 12]) if (r.length > p) out.push({ kind: 'pistol', round: p + 1, good: r[p], title: r[p] ? 'Pistol round won' : 'Pistol round lost', text: `${r[p] ? 'You' : theirTag} took the pistol round on ${r[p] ? sideAt(p, game.start) : sideAt(p, game.start) === 'T' ? 'CT' : 'T'}.` });
  for (const e of game.events) if (e.kind === 'clutch') out.push({ kind: 'clutch', round: e.round, good: e.good, title: e.good ? 'Clutch' : 'Clutched against you', text: e.text });
  // the longest winning streak for each side
  for (const mine of [true, false]) {
    let best = 0, bestAt = 0, run = 0;
    r.forEach((w, i) => { if (w === mine) { run++; if (run > best) { best = run; bestAt = i - run + 1; } } else run = 0; });
    if (best >= 4) out.push({ kind: 'run', round: bestAt + 1, good: mine, title: `${best} in a row`, text: `${mine ? 'You' : theirTag} won rounds ${bestAt + 1} to ${bestAt + best}.` });
  }
  if (r.length >= 12) {
    const a = r.slice(0, 12).filter(Boolean).length;
    out.push({ kind: 'half', round: 12, good: null, title: 'Halftime', text: `${a}–${12 - a}, you started on ${game.start}.` });
  }
  // the biggest hole you climbed out of, or the biggest lead you let go
  let diff = 0, low = 0, high = 0;
  for (const w of r) { diff += w ? 1 : -1; low = Math.min(low, diff); high = Math.max(high, diff); }
  if (game.won && low <= -4) out.push({ kind: 'comeback', round: null, good: true, title: 'Comeback', text: `You were ${-low} rounds down and still won.` });
  else if (!game.won && high >= 4) out.push({ kind: 'comeback', round: null, good: false, title: 'Lead thrown away', text: `You were ${high} rounds up and still lost.` });
  if (r.length > 24) out.push({ kind: 'ot', round: 25, good: null, title: 'Overtime', text: `Level at 12–12 after regulation; it went to round ${r.length}.` });
  return out.sort((x, y) => (x.kind === 'mvp' ? -1 : y.kind === 'mvp' ? 1 : x.kind === 'legend' && y.kind !== 'legend' ? -1 : y.kind === 'legend' && x.kind !== 'legend' ? 1 : (x.round ?? 99) - (y.round ?? 99)));
}
