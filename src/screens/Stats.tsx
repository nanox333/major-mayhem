import React from 'react';
import { ROSTERS } from '../data/rosters';
import { Avatar } from '../ui/art';
import { FlameIcon, StarIcon, StatsIcon, TrophyIcon } from '../ui/icons';
import { FINISH_SHORT, Stats, dailyStreak, recentDailies, statsSections, DayBar } from '../game/stats';
import { dailyNumber, today } from '../game/state';
import { ACHIEVEMENTS } from '../game/achievements';

export const REACHED = ['Out in the Swiss stage', 'Quarterfinal', 'Semifinal', 'Runner-up', 'Champions'];
const MODE_WORD: Record<string, string> = { all: 'all teams', csgo: 'CS:GO', cs2: 'CS2', champions: 'champions', underdogs: 'underdogs', hard: 'hard' };
const modeLabel = (key: string) => key.split('+').map((k) => MODE_WORD[k] ?? k).join(', ');
const whoById = new Map(ROSTERS.flatMap((r) => r.players.map((p) => [p.id, { p, r }] as const)).reverse());

/**
 * Your record as a page. Major runs, duels and dailies each show as soon as they have something in them (#64): a duel or an abandoned daily doesn't wait
 * for a finished Major. Achievements always show, locked ones included, so new players see the goals.
 */
