import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ROSTERS, ROLE_LABEL, Roster } from '../data/rosters';
import { COUNTRY } from '../game/synergy';
import { Avatar, TeamBadge } from './art';
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
  return <Modal label={roster ? `${roster.org} ${roster.year} roster` : 'Roster browser'} onClose={onClose} sheet>
    {roster ? <>
      {!initialId && <button className="ghost-btn" onClick={() => setId(null)}>‹ All results</button>}
      <RosterDetails roster={roster} hard={hard} />
      <h4>Other included lineups</h4>
      <div className="roster-related">{ROSTERS.filter(r => r.org === roster.org && r.id !== roster.id).map(r => <button key={r.id} className="ghost-btn" onClick={() => setId(r.id)}>{r.event} · {r.year}</button>)}
        {!ROSTERS.some(r => r.org === roster.org && r.id !== roster.id) && <p className="muted small">No other lineup from this org is included.</p>}</div>
    </> : <>
      <h3>Explore Major rosters</h3>
      <p className="muted">Lineups included in this game, with their event and sources. This is not a full career history.</p>
      <div className="roster-filters">
        <label>Team or player<input ref={search} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a team or nick" /></label>
        <label>Year<select value={year} onChange={e => setYear(e.target.value)}><option value="">All years</option>{[...new Set(ROSTERS.map(r => r.year))].sort((a,b) => b-a).map(y => <option key={y}>{y}</option>)}</select></label>
        <label>Placement<select value={placement} onChange={e => setPlacement(e.target.value)}><option value="">All placements</option>{[...new Set(ROSTERS.map(r => r.result))].map(p => <option key={p}>{p}</option>)}</select></label>
      </div>
      <p role="status">{list.length} roster{list.length === 1 ? '' : 's'}</p>
      {!list.length && <div><p>No rosters match these filters.</p><button className="ghost-btn" onClick={() => { setQuery(''); setYear(''); setPlacement(''); }}>Clear filters</button></div>}
      <ul className="roster-list">{list.map(r => <li key={r.id}><button onClick={() => setId(r.id)}><TeamBadge roster={r} size={38} /><span><b>{r.org} · {r.year}</b><small>{r.event} · {r.result}</small></span></button></li>)}</ul>
    </>}
  </Modal>;
}

function RosterDetails({ roster: r, hard }: { roster: Roster; hard: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [r.id]);
  return <section className="roster-detail">
    <div className="roster-detail__head"><TeamBadge roster={r} size={64} /><div><h3 ref={heading} tabIndex={-1}>{r.org} {r.year}</h3><p>{r.event} · {r.result}</p><small>{r.dates}</small></div></div>
    {r.unverified && <p role="note">This lineup still needs source verification.</p>}
    <ul className="roster-people">{r.players.map(p => <li key={p.id}><Avatar player={p} roster={r} /><div><b>{p.nick}</b><small>{COUNTRY[p.country] ?? p.country}{!hard && ` · ${p.roles.map(role => ROLE_LABEL[role]).join(' / ')}`}</small></div></li>)}</ul>
    <p><b>Coach:</b> {r.coach ?? 'Not recorded'}</p>
    <p className="muted small">{hard ? 'Role hints are hidden while your hard-mode run is unfinished.' : 'Roles are assigned for this game, not official historical statistics.'} Player strength and match ratings are simulation values and are not shown here.</p>
    <div className="src-links">{r.liquipediaUrl ? <a href={r.liquipediaUrl} target="_blank" rel="noreferrer">Liquipedia roster</a> : <span>Liquipedia source unavailable</span>}{r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noreferrer">Event standings source</a> : <span>Event source unavailable</span>}
      <a href={`https://github.com/nanox333/major-mayhem/issues/new?template=roster_data.yml&roster=${encodeURIComponent(`${r.org} ${r.year} (${r.event})`)}`} target="_blank" rel="noreferrer">Report incorrect data</a></div>
  </section>;
}

function eventTime(r: Roster) {
  const start = r.dates.match(/^([A-Za-z]+)\s+(\d+)/);
  return start ? Date.parse(`${start[1]} ${start[2]}, ${r.year}`) || r.year : r.year;
}
