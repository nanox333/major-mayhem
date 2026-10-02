import { ROSTERS } from '../data/rosters';
import { Avatar } from '../ui/art';
import { FlameIcon, StarIcon, TrophyIcon } from '../ui/icons';
import React from 'react';
import { Action, MIN_POOL, Opts, poolCheck } from '../game/state';
import { Stats } from '../game/stats';
import { pageUrl } from '../game/share';
import { NextDaily } from '../ui/Countdown';
import { ShareBar } from './Final';

/** Today's finished (or abandoned) daily: result, share buttons and the countdown. */
const mvpOf = (nick: string) => { const k = nick.toLowerCase(); for (const r of [...ROSTERS].reverse()) { const p = r.players.find((x) => x.nick.toLowerCase() === k); if (p) return { p, r }; } return null; };

export function DailyDone({ d, n, countdown = true, streak }: { d: NonNullable<Stats['daily'][string]>; n: number; /** The current daily streak: shown in place of the draft score, with a meter that fills toward a full week. */ streak?: number; /** The home shows its own clock, so it leaves this out. */ countdown?: boolean }) {
  const mvp = d.abandoned ? null : mvpOf(d.mvp);
  return (
    <div className="daily-done">
      {!d.abandoned && <span className="daily-done__icon" aria-hidden="true"><TrophyIcon size={26} /></span>}
      <small>Daily #{n} {d.abandoned ? 'abandoned' : 'done'}</small>
      <strong>{d.placement}</strong>
      {d.abandoned ? <span>Reset after it started, so it has no result.</span> : (
        <span className="daily-done__meta">
          <span className="daily-done__mvp">
            {mvp && <span className="daily-done__face"><Avatar player={mvp.p} roster={mvp.r} /></span>}
            <span className="daily-done__who"><small>MVP</small><b><StarIcon size={18} />{d.mvp}</b></span>
          </span>
          {streak !== undefined && streak > 0 ? <Streak days={streak} /> : d.grade !== null && <span><small>Draft</small><b>{Math.round(d.grade * 100)}%</b></span>}
        </span>
      )}
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

/** The daily streak as a fire meter: seven segments for a week, filled as far as the streak goes, and a line that points at tomorrow. */
function Streak({ days }: { days: number }) {
  // Past a full week the meter stops cycling and the cell goes hot: eight days or more is a streak worth protecting.
  const blaze = days >= 8;
  const lit = blaze ? 7 : days % 7 === 0 ? 7 : days % 7;
  return (
    <span className={`daily-done__streak ${blaze ? 'is-blaze' : ''}`}>
      {blaze && Array.from({ length: 6 }, (_, i) => <u key={i} className="ember" aria-hidden="true" />)}
      <small>{blaze ? 'On fire' : 'Daily streak'}</small>
      <b><FlameIcon size={25} />{days} day{days === 1 ? '' : 's'}</b>
      <i className="fire" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <u key={i} className={i < lit ? 'on' : ''} style={blaze ? { animationDelay: `${i * 90}ms` } : undefined} />)}</i>
      <em>{blaze ? `${days} days running. Don't let it go out.` : lit === 7 ? 'A full week. Keep it burning.' : `Back tomorrow for day ${days + 1}`}</em>
    </span>
  );
}
