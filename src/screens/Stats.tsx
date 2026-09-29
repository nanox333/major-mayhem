import React, { useEffect } from 'react';
import { ROSTERS } from '../data/rosters';
import { Stats, dailyStreak } from '../game/stats';
import { dailyNumber, today } from '../game/state';

const REACHED = ['Out in the Swiss stage', 'Quarterfinal', 'Semifinal', 'Runner-up', 'Champions'];
const nickById = new Map(ROSTERS.flatMap((r) => r.players.map((p) => [p.id, p.nick] as const)));

export function StatsModal({ stats, onClose }: { stats: Stats; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  const most = Object.entries(stats.drafted).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const dailies = Object.entries(stats.daily).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7);
  const max = Math.max(1, ...stats.reached);
  const streak = dailyStreak(stats.daily, today());
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Your stats" onClick={onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="Close">×</button>
        <h3>Your stats</h3>
        {stats.runs === 0 ? <p>Finish a run to start your record.</p> : (
          <>
            <div className="stat-tiles">
              <div><b>{stats.runs}</b><small>Runs</small></div>
              <div><b>{stats.titles}</b><small>Titles</small></div>
              <div><b>{Math.round((stats.titles / stats.runs) * 100)}%</b><small>Win rate</small></div>
              <div><b>{stats.bestStreak}</b><small>Best streak</small></div>
            </div>
            <h3>Finishes</h3>
            <ul className="bars">
              {[...REACHED].reverse().map((label, ri) => {
                const i = REACHED.length - 1 - ri;
                return <li key={label}><span>{label}</span><i style={{ width: `${(stats.reached[i] / max) * 100}%` }} /><b>{stats.reached[i]}</b></li>;
              })}
            </ul>
            {most.length > 0 && (<><h3>Most drafted</h3><p>{most.map(([id, n]) => `${nickById.get(id) ?? id} ×${n}`).join(' · ')}</p></>)}
            {dailies.length > 0 && (
              <>
                <h3>Recent dailies</h3>
                <p>Daily streak: {streak.current} day{streak.current === 1 ? '' : 's'} (best {streak.best})</p>
                <ul className="sources">
                  {dailies.map(([date, d]) => <li key={date}><span>#{dailyNumber(date)} · {d.placement}</span> <span className="muted">MVP {d.mvp}{d.grade !== null ? ` · draft ${Math.round(d.grade * 100)}%` : ''}</span></li>)}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
