import React, { useEffect, useSyncExternalStore } from 'react';
import { TipIcon } from './icons';

// First-appearance tips (#21): each mechanic is explained once, where it first comes up, instead of all at once in the help.
// Which tips have been dismissed is kept in this browser. Someone who has already finished a run, a daily or a duel has seen
// the game and isn't shown any of them.

export type TipId = 'intro' | 'fit' | 'chem' | 'form' | 'knife' | 'calls' | 'rating' | 'guess';
export const TIP_IDS: TipId[] = ['intro', 'fit', 'chem', 'form', 'knife', 'calls', 'rating', 'guess'];

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
/** Whether first-time tips are on: any tip still to show. Turning them off marks every tip seen; turning them on shows them all again (#110). */
export const useTipsOn = () => useSyncExternalStore(subscribe, () => TIP_IDS.some((id) => !seen.has(id)));
export const setTipsOn = (on: boolean) => commit(on ? new Set() : new Set<string>(TIP_IDS));

// One tip at a time (#130): tips register while they are on screen, and only the first unseen one, in the order of TIP_IDS, is drawn. When it is
// dismissed the next one, if the screen has another, takes its place; nothing ever shows two at once.
const onScreen: TipId[] = [];
/** The tip to draw out of the ones on screen, in order: the first not yet seen. */
export const firstVisible = (order: readonly TipId[], done: ReadonlySet<string>): TipId | null => order.find((id) => !done.has(id)) ?? null;
const register = (id: TipId) => {
  if (!onScreen.includes(id)) onScreen.push(id);
  onScreen.sort((a, b) => TIP_IDS.indexOf(a) - TIP_IDS.indexOf(b));
  listeners.forEach((fn) => fn());
  return () => { const i = onScreen.indexOf(id); if (i >= 0) onScreen.splice(i, 1); listeners.forEach((fn) => fn()); };
};
const useIsVisible = (id: TipId, wanted: boolean) => {
  useEffect(() => (wanted ? register(id) : undefined), [id, wanted]);
  return useSyncExternalStore(subscribe, () => firstVisible(onScreen, seen) === id);
};

/**
 * A short explanation of one mechanic, shown the first time it appears and then never again unless tips are reset. One callout style: a rounded panel
 * with an accent rule on its left edge, a "Tip" label, a title and "Got it", and a quiet "Skip tips" for everyone who would rather not. It never takes
 * focus, never dims the page, and `anchor` only says which way its small pointer faces (towards the panel it explains).
 */
export function Tip({ id, title, children, anchor, short }: { id: TipId; title: string; children: React.ReactNode; anchor?: 'left' | 'up'; /** A one-line version: with it the tip is a slim strip (the full text stays in the Help). */ short?: string }) {
  const done = useTipSeen(id);
  const visible = useIsVisible(id, !done);
  if (done || !visible) return null;
  if (short) {
    return (
      <div className="tip tip--compact" role="note" aria-label={`Tip: ${title}`}>
        <TipIcon size={14} />
        <span className="tip__line"><b>{title}</b> {short}</span>
        <button type="button" className="link-btn tip__skip" onClick={() => setTipsOn(false)}>Skip tips</button>
        <button type="button" className="tip__ok tip__x" onClick={() => dismissTip(id)} aria-label={`Dismiss tip: ${title}`}>×</button>
      </div>
    );
  }
  return (
    <div className={`tip ${anchor ? `tip--${anchor}` : ''}`} role="note" aria-label={`Tip: ${title}`}>
      <span className="tip__tag"><TipIcon size={14} /> Tip</span>
      <div className="tip__text"><b>{title}</b><div>{children}</div></div>
      <div className="tip__btns">
        <button type="button" className="ghost-btn tip__ok" onClick={() => dismissTip(id)}>Got it</button>
        <button type="button" className="link-btn tip__skip" onClick={() => setTipsOn(false)}>Skip tips</button>
      </div>
    </div>
  );
}

const STEPS = [
  {
    title: 'Open a case',
    short: 'Each case holds three real rosters from Major history. You can spin again twice.',
    long: 'Open a case to see three real rosters from Counter-Strike Major history. If none of them suits you, spin again: you get two rerolls per draft.',
  },
  {
    title: 'Draft your team',
    short: 'Pick one player at a time: five players, a coach and a bench player.',
    long: 'Pick a player from a roster for each open role. There are seven rounds: five players, a coach and a bench player.',
  },
  {
    title: 'Play the Major',
    short: 'A Swiss stage, then the playoffs. You veto maps, pick sides and can call timeouts.',
    long: 'Find a match. In the Swiss stage three wins send you to the playoffs and three losses knock you out; then comes a quarterfinal, a semifinal and the grand final. Before each map you veto maps and pick a side, and during it you can call timeouts.',
  },
  {
    title: 'Share',
    short: 'The daily is the same for everyone. Compare results, try Guess the pro, or challenge a friend.',
    long: 'The daily gives everyone the same cases, so you can compare with friends. Guess the pro is a second daily, free play has extra modes, and you can challenge a friend to a draft duel.',
  },
];

/** The whole game in four steps, the same four the home screen shows: the help's opening, and (in short form) the duel start. */
export function HowSteps({ compact }: { compact?: boolean }) {
  return (
    <ol className="steps">
      {STEPS.map((x) => <li key={x.title}><b>{x.title}</b><span>{compact ? x.short : x.long}</span></li>)}
    </ol>
  );
}