export function StatsPage({ stats, next }: { stats: Stats; /** What to do next, in the Home's own words ("Play today's draft", "Continue…"), shown on an empty page. */ next?: { label: string; go: () => void } }) {
  const most = Object.entries(stats.drafted).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const dailies = Object.entries(stats.daily).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7);
  const max = Math.max(1, ...stats.reached);
  const streak = dailyStreak(stats.daily, today());
  const show = statsSections(stats);
  const earned = Object.keys(stats.ach ?? {}).length;
  const lit = streak.current % 7 === 0 && streak.current > 0 ? 7 : streak.current % 7;
  const modes = stats.byMode ? [['Daily', stats.byMode.daily] as const, ...Object.entries(stats.byMode.free).map(([k, t]) => [`Free play · ${modeLabel(k)}`, t] as const)].filter(([, t]) => t.runs > 0) : [];
  return (
    <main className="console sp">
      <header className="sp-hero">
        <span className="sp-hero__icon" aria-hidden="true"><StatsIcon size={34} /></span>
        <div>
          <p className="sp-kicker">Record</p>
          <h3>Your stats</h3>
          <p>Everything is kept in this browser.</p>
        </div>
      </header>
      {show.empty && (
        <section className="sp-empty" aria-labelledby="sp-empty-h">
          <ul className="sp-empty__ghosts" aria-hidden="true">
            {[['Runs', <StatsIcon size={18} key="r" />], ['Best finish', <TrophyIcon size={18} key="b" />], ['Daily streak', <FlameIcon size={18} key="s" />]].map(([label, icon]) => <li key={label as string}>{icon}<b>–</b><span>{label}</span></li>)}
          </ul>
          <h4 id="sp-empty-h">No runs yet</h4>
          <p>Finish a run or play the daily and your record starts here.</p>
          {next && <button type="button" className="cta cta--orange" onClick={next.go}><span className="cta__main">{next.label}</span></button>}
        </section>
      )}
      {show.runs && (
        <ul className="sp-kpis" aria-label="Major runs">
          <li><StatsIcon size={22} /><b>{stats.runs}</b><span>Major runs</span></li>
          <li className="is-gold"><TrophyIcon size={22} /><b>{stats.titles}</b><span>Titles</span></li>
          <li title={`${stats.titles} titles in ${stats.runs} Major runs`}><StarIcon size={22} /><b>{Math.round((stats.titles / stats.runs) * 100)}%</b><span>Title rate</span></li>
          <li title="Major titles in a row"><FlameIcon size={22} /><b>{stats.bestStreak}</b><span>Best title streak</span></li>
        </ul>
      )}
      <div className="sp-grid">
        {show.dailies && (
          <section className="sp-card sp-card--wide" aria-labelledby="sp-daily">
            <h4 id="sp-daily">Daily streak</h4>
            <div className="sp-streak">
              <div className="sp-streak__now"><FlameIcon size={34} /><b>{streak.current}</b><span>day{streak.current === 1 ? '' : 's'}</span></div>
              <div className="sp-streak__meter">
                <i className="fire" aria-hidden="true">{Array.from({ length: 7 }, (_, k) => <u key={k} className={k < lit ? 'on' : ''} />)}</i>
                <small>Best {streak.best} day{streak.best === 1 ? '' : 's'}. {lit === 7 ? 'A full week.' : `${7 - lit} more for a full week.`}</small>
              </div>
            </div>
            <h5>Last 14 dailies</h5>
            <DailyChart days={recentDailies(stats.daily, today())} />
          </section>
        )}
        {show.runs && (
          <section className="sp-card" aria-labelledby="sp-fin">
            <h4 id="sp-fin">Finishes <span>all runs</span></h4>
            <ul className="sp-bars">
              {[...REACHED].reverse().map((label, ri) => {
                const i = REACHED.length - 1 - ri;
                return <li key={label} className={i === 4 ? 'is-gold' : ''}><span>{label}</span><i><u style={{ width: `${(stats.reached[i] / max) * 100}%` }} /></i><b>{stats.reached[i]}</b></li>;
              })}
            </ul>
          </section>
        )}
        {most.length > 0 && (
          <section className="sp-card" aria-labelledby="sp-most">
            <h4 id="sp-most">Most drafted</h4>
            <ol className="sp-most">
              {most.map(([id, n], k) => {
                const w = whoById.get(id);
                return <li key={id}><span className="sp-most__rank">{k + 1}</span>{w && <Avatar player={w.p} roster={w.r} />}<b>{w?.p.nick ?? id}</b><span className="sp-most__n">×{n}</span></li>;
              })}
            </ol>
          </section>
        )}
        {(modes.length > 0 || show.duels) && (
          <section className="sp-card" aria-labelledby="sp-modes">
            <h4 id="sp-modes">{show.duels ? 'Modes and duels' : 'By mode'}{stats.byMode && <span>since {stats.byMode.since}</span>}</h4>
            <ul className="sp-rows">
              {modes.map(([label, t]) => <li key={label}><span>{label}</span><b>{t.titles} <small>title{t.titles === 1 ? '' : 's'} in {t.runs} run{t.runs === 1 ? '' : 's'}</small></b></li>)}
              {show.duels && <li><span>Draft duels</span><b>{stats.duels.w}<small> won</small> · {stats.duels.l}<small> lost</small></b></li>}
            </ul>
          </section>
        )}
        {show.dailies && (
          <section className="sp-card" aria-labelledby="sp-recent">
            <h4 id="sp-recent">Recent dailies</h4>
            <ul className="sp-rows">
              {dailies.map(([date, d]) => (
                <li key={date} className={d.abandoned ? 'is-abandoned' : ''}>
                  <span>#{dailyNumber(date)}<small>{date}</small></span>
                  <b>{d.abandoned ? 'Abandoned' : d.placement}{!d.abandoned && <small> MVP {d.mvp}{d.grade !== null ? ` · draft ${Math.round(d.grade * 100)}%` : ''}</small>}</b>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <section className="sp-ach" aria-labelledby="sp-ach">
        <div className="sp-ach__head"><h4 id="sp-ach">Achievements</h4><span>{earned} of {ACHIEVEMENTS.length}</span><i aria-hidden="true"><u style={{ width: `${(earned / ACHIEVEMENTS.length) * 100}%` }} /></i></div>
        <ul className="sp-ach__grid">
          {ACHIEVEMENTS.map((a) => {
            const when = stats.ach?.[a.id];
            return <li key={a.id} className={when ? 'is-earned' : ''} title={when ? `Earned ${when}` : 'Not yet'}><span className="sp-ach__star" aria-hidden="true"><StarIcon size={16} /></span><b>{a.name}</b><small>{a.desc}</small><Sr when={!!when} /></li>;
          })}
        </ul>
      </section>
    </main>
  );
}

function Sr({ when }: { when: boolean }) { return <span className="sr">{when ? 'Earned' : 'Not yet earned'}</span>; }

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
