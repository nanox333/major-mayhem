// Lifetime stats, kept in this browser next to the run save.
import * as G from './logic';
import { Run, dailyDate, dailyNumber, squadOf, today } from './state';
import { shareText } from './share';
import { newAchievements } from './achievements';
import { isRealDate } from './dates';
import { readKey, safeSet } from './persist';

/** `attempt` is the run that set this result: a later run of the same daily is practice (#162). Results from before it existed have none. */
export interface DailyResult { placement: string; reached: number; mvp: string; grade: number | null; share?: string; abandoned?: boolean; attempt?: string }
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
  /** The most recent attempts already counted, so a result is never counted twice across a reload or a second tab (#163). */
  attempts?: string[];
}
const MAX_ATTEMPTS = 200;
export interface ModeTally { runs: number; titles: number }
/** A key for free-play options, e.g. "cs2+hard", or "all" with none. */
export const optsKey = (o?: { era?: string; pool?: string; hard?: boolean }) => [o?.era, o?.pool, o?.hard ? 'hard' : undefined].filter(Boolean).join('+') || 'all';

export const STATS_KEY = 'major-mayhem-stats-v1';
export const emptyStats = (): Stats => ({ v: 1, runs: 0, titles: 0, reached: [0, 0, 0, 0, 0], streak: 0, bestStreak: 0, drafted: {}, daily: {}, ach: {}, lastNew: [], duels: { w: 0, l: 0 } });

const isObj = (x: unknown): x is Record<string, any> => typeof x === 'object' && x !== null && !Array.isArray(x);
const count = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
const tally = (x: unknown): ModeTally | null => (isObj(x) ? { runs: count(x.runs), titles: count(x.titles) } : null);

/**
 * Reads a record from whatever was saved, keeping every part that is valid and dropping the parts that are not, so one bad field never takes the rest of
 * a player's history with it, and nothing malformed can reach the screens (#164).
 */
export function sanitizeStats(raw: unknown): Stats {
  if (!isObj(raw) || raw.v !== 1) return emptyStats();
  const s = emptyStats();
  s.runs = count(raw.runs); s.titles = count(raw.titles); s.streak = count(raw.streak); s.bestStreak = count(raw.bestStreak);
  if (Array.isArray(raw.reached) && raw.reached.length === 5) s.reached = raw.reached.map(count) as Stats['reached'];
  if (isObj(raw.drafted)) for (const [k, v] of Object.entries(raw.drafted)) if (typeof v === 'number' && v > 0 && Number.isFinite(v)) s.drafted[k] = Math.floor(v);
  if (isObj(raw.daily)) {
    for (const [date, d] of Object.entries(raw.daily)) {
      if (!isRealDate(date) || !isObj(d) || typeof d.placement !== 'string' || typeof d.mvp !== 'string') continue;
      const reached = typeof d.reached === 'number' && Number.isInteger(d.reached) && d.reached >= 0 && d.reached <= 4 ? d.reached : 0;
      s.daily[date] = {
        placement: d.placement, reached, mvp: d.mvp, grade: typeof d.grade === 'number' && Number.isFinite(d.grade) ? d.grade : null,
        ...(typeof d.share === 'string' ? { share: d.share } : {}), ...(d.abandoned === true ? { abandoned: true } : {}), ...(typeof d.attempt === 'string' ? { attempt: d.attempt } : {}),
      };
    }
  }
  if (isObj(raw.ach)) for (const [k, v] of Object.entries(raw.ach)) if (typeof v === 'string') s.ach[k] = v;
  if (Array.isArray(raw.lastNew)) s.lastNew = raw.lastNew.filter((x: unknown): x is string => typeof x === 'string');
  if (isObj(raw.duels)) s.duels = { w: count(raw.duels.w), l: count(raw.duels.l) };
  if (isObj(raw.byMode) && typeof raw.byMode.since === 'string' && tally(raw.byMode.daily)) {
    const free: Record<string, ModeTally> = {};
    if (isObj(raw.byMode.free)) for (const [k, v] of Object.entries(raw.byMode.free)) { const tl = tally(v); if (tl) free[k] = tl; }
    s.byMode = { since: raw.byMode.since, daily: tally(raw.byMode.daily)!, free };
  }
  if (Array.isArray(raw.attempts)) s.attempts = raw.attempts.filter((x: unknown): x is string => typeof x === 'string').slice(-MAX_ATTEMPTS);
  return s;
}

// What this tab last knew (#166): when a write to the browser fails the session still has consistent totals, so the next run adds to this and not to an empty record.
let session: Stats | null = null;
/** Forget what this tab remembers, because another tab changed what was saved. */
export const forgetStats = () => { session = null; };

export function loadStats(): Stats {
  if (session) return session;
  try {
    const raw = readKey(STATS_KEY);
    return sanitizeStats(raw ? JSON.parse(raw) : null);
  } catch { return emptyStats(); }
}
const saveStats = (s: Stats) => { session = s; safeSet(STATS_KEY, JSON.stringify(s), 'your record'); };

/** Which parts of the stats screen have something to show. Each is independent (#64). */
export const statsSections = (s: Stats) => {
  const runs = s.runs > 0, duels = (s.duels?.w ?? 0) + (s.duels?.l ?? 0) > 0, dailies = Object.keys(s.daily).length > 0;
  return { runs, duels, dailies, empty: !runs && !duels && !dailies };
};

const counted = (st: Stats, run: Run) => !!run.attempt && !!st.attempts?.includes(run.attempt);
const withAttempt = (st: Stats, run: Run): Stats => (run.attempt ? { ...st, attempts: [...(st.attempts ?? []), run.attempt].slice(-MAX_ATTEMPTS) } : st);

/**
 * Whether a finished run is practice (#162): a daily whose date already has a result, finished or abandoned, from another attempt. Only the first attempt at a
 * daily is scored; results from before attempts were tracked have none, so any new run of those days is practice too.
 */
export function isPractice(st: Stats, run: Run): boolean {
  const date = dailyDate(run);
  const r = date ? st.daily[date] : undefined;
  return !!r && r.attempt !== run.attempt;
}

/** Pure: the stats after adding one finished run. A practice replay, or a run already counted, changes nothing but the list of attempts. */
export function addRun(st: Stats, run: Run): Stats {
  if (counted(st, run)) return st;
  if (isPractice(st, run)) return { ...withAttempt(st, run), lastNew: [] };
  st = withAttempt(st, run);
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
  if (date && !next.daily[date]) next.daily[date] = { placement: pl.label, reached: pl.reached, mvp: G.mvp(run.t, mine).player.nick, grade: G.draftReview(run.picks, !!run.opts?.hard).grade, share: shareText(run), ...(run.attempt ? { attempt: run.attempt } : {}) };
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
  return { ...st, daily: { ...st.daily, [date]: { placement: 'Abandoned', reached: run.t.matches.length ? pl.reached : 0, mvp: '–', grade: null, share, abandoned: true, ...(run.attempt ? { attempt: run.attempt } : {}) } } };
}

export function abandonDaily(run: Run): Stats {
  const next = addAbandon(loadStats(), run);
  saveStats(next);
  return next;
}

/** A duel doesn't count as a Major run: it only adds to the duel record. */
export function recordDuel(run: Run): Stats {
  const st = loadStats();
  if (counted(st, run)) return st;
  const won = run.t.status === 'champion';
  const next = { ...withAttempt(st, run), duels: { w: st.duels.w + (won ? 1 : 0), l: st.duels.l + (won ? 0 : 1) }, lastNew: [] };
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
