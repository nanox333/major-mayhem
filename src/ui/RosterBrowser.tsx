import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ROSTERS, ROLE_LABEL, Roster } from '../data/rosters';
import { COUNTRY } from '../game/synergy';
import { Avatar, TeamBadge } from './art';
import { Flag } from './flags';
import { ArrowRightIcon } from './icons';
import { Modal } from './Modal';

/** Reference data only: inspecting a roster never dispatches a game action. */
export function RosterBrowser({ initialId, hard, onClose }: { initialId?: string; hard: boolean; onClose: () => void }) {
  const [id, setId] = useState(initialId ?? null);
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('');
  const [placement, setPlacement] = useState('');
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!id) search.current?.focus({ preventScroll: true }); }, [id]);
  const roster = ROSTERS.find(r => r.id === id);
  const list = useMemo(() => ROSTERS.filter(r => (!year || String(r.year) === year) && (!placement || r.result === placement)
    && `${r.org} ${r.event} ${r.players.map(p => p.nick).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => eventTime(b) - eventTime(a) || a.event.localeCompare(b.event) || a.org.localeCompare(b.org)), [query, year, placement]);
  return <Modal label={roster ? `${roster.org} ${roster.year} roster` : 'Roster browser'} onClose={onClose} sheet wide>
    {roster ? <>
      {!initialId && <button className="ghost-btn" onClick={() => setId(null)}>‹ All results</button>}
      <RosterDetails roster={roster} hard={hard} />
      <h4>Other included lineups</h4>
      <div className="roster-related">{ROSTERS.filter(r => r.org === roster.org && r.id !== roster.id).map(r => <button key={r.id} className="ghost-btn" onClick={() => setId(r.id)}>{r.event} · {r.year}</button>)}
        {!ROSTERS.some(r => r.org === roster.org && r.id !== roster.id) && <p className="muted small">No other lineup from this org is included.</p>}</div>
    </> : <>
      <header className="ra-intro">
        <h3>Roster archive</h3>
        <p>Every lineup in the game, with its event and sources. This is not a full career history.</p>
      </header>
      <div className="roster-filters">
        <label>Team or player<input ref={search} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a team or nick" /></label>
        <label>Year<select value={year} onChange={e => setYear(e.target.value)}><option value="">All years</option>{[...new Set(ROSTERS.map(r => r.year))].sort((a,b) => b-a).map(y => <option key={y}>{y}</option>)}</select></label>
        <label>Placement<select value={placement} onChange={e => setPlacement(e.target.value)}><option value="">All placements</option>{[...new Set(ROSTERS.map(r => r.result))].map(p => <option key={p}>{p}</option>)}</select></label>
      </div>
      <p role="status" className="ra-count">{list.length} roster{list.length === 1 ? '' : 's'}</p>
      {!list.length && <div className="ra-empty"><p>No rosters match these filters.</p><button className="ghost-btn" onClick={() => { setQuery(''); setYear(''); setPlacement(''); }}>Clear filters</button></div>}
      {byYear(list).map(([y, rows]) => <section key={y} className="ra-year" aria-label={String(y)}>
        <h4>{y}</h4>
        <ul className="ra-rows">{rows.map(r => <li key={r.id}>
          <button type="button" className="ra-row" onClick={() => setId(r.id)} aria-label={`${r.org} ${r.year}, ${r.event}, ${r.result}`}>
            <TeamBadge roster={r} size={40} />
            <span className="ra-row__main"><b>{r.org}</b><small>{r.event}</small></span>
            <span className={`ra-row__result ra-row__result--${resultClass(r.result)}`}>{r.result}</span>
            <span className="ra-row__nicks">{r.players.map(p => p.nick).join(', ')}</span>
            <ArrowRightIcon size={18} />
          </button>
        </li>)}</ul>
      </section>)}
    </>}
  </Modal>;
}

function RosterDetails({ roster: r, hard }: { roster: Roster; hard: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [r.id]);
  return <section className="roster-detail">
    <header className="ra-head">
      <TeamBadge roster={r} size={56} />
      <div>
        <p className="ra-head__event">{r.event}</p>
        <h3 ref={heading} tabIndex={-1}>{r.org} {r.year}</h3>
        <p className="ra-head__meta"><b className={`ra-row__result--${resultClass(r.result)}`}>{r.result}</b><span>{r.dates}</span></p>
      </div>
    </header>
    {r.unverified && <p role="note" className="ra-note">This lineup still needs source verification.</p>}
    <ul className="ra-people">{r.players.map(p => <li key={p.id}>
      <Avatar player={p} roster={r} />
      <span className="ra-people__text">
        <b>{p.nick}</b>
        <small><Flag code={p.country} size={12} decorative />{COUNTRY[p.country] ?? p.country}{!hard && ` · ${p.roles.map(role => ROLE_LABEL[role]).join(' / ')}`}</small>
      </span>
    </li>)}
    <li className="ra-people__coach"><span className="ra-people__label">Coach</span><span className="ra-people__text"><b>{r.coach ?? 'Not recorded'}</b></span></li></ul>
    <p className="ra-fine">{hard ? 'Role hints are hidden while your hard-mode run is unfinished.' : 'Roles are assigned for this game, not official historical statistics.'} Player strength and match ratings are simulation values and are not shown here.</p>
    <div className="src-links ra-links">{r.liquipediaUrl ? <a href={r.liquipediaUrl} target="_blank" rel="noreferrer">Liquipedia roster</a> : <span>Liquipedia source unavailable</span>}{r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noreferrer">Event standings source</a> : <span>Event source unavailable</span>}
      <a href={`https://github.com/nanox333/major-mayhem/issues/new?template=roster_data.yml&roster=${encodeURIComponent(`${r.org} ${r.year} (${r.event})`)}`} target="_blank" rel="noreferrer">Report incorrect data</a></div>
  </section>;
}

/** Rosters in the order given, grouped by year so a long list has landmarks. */
function byYear(list: Roster[]): [number, Roster[]][] {
  const out: [number, Roster[]][] = [];
  for (const r of list) {
    const last = out[out.length - 1];
    if (last && last[0] === r.year) last[1].push(r); else out.push([r.year, [r]]);
  }
  return out;
}

/** "Runner-up" -> "runner-up", for the pill's colour. */
function resultClass(result: string) {
  return result.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'other';
}

function eventTime(r: Roster) {
  const start = r.dates.match(/^([A-Za-z]+)\s+(\d+)/);
  return start ? Date.parse(`${start[1]} ${start[2]}, ${r.year}`) || r.year : r.year;
}
