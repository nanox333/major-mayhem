import React, { useSyncExternalStore } from 'react';

// First-appearance tips (#21): each mechanic is explained once, where it first comes up, instead of all at once in the help.
// Which tips have been dismissed is kept in this browser. Someone who has already finished a run, a daily or a duel has seen
// the game and isn't shown any of them.

export type TipId = 'intro' | 'fit' | 'form' | 'knife' | 'calls' | 'rating';
export const TIP_IDS: TipId[] = ['intro', 'fit', 'form', 'knife', 'calls', 'rating'];

const KEY = 'mm-tips';
const STATS_KEY = 'major-mayhem-stats-v1';

const stored = (): string[] | null => {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : null; } catch { return null; }
};
/** A player with any finished run, daily or duel has been through it before. */
const hasPlayed = () => {
  try {
    const st = JSON.parse(localStorage.getItem(STATS_KEY) ?? 'null');
    return !!st && (st.runs > 0 || (st.duels?.w ?? 0) + (st.duels?.l ?? 0) > 0 || Object.keys(st.daily ?? {}).length > 0);
  } catch { return false; }
};

let seen: ReadonlySet<string> = new Set(stored() ?? (hasPlayed() ? TIP_IDS : []));
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const commit = (next: Set<string>) => {
  seen = next;
  try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* storage unavailable: the tip just comes back next visit */ }
  listeners.forEach((fn) => fn());
};

export const tipSeen = (id: TipId) => seen.has(id);
export const dismissTip = (id: TipId) => { if (!seen.has(id)) commit(new Set(seen).add(id)); };
/** Shows every tip again, from the help screen. */
export const resetTips = () => commit(new Set());
export const useTipSeen = (id: TipId) => useSyncExternalStore(subscribe, () => seen.has(id));

/** A short explanation of one mechanic, shown the first time it appears and then never again unless tips are reset. */
export function Tip({ id, title, children }: { id: TipId; title: string; children: React.ReactNode }) {
  const done = useTipSeen(id);
  if (done) return null;
  return (
    <div className="tip" role="note" aria-label={`Tip: ${title}`}>
      <div className="tip__text"><b>{title}</b><div>{children}</div></div>
      <button type="button" className="ghost-btn tip__ok" onClick={() => dismissTip(id)}>Got it</button>
    </div>
  );
}

const STEPS = [
  {
    title: 'Draft your team',
    short: 'Open cases, pick a team, then one of its players. Seven rounds: five players, a coach and a bench player.',
    long: 'Open a case for three real rosters from Counter-Strike Major history. Pick a team, then one of its players for an open role. There are seven rounds: five players, a coach and a bench player, with two rerolls.',
  },
  {
    title: 'Win the Major',
    short: 'Play a Swiss stage, then the playoffs. You veto maps and pick sides, and can call timeouts mid-map.',
    long: 'Find a match. In the Swiss stage three wins send you to the playoffs and three losses knock you out; then comes a quarterfinal, a semifinal and the grand final. Before each map you veto maps and pick a side, and during it you can call timeouts.',
  },
  {
    title: 'Compare and share',
    short: 'The daily is the same for everyone. Compare results, try Guess the pro, or challenge a friend.',
    long: 'The daily gives everyone the same cases, so you can compare with friends. Guess the pro is a second daily, free play has extra modes, and you can challenge a friend to a draft duel.',
  },
];

/** The whole game in three steps: the help's opening, and (in short form) what a first-time visitor sees before the first case. */
export function ThreeSteps({ compact }: { compact?: boolean }) {
  return (
    <ol className="steps">
      {STEPS.map((x) => <li key={x.title}><b>{x.title}</b><span>{compact ? x.short : x.long}</span></li>)}
    </ol>
  );
}
