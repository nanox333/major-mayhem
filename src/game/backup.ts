// A local backup of your records and the run you have open (#189, #164, #166): a versioned JSON file you download and can restore from. Nothing leaves the
// browser. Restoring replaces what is saved, after everything in the file has been checked, so a bad file changes nothing; and because it replaces and does
// not merge, a result or an attempt in the file can never be counted on top of the same one already here.
import { GUESS_KEY, GuessDay, loadGuesses, sanitizeGuesses } from './guess';
import { DUO_KEY, DuoDay, loadDuo, sanitizeDuo } from './duo';
import { KEY as RUN_KEY, Run, parseRun, roundNumber, draftRounds } from './state';
import { STATS_KEY, Stats, loadStats, sanitizeStats } from './stats';
import { readKey, removeKey, safeSet } from './persist';

export const BACKUP_APP = 'major-mayhem';
export const BACKUP_FORMAT = 1;

export interface Backup {
  app: typeof BACKUP_APP;
  format: typeof BACKUP_FORMAT;
  exportedAt: string;
  stats: Stats;
  guess: Record<string, GuessDay>;
  /** Duo Link history. Backups made before Duo Link have none, and restoring one leaves the history here as it is. */
  duo?: Record<string, DuoDay>;
  /** The run you had open, or null. */
  run: Run | null;
}

/** Everything worth keeping, as this tab knows it (so it is right even when the browser would not save it). `run` is the one on screen, if any. */
export function createBackup(run?: Run | null): Backup {
  return { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), stats: loadStats(), guess: loadGuesses(), duo: loadDuo(), run: run ?? parseRun(readKey(RUN_KEY)) };
}
export const backupText = (b: Backup) => JSON.stringify(b, null, 2);
export const backupFileName = (d = new Date()) => `major-mayhem-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;

/**
 * What is saved, straight from the browser without checking it, for when a save is damaged and the game cannot open. The raw text is kept so nothing
 * is lost by tidying it: it can be looked at or repaired by hand.
 */
export function rawBackupText(): string {
  const raw = (k: string) => { const v = readKey(k); try { return v === null ? null : JSON.parse(v); } catch { return v; } };
  return JSON.stringify({ app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), raw: true, run: raw(RUN_KEY), stats: raw(STATS_KEY), guess: raw(GUESS_KEY), duo: raw(DUO_KEY) }, null, 2);
}

export interface BackupSummary { runs: number; titles: number; dailies: number; guessDays: number; run: string | null; exportedAt: string }
export type BackupPreview = { ok: true; backup: Backup; summary: BackupSummary } | { ok: false; problem: string };

const isObj = (x: unknown): x is Record<string, any> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Reads a backup file and says what is in it, or why it cannot be used. Nothing is written. */
export function previewBackup(text: string): BackupPreview {
  let o: unknown;
  try { o = JSON.parse(text); } catch { return { ok: false, problem: "That file isn't a Major Mayhem backup (it isn't valid JSON)." }; }
  if (!isObj(o) || o.app !== BACKUP_APP) return { ok: false, problem: "That file isn't a Major Mayhem backup." };
  if (o.format !== BACKUP_FORMAT) return { ok: false, problem: `That backup is format ${String(o.format)}; this version reads format ${BACKUP_FORMAT}.` };
  if (o.raw === true) return { ok: false, problem: 'That file is a raw dump made when a save was damaged. It is for looking at, not restoring.' };
  if (!isObj(o.stats) || o.stats.v !== 1) return { ok: false, problem: "The record in that backup isn't one this version can read." };
  if (!isObj(o.guess)) return { ok: false, problem: "The Guess history in that backup isn't one this version can read." };
  let run: Run | null = null;
  if (o.run !== null && o.run !== undefined) {
    run = parseRun(JSON.stringify(o.run));
    if (!run) return { ok: false, problem: "The unfinished run in that backup can't be used by this version, so nothing was changed." };
  }
  const stats = sanitizeStats(o.stats);
  const guess = sanitizeGuesses(o.guess);
  const duo = isObj(o.duo) ? sanitizeDuo(o.duo) : undefined;
  const where = run ? (run.phase === 'draft' ? `round ${roundNumber(run)} of ${draftRounds(run)} of the draft` : run.phase === 'final' ? 'finished' : run.phase === 'ready' ? 'in the lobby' : 'in the Major') : null;
  const what = run ? `${run.mode === 'daily' ? `Daily ${run.seed.replace('daily-', '')}` : run.mode === 'duel' ? 'A draft duel' : 'A free-play run'}, ${where}` : null;
  return {
    ok: true,
    backup: { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : '', stats, guess, ...(duo ? { duo } : {}), run },
    summary: { runs: stats.runs, titles: stats.titles, dailies: Object.keys(stats.daily).length, guessDays: Object.keys(guess).length, run: what, exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt.slice(0, 10) : '' },
  };
}

/** Puts a checked backup in place of what is saved. If any write fails, what was there before is put back and false is returned. */
export function applyBackup(b: Backup): boolean {
  const before = { run: readKey(RUN_KEY), stats: readKey(STATS_KEY), guess: readKey(GUESS_KEY), duo: readKey(DUO_KEY) };
  const put = (k: string, v: string | null) => (v === null ? (removeKey(k), true) : safeSet(k, v, 'your data'));
  const ok = put(STATS_KEY, JSON.stringify(b.stats)) && put(GUESS_KEY, JSON.stringify(b.guess)) && (!b.duo || put(DUO_KEY, JSON.stringify(b.duo))) && put(RUN_KEY, b.run ? JSON.stringify(b.run) : null);
  if (!ok) { put(STATS_KEY, before.stats); put(GUESS_KEY, before.guess); put(DUO_KEY, before.duo); put(RUN_KEY, before.run); }
  return ok;
}

/** Offers the file to the browser as a download. */
export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
