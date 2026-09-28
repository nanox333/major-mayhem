// Lifetime stats, kept in this browser next to the run save.
import * as G from './logic';
import { Run, dailyDate, dailyNumber } from './state';
import { shareText } from './share';

export interface DailyResult { placement: string; reached: number; mvp: string; grade: number | null; share?: string }
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
}

const KEY = 'major-mayhem-stats-v1';
export const emptyStats = (): Stats => ({ v: 1, runs: 0, titles: 0, reached: [0, 0, 0, 0, 0], streak: 0, bestStreak: 0, drafted: {}, daily: {} });

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
  const mine = G.lineupFromPicks(run.picks);
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
  return next;
}

export function recordRun(run: Run): Stats {
  const next = addRun(loadStats(), run);
  saveStats(next);
  return next;
}

/** Days in a row with a finished daily. The current streak still counts if today's isn't played yet. */
export function dailyStreak(daily: Stats['daily'], today: string): { current: number; best: number } {
  const days = new Set(Object.keys(daily).map(dailyNumber));
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
