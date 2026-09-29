// Lifetime stats, kept in this browser next to the run save.
import * as G from './logic';
import { Run, dailyDate, dailyNumber, squadOf } from './state';
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
}

const KEY = 'major-mayhem-stats-v1';
export const emptyStats = (): Stats => ({ v: 1, runs: 0, titles: 0, reached: [0, 0, 0, 0, 0], streak: 0, bestStreak: 0, drafted: {}, daily: {}, ach: {}, lastNew: [] });

export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? JSON.parse(raw) : null;
    return s?.v === 1 ? { ...emptyStats(), ...s } : emptyStats();
  } catch { return emptyStats(); }
}
const saveStats = (s: Stats) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } };

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
  if (date && !next.daily[date]) next.daily[date] = { placement: pl.label, reached: pl.reached, mvp: G.mvp(run.t, mine).player.nick, grade: G.draftReview(run.picks).grade, share: shareText(run) };
  const earned = newAchievements(run, { streak: next.streak, dailyStreak: date ? dailyStreak(next.daily, date).current : 0 }, st.ach ?? {});
  const day = date ?? new Date().toISOString().slice(0, 10);
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
