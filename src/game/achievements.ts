// Achievements, checked once when a run finishes. Stored with the lifetime stats (date earned, by id).
import * as G from './logic';
import { Run, squadOf } from './state';
import { DUOS, nationCore } from './synergy';

export interface AchievementCtx {
  /** Majors won in a row, including this run. */
  streak: number;
  /** Dailies finished in a row, including this run. */
  dailyStreak: number;
  /** Legendary moments seen so far, by kind, including this run. */
  legends?: Partial<Record<G.LegendKind, number>>;
}
export interface Achievement { id: string; name: string; desc: string; test: (run: Run, ctx: AchievementCtx) => boolean }

/** The legendary moments your team had in a run (#292). */
export const legendsOf = (r: Run) => r.t.matches.flatMap((m) => m.maps).flatMap((g) => g.events.filter((e) => e.kind === 'legend' && !!e.legend));
const champ = (r: Run) => G.placement(r.t).key === 'CHAMP';
const maps = (r: Run) => r.t.matches.flatMap((m) => m.maps);
const starters = (r: Run) => G.lineupFromPicks(r.picks);
/** Your lead (negative when behind) before round `i` (0-based) of a map. */
const leadAt = (g: G.MapGame, i: number) => g.rounds.slice(0, i).reduce((s, w) => s + (w ? 1 : -1), 0);

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'witness', name: 'Witness', desc: 'See a legendary moment.', test: (_, c) => Object.keys(c.legends ?? {}).length > 0 },
  { id: 'ace', name: 'Ace in the hole', desc: 'One of your players aces a round.', test: (_, c) => (c.legends?.ace ?? 0) > 0 },
  { id: 'one-v-five', name: 'One versus five', desc: 'One of your players wins a 1v5 clutch.', test: (_, c) => (c.legends?.clutch5 ?? 0) > 0 },
  { id: 'collector', name: 'Collector', desc: 'See all four legendary moments: an ace, a 1v5, a flawless victory and a miracle comeback.', test: (_, c) => G.LEGENDS.every((k) => (c.legends?.[k] ?? 0) > 0) },
  { id: 'champion', name: 'Major Champions', desc: 'Win a Major.', test: champ },
  { id: 'flawless', name: 'Flawless', desc: 'Win a Major without dropping a map.', test: (r) => champ(r) && maps(r).every((g) => g.won) },
  { id: 'swiss-30', name: '3–0', desc: 'Go through the Swiss stage unbeaten.', test: (r) => r.t.qual.need === 3 && r.t.qual.w === 3 && r.t.qual.l === 0 },
  { id: 'survivor', name: 'Survivor', desc: 'Win a Major after going 2–2 in the Swiss stage.', test: (r) => champ(r) && r.t.qual.need === 3 && r.t.qual.l === 2 },
  { id: 'reverse-sweep', name: 'Reverse sweep', desc: 'Win a best-of-three after losing the first map.', test: (r) => r.t.matches.some((m) => m.bestOf === 3 && m.won && !!m.maps[0] && !m.maps[0].won) },
  { id: 'overtime', name: 'Overtime', desc: 'Win a map in overtime.', test: (r) => maps(r).some((g) => g.won && g.rounds.length > 24) },
  { id: 'comeback', name: 'Comeback', desc: 'Win a map after trailing by five or more at halftime.', test: (r) => maps(r).some((g) => g.won && g.rounds.length >= 12 && leadAt(g, 12) <= -5) },
  { id: 'timeout', name: 'Timeout!', desc: 'Win a map where you called a timeout four or more rounds down.', test: (r) => maps(r).some((g) => g.won && (g.calls?.timeouts ?? []).some((i) => leadAt(g, i) <= -4)) },
  { id: 'force', name: 'Force buy', desc: 'Win the round after forcing on a lost pistol.', test: (r) => maps(r).some((g) => (g.calls?.force ?? []).some((i) => g.rounds[i])) },
  { id: 'perfect-draft', name: 'Perfect draft', desc: 'Take the best pick on the board in every player round.', test: (r) => (G.draftReview(r.picks, !!r.opts?.hard).grade ?? 0) >= 0.9995 },
  { id: 'national-team', name: 'National team', desc: 'Win a Major with four or more players from one country.', test: (r) => { const c = nationCore(starters(r).map((x) => x.player)); return champ(r) && c.n >= 4 && c.key !== 'CIS'; } },
  { id: 'united-nations', name: 'United Nations', desc: 'Win a Major with five players from five countries.', test: (r) => champ(r) && new Set(starters(r).map((x) => x.player.country)).size === 5 },
  { id: 'duo', name: 'Dynamic duo', desc: 'Win a Major with a famous duo in your five.', test: (r) => { const ids = new Set(r.picks.map((p) => p.playerId)); return champ(r) && DUOS.some(([a, b]) => ids.has(a) && ids.has(b)); } },
  { id: 'two-awps', name: 'Two AWPs, one trophy', desc: 'Win a Major with two main AWPers.', test: (r) => champ(r) && starters(r).filter((x) => x.player.roles[0] === 'AWP').length >= 2 },
  { id: 'underdogs', name: 'Underdog story', desc: "Win a Major without anyone from a Major-winning lineup.", test: (r) => champ(r) && starters(r).every((x) => x.roster.result !== 'Champions') },
  { id: 'super-sub', name: 'Super sub', desc: 'Your bench player is the tournament MVP.', test: (r) => !!r.bench && G.mvp(r.t, squadOf(r)).player.id === r.bench.playerId },
  { id: 'hard-mode', name: 'No labels needed', desc: 'Win a Major on hard mode.', test: (r) => champ(r) && !!r.opts?.hard },
  { id: 'era', name: 'Era specialist', desc: 'Win a CS:GO-era or CS2-era Major.', test: (r) => champ(r) && !!r.opts?.era },
  { id: 'dynasty', name: 'Dynasty', desc: 'Win three Majors in a row.', test: (_, c) => c.streak >= 3 },
  { id: 'daily-3', name: 'Regular', desc: 'Finish the daily three days in a row.', test: (_, c) => c.dailyStreak >= 3 },
  { id: 'daily-7', name: 'Dedicated', desc: 'Finish the daily seven days in a row.', test: (_, c) => c.dailyStreak >= 7 },
];

/** The achievements this finished run earns that aren't in `have` yet. */
export const newAchievements = (run: Run, ctx: AchievementCtx, have: Record<string, string>) =>
  ACHIEVEMENTS.filter((a) => !have[a.id] && a.test(run, ctx)).map((a) => a.id);
export const achievementById = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
