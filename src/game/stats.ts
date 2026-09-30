// Lifetime stats, kept in this browser next to the run save.
import * as G from './logic';
import { Run, dailyDate, dailyNumber, squadOf, today } from './state';
import { shareText } from './share';
import { newAchievements } from './achievements';

export interface DailyResult { placement: string; reached: number; mvp: string; grade: number | null; share?: string; abandoned?: boolean }
export interface Stats {
  v: 1;
  runs: number;
  titles: number;
  /** Runs by furthest stage reached: 0 qual, 1 QF, 2 SF, 3 final, 4 champion. */
  reached: [number, number, number, number, number];
  /** Titles in a row, and the best such streak. */
  streak: number;
  bestStreak: number;
  /** How often each player was drafted, by player id. */
  drafted: Record<string, number>;
  /** First finished result for each daily, by date. */
  daily: Record<string, DailyResult>;
  /** Achievements earned: id → date (YYYY-MM-DD). */
  ach: Record<string, string>;
  /** Achievements earned by the last finished run, for the results screen. */
  lastNew: string[];
  /** Draft duel showmatches won and lost. */
  duels: { w: number; l: number };
  /**
   * Major runs and titles split by mode, so like can be compared with like (#67). Only counted for runs finished
   * since this was added (`since`); `runs`/`titles` above stay the all-time totals. Free play is keyed by its options.
   */
  byMode?: { since: string; daily: ModeTally; free: Record<string, ModeTally> };
}
export interface ModeTally { runs: number; titles: number }
/** A key for free-play options, e.g. "cs2+hard", or "all" with none. */
export const optsKey = (o?: { era?: string; pool?: string; hard?: boolean }) => [o?.era, o?.pool, o?.hard ? 'hard' : undefined].filter(Boolean).join('+') || 'all';

const KEY = 'major-mayhem-stats-v1';
export const emptyStats = (): Stats => ({ v: 1, runs: 0, titles: 0, reached: [0, 0, 0, 0, 0], streak: 0, bestStreak: 0, drafted: {}, daily: {}, ach: {}, lastNew: [], duels: { w: 0, l: 0 } });

export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? JSON.parse(raw) : null;
    return s?.v === 1 ? { ...emptyStats(), ...s } : emptyStats();
  } catch { return emptyStats(); }
}
const saveStats = (s: Stats) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } };

/** Which parts of the stats screen have something to show. Each is independent (#64). */
export const statsSections = (s: Stats) => {
  const runs = s.runs > 0, duels = (s.duels?.w ?? 0) + (s.duels?.l ?? 0) > 0, dailies = Object.keys(s.daily).length > 0;
  return { runs, duels, dailies, empty: !runs && !duels && !dailies };
};

/** Pure: the stats after adding one finished run. */
export function addRun(st: Stats, run: Run): Stats {
  const pl = G.placement(run.t);
  const mine = squadOf(run);
  const champ = pl.key === 'CHAMP';
  const next: Stats = {
    ...st,
    runs: st.runs + 1,
    titles: st.titles + (champ ? 1 : 0),
    reached: st.reached.map((n, i) => n + (i === pl.reached ? 1 : 0)) as Stats['reached'],
    streak: champ ? st.streak + 1 : 0,
    bestStreak: Math.max(st.bestStreak, champ ? st.streak + 1 : 0),
    drafted: { ...st.drafted },
    daily: { ...st.daily },
  };
  for (const p of run.picks) next.drafted[p.playerId] = (next.drafted[p.playerId] ?? 0) + 1;
  const date = dailyDate(run);
  const bm = st.byMode ?? { since: date ?? today(), daily: { runs: 0, titles: 0 }, free: {} };
  const bump = (t: ModeTally = { runs: 0, titles: 0 }) => ({ runs: t.runs + 1, titles: t.titles + (champ ? 1 : 0) });
  next.byMode = date
    ? { ...bm, daily: bump(bm.daily) }
    : { ...bm, free: { ...bm.free, [optsKey(run.opts)]: bump(bm.free[optsKey(run.opts)]) } };
  if (date && !next.daily[date]) next.daily[date] = { placement: pl.label, reached: pl.reached, mvp: G.mvp(run.t, mine).player.nick, grade: G.draftReview(run.picks).grade, share: shareText(run) };
  const earned = newAchievements(run, { streak: next.streak, dailyStreak: date ? dailyStreak(next.daily, date).current : 0 }, st.ach ?? {});
  // The same local date the daily uses (#26), not UTC, so both agree around midnight.
  const day = date ?? today();
  next.ach = { ...(st.ach ?? {}), ...Object.fromEntries(earned.map((id) => [id, day])) };
  next.lastNew = earned;
  return next;
}

