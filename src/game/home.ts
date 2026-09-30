// What the home screen says (#115, #117, #118): which state you are in, the daily countdown, and your best finish.
// Display only: nothing here changes a run, a save, the simulation or a daily, so there is no rules version.
import { ACHIEVEMENTS } from './achievements';
import { Run, dailyDate, draftRounds, roundNumber } from './state';
import { Stats, statsSections } from './stats';

export type DailyState = 'new' | 'progress' | 'done' | 'abandoned';
export interface HomeState {
  /** Today's daily: not started, a daily run in progress (any day's), finished, or abandoned. */
  daily: DailyState;
  /** A free-play run with a case open that isn't finished. */
  freeInProgress: boolean;
  /** No record and no run started: the first visit. */
  first: boolean;
}

/** A run counts as started once a case is open, and stays in progress until its results screen. */
const inProgress = (run: Run) => run.offerKey > 0 && run.phase !== 'final';

/**
 * Which home you get. A daily run in progress wins (it keeps its own date, so "continue" is right even after midnight);
 * otherwise today's result decides between finished, abandoned and new.
 */
export function homeState(run: Run, stats: Stats, day: string): HomeState {
  const started = inProgress(run);
  const dailyRun = started && !!dailyDate(run);
  const today = stats.daily[day];
  return {
    daily: dailyRun ? 'progress' : today ? (today.abandoned ? 'abandoned' : 'done') : 'new',
    freeInProgress: started && run.mode === 'free',
    first: statsSections(stats).empty && !started,
  };
}

/** Where a run in progress is, in words: "round 4 of 7", "in the lobby". */
export const runWhere = (run: Run) =>
  run.phase === 'draft' ? `round ${roundNumber(run)} of ${draftRounds(run)}` : run.phase === 'ready' ? 'in the lobby' : run.phase === 'final' ? 'results' : 'in the Major';

/** Your furthest stage as a placement, worded like the team cards (#104). `reached` counts runs by stage: 0 Swiss out, 1 quarter, 2 semi, 3 final, 4 champion. */
const BEST = ['Out in the Swiss stage', '5th–8th place', '3rd–4th place', '2nd place', '1st place'];
export function bestFinish(stats: Pick<Stats, 'runs' | 'reached'>): string | null {
  if (!(stats.runs > 0)) return null;
  const best = stats.reached.reduce((b, n, i) => (n > 0 ? i : b), -1);
  return best < 0 ? null : BEST[best];
}

/** Achievements earned out of the ones that exist (a saved id that no longer exists doesn't count). */
export function achievementCount(stats: Pick<Stats, 'ach'>): { earned: number; total: number } {
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  return { earned: Object.keys(stats.ach ?? {}).filter((id) => ids.has(id)).length, total: ACHIEVEMENTS.length };
}

/**
 * Milliseconds from `now` to the next local midnight, when the next daily unlocks (#26, #117). Built from tomorrow's calendar date,
 * not from adding 24 hours, so a 23 or 25 hour day (daylight saving) is right. Never UTC.
 */
export function msUntilMidnight(now: Date = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
}

const pad = (n: number) => String(n).padStart(2, '0');
/** "23:14:27". */
export function clockText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

/** The same time for a screen reader: "Next daily in 7 hours". It changes by the hour, then by the minute, never by the second. */
export function spokenLeft(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return `Next daily in ${hours} hour${hours === 1 ? '' : 's'}`;
  const mins = Math.ceil(ms / 60000);
  return mins <= 1 ? 'Next daily in less than a minute' : `Next daily in ${mins} minutes`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The daily challenge is said once (#150): the card holds the action and the panel holds the status, so in every state the two say
 * different things. `progress` is the run's own round while it's still in the draft, drawn as dots.
 */
export interface DailyPanel {
  title: string;
  /** What the clock counts to: "Ends in" while today's is still open to you, "Starts in" once it's done. */
  label: string;
  note: string | null;
  /** Only where it matters: the finished state, when a replay is offered. */
  rule: string | null;
  progress: { at: number; of: number } | null;
}
export function dailyPanel(home: HomeState, todayN: number, run: Run, placement?: string): DailyPanel {
  if (home.daily === 'done') return { title: 'Next daily', label: 'Starts in', note: `Daily #${todayN}: you finished ${placement ?? 'the run'}.`, rule: "A replay is for practice: it doesn't change your record.", progress: null };
  if (home.daily === 'abandoned') return { title: 'Next daily', label: 'Starts in', note: `Daily #${todayN} was abandoned, so it has no result.`, rule: null, progress: null };
  if (home.daily === 'progress') {
    return { title: "Today's daily", label: 'Ends in', note: cap(runWhere(run)), rule: null, progress: run.phase === 'draft' ? { at: roundNumber(run), of: draftRounds(run) } : null };
  }
  return { title: "Today's daily", label: 'Ends in', note: null, rule: null, progress: null };
}

/** The daily card's button: the action, and a smaller line for the status. */
export function dailyButton(home: HomeState, run: Run): { action: string; sub: string | null; quiet: boolean } {
  if (home.daily === 'progress') return { action: "Continue today's run", sub: cap(runWhere(run)), quiet: false };
  if (home.daily === 'done') return { action: "Replay today's run", sub: null, quiet: true };
  if (home.daily === 'abandoned') return { action: 'Play it anyway', sub: null, quiet: false };
  return { action: "Start today's run", sub: null, quiet: false };
}

/**
 * How it works (#148): the four steps for anyone who hasn't played yet, one slim line for anyone who has, and always one press away.
 * `seen` is the first-time-tips state (a finished run or a dismissed intro).
 */
export const howExpanded = (seen: boolean, opened: boolean) => !seen || opened;
