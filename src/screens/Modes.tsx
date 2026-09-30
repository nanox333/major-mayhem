import React from 'react';
import { Action, MIN_POOL, Opts, poolCheck } from '../game/state';
import { Stats } from '../game/stats';
import { pageUrl } from '../game/share';
import { NextDaily } from '../ui/Countdown';
import { ShareBar } from './Final';

/** Today's finished (or abandoned) daily: result, share buttons and the countdown. */
export function DailyDone({ d, n, countdown = true }: { d: NonNullable<Stats['daily'][string]>; n: number; /** The home shows its own clock, so it leaves this out. */ countdown?: boolean }) {
  return (
    <div className="daily-done">
      <small>Daily #{n} {d.abandoned ? 'abandoned' : 'done'}</small>
      <strong>{d.placement}</strong>
      <span>{d.abandoned ? 'Reset after it started, so it has no result.' : `MVP ${d.mvp}${d.grade !== null ? ` · Draft ${Math.round(d.grade * 100)}%` : ''}`}</span>
      {d.share && !d.abandoned && <ShareBar text={() => [d.share, pageUrl()].filter(Boolean).join('\n')} props={{ mode: 'daily', daily: n, from: 'daily-done' }} />}
      {countdown && <NextDaily />}
    </div>
  );
}

/** Free-play options, chosen before the first case. */
export function ModePicker({ opts, dispatch }: { opts: Opts; dispatch: React.Dispatch<Action> }) {
  const set = (o: Opts) => dispatch({ type: 'opts', opts: { ...opts, ...o } });
  // A filter that leaves too few teams can't be chosen, rather than quietly widening once the draft starts (#63).
  const choice = <K extends keyof Opts>(key: K, value: Opts[K], label: string) => {
    const { n, ok } = poolCheck({ ...opts, [key]: value });
    const why = ok ? undefined : `Only ${n} team${n === 1 ? '' : 's'} match with your other settings; a full draft needs ${MIN_POOL}.`;
    return <button className={opts[key] === value ? 'is-on' : ''} aria-pressed={opts[key] === value} disabled={!ok} title={why} aria-description={why} onClick={() => set({ [key]: value } as Opts)}>{label}</button>;
  };
  const blocked = ([{ era: 'csgo' }, { era: 'cs2' }, { pool: 'champions' }, { pool: 'underdogs' }] as Opts[]).some((o) => !poolCheck({ ...opts, ...o }).ok);
  return (
    <div className="modes" aria-label="Free-play mode">
      <div className="modes__row"><span>Era</span><div className="seg">{choice('era', undefined, 'All')}{choice('era', 'csgo', 'CS:GO')}{choice('era', 'cs2', 'CS2')}</div></div>
      <div className="modes__row"><span>Teams</span><div className="seg">{choice('pool', undefined, 'All')}{choice('pool', 'champions', 'Champions')}{choice('pool', 'underdogs', 'Underdogs')}</div></div>
      <div className="modes__row"><span>Hard</span><div className="seg">{choice('hard', undefined, 'Off')}{choice('hard', true, 'No role labels')}</div></div>
      {blocked && <p className="muted small">Greyed-out options leave fewer than {MIN_POOL} teams with your other settings, too few for a full draft.</p>}
    </div>
  );
}
