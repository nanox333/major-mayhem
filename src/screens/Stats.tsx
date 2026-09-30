import React from 'react';
import { ROSTERS } from '../data/rosters';
import { Modal } from '../ui/Modal';
import { FINISH_SHORT, Stats, dailyStreak, recentDailies, statsSections, DayBar } from '../game/stats';
import { dailyNumber, today } from '../game/state';
import { ACHIEVEMENTS } from '../game/achievements';

export const REACHED = ['Out in the Swiss stage', 'Quarterfinal', 'Semifinal', 'Runner-up', 'Champions'];
const MODE_WORD: Record<string, string> = { all: 'all teams', csgo: 'CS:GO', cs2: 'CS2', champions: 'champions', underdogs: 'underdogs', hard: 'hard' };
const modeLabel = (key: string) => key.split('+').map((k) => MODE_WORD[k] ?? k).join(', ');
const nickById =new Map(ROSTERS.flatMap((r) => r.players.map((p) => [p.id, p.nick] as const)));

/**
 * Major runs, duels and dailies each show as soon as they have something in them (#64): a duel or an abandoned daily
 * doesn't wait for a finished Major. Achievements always show, locked ones included, so new players see the goals.
 */
export function StatsModal({ stats, onClose }: { stats: Stats; onClose: () => void }) {
  const most = Object.entries(stats.drafted).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const dailies = Object.entries(stats.daily).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7);
  const max = Math.max(1, ...stats.reached);
  const streak = dailyStreak(stats.daily, today());
  const show = statsSections(stats);
  return (
    <Modal label="Your stats" onClose={onClose}>
        <h3>Your stats</h3>
        {show.empty && <p>Nothing here yet. Finish a Major run, play a daily or a draft duel to start your record.</p>}
        {show.runs ? (
          <>
            <div className="stat-tiles">
              <div><b>{stats.runs}</b><small>Major runs</small></div>
              <div><b>{stats.titles}</b><small>Titles</small></div>
              <div title={`${stats.titles} titles in ${stats.runs} Major runs`}><b>{Math.round((stats.titles / stats.runs) * 100)}%</b><small>Title rate</small></div>
              <div title="Major titles in a row"><b>{stats.bestStreak}</b><small>Best title streak</small></div>
            </div>
            <p className="muted small">Title rate is Majors won out of Major runs finished ({stats.titles} of {stats.runs}), all modes together.</p>
            {stats.byMode && (
              <>
                <h3>By mode <span className="muted">since {stats.byMode.since}</span></h3>
                <ul className="sources">
                  {[['Daily', stats.byMode.daily] as const, ...Object.entries(stats.byMode.free).map(([k, t]) => [`Free play · ${modeLabel(k)}`, t] as const)]
                    .filter(([, t]) => t.runs > 0)
                    .map(([label, t]) => <li key={label}><span>{label}</span> <span className="muted">{t.titles} title{t.titles === 1 ? '' : 's'} in {t.runs} run{t.runs === 1 ? '' : 's'}</span></li>)}
                </ul>
              </>
            )}
            <h3>Finishes <span className="muted">all runs</span></h3>
            <ul className="bars">
              {[...REACHED].reverse().map((label, ri) => {
                const i = REACHED.length - 1 - ri;
                return <li key={label}><span>{label}</span><i style={{ width: `${(stats.reached[i] / max) * 100}%` }} /><b>{stats.reached[i]}</b></li>;
              })}
            </ul>
            {most.length > 0 && (
              <>
                <h3>Most drafted</h3>
                <ol className="most">{most.map(([id, n]) => <li key={id}><b>{nickById.get(id) ?? id}</b> ×{n}</li>)}</ol>
              </>
            )}
          </>
        ) : !show.empty && <p className="muted">No Major runs finished yet.</p>}
        {show.duels && (<><h3>Draft duels</h3><p>{stats.duels.w} won, {stats.duels.l} lost</p></>)}
        {show.dailies && (
          <>
            <h3>Last 14 dailies</h3>
            <DailyChart days={recentDailies(stats.daily, today())} />
            <h3>Recent dailies</h3>
            <p>Daily streak: {streak.current} day{streak.current === 1 ? '' : 's'} (best {streak.best})</p>
            <ul className="sources">
              {dailies.map(([date, d]) => (
                <li key={date} className={d.abandoned ? 'is-abandoned' : ''}>
                  <span>#{dailyNumber(date)} · {d.abandoned ? '🏳️ Abandoned (no result)' : d.placement}</span>
                  {!d.abandoned && <span className="muted"> MVP {d.mvp}{d.grade !== null ? ` · draft ${Math.round(d.grade * 100)}%` : ''}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
        <h3>Achievements <span className="muted">{Object.keys(stats.ach ?? {}).length} of {ACHIEVEMENTS.length}</span></h3>
        <ul className="achievements">
          {ACHIEVEMENTS.map((a) => {
            const when = stats.ach?.[a.id];
            return <li key={a.id} className={when ? 'is-earned' : ''} title={when ? `Earned ${when}` : 'Not yet'}><b>{when ? '★' : '☆'} {a.name}</b><small>{a.desc}</small></li>;
          })}
        </ul>
    </Modal>
  );
}

/**
 * Your finishes over the last two weeks (#76): a column per day, as tall as how far you got, with the finish written under it and the day of the
 * month under that, so no value is carried by height or colour alone. Days you didn't play are gaps. Plain CSS, no chart library.
 */
function DailyChart({ days }: { days: DayBar[] }) {
  const said = (d: DayBar) => (d.state === 'played' ? `Daily #${d.n}: ${d.placement}` : d.state === 'abandoned' ? `Daily #${d.n}: abandoned, no result` : `Daily #${d.n}: not played`);
  return (
    <ol className="dchart" aria-label="Your finish in each of the last 14 dailies, oldest first">
      {days.map((d) => (
        <li key={d.date} className={`dchart__col is-${d.state} ${d.state === 'played' && d.reached === 4 ? 'is-champ' : ''}`} aria-label={said(d)} title={said(d)}>
          <span className="dchart__bar" aria-hidden="true"><i style={{ height: d.state === 'played' ? `${((d.reached + 1) / 5) * 100}%` : '0%' }} /></span>
          <small aria-hidden="true">{d.state === 'played' ? FINISH_SHORT[d.reached] : d.state === 'abandoned' ? '⚑' : '–'}</small>
          <em aria-hidden="true">{Number(d.date.slice(8))}</em>
        </li>
      ))}
    </ol>
  );
}