/**
 * A daily is deterministic, so resetting it and playing again would mean replaying with hindsight. Once a case is
 * opened, resetting records the daily as abandoned; it can't be played for a result again in this browser.
 * (Clearing site data gets round this; anything competitive would need results checked on a server.)
 */
export const dailyStarted = (run: Run) => !!dailyDate(run) && run.offerKey > 0 && run.phase !== 'final';

export function addAbandon(st: Stats, run: Run): Stats {
  const date = dailyDate(run);
  if (!date || st.daily[date]) return st;
  const pl = G.placement(run.t);
  const share = `Major Mayhem Daily #${dailyNumber(date)} 🏳️ Abandoned`;
  return { ...st, daily: { ...st.daily, [date]: { placement: 'Abandoned', reached: run.t.matches.length ? pl.reached : 0, mvp: '–', grade: null, share, abandoned: true } } };
}

export function abandonDaily(run: Run): Stats {
  const next = addAbandon(loadStats(), run);
  saveStats(next);
  return next;
}

/** A duel doesn't count as a Major run: it only adds to the duel record. */
export function recordDuel(run: Run): Stats {
  const st = loadStats();
  const won = run.t.status === 'champion';
  const next = { ...st, duels: { w: st.duels.w + (won ? 1 : 0), l: st.duels.l + (won ? 0 : 1) }, lastNew: [] };
  saveStats(next);
  return next;
}

export function recordRun(run: Run): Stats {
  const next = addRun(loadStats(), run);
  saveStats(next);
  return next;
}

/** Days in a row with a finished (not abandoned) daily. The current streak still counts if today's isn't played yet. */
export function dailyStreak(daily: Stats['daily'], today: string): { current: number; best: number } {
  const days = new Set(Object.entries(daily).filter(([, d]) => !d.abandoned).map(([date]) => dailyNumber(date)));
  let best = 0;
  for (const d of days) {
    if (days.has(d - 1)) continue;
    let n = 1;
    while (days.has(d + n)) n++;
    best = Math.max(best, n);
  }
  let d = dailyNumber(today);
  if (!days.has(d)) d--;
  let current = 0;
  while (days.has(d - current)) current++;
  return { current, best };
}

/** One day in the "last dailies" chart (#76): played with a finish, abandoned, or not played. */
export interface DayBar { date: string; n: number; state: 'played' | 'abandoned' | 'missed'; reached: number; placement?: string }
/** A finish as a few letters, for under a bar: 0 Swiss out, 1 quarterfinal, 2 semifinal, 3 runner-up, 4 champion. */
export const FINISH_SHORT = ['Sw', 'QF', 'SF', '2nd', '1st'];
/**
 * The last `count` days up to and including `upTo`, oldest first, each with its finish (the first finished run that day, as `daily` keeps it).
 * Days you didn't play are there too, as gaps, so the chart is a record over time and not just a list of results.
 */
export function recentDailies(daily: Stats['daily'], upTo: string, count = 14): DayBar[] {
  const out: DayBar[] = [];
  const end = Date.parse(upTo + 'T00:00:00Z');
  for (let k = count - 1; k >= 0; k--) {
    const d = new Date(end - k * 86400000);
    const date = d.toISOString().slice(0, 10);
    const r = daily[date];
    out.push(!r ? { date, n: dailyNumber(date), state: 'missed', reached: 0 }
      : r.abandoned ? { date, n: dailyNumber(date), state: 'abandoned', reached: 0 }
        : { date, n: dailyNumber(date), state: 'played', reached: Math.max(0, Math.min(4, r.reached)), placement: r.placement });
  }
  return out;
}
