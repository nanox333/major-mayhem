import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ROSTERS, ROLE_SHORT, Roster } from '../data/rosters';
import { COUNTRY, NATION, synergies, strength } from '../game/synergy';
import { naturalLineup } from '../game/lineup';
import { chemistryWord } from '../game/draftui';
import { Avatar, RoleIcon, TeamBadge } from './art';
import { Flag } from './flags';
import { ArrowRightIcon, RosterIcon } from './icons';
import { Modal } from './Modal';
import { useDebugRatings } from './debugFlags';

const PAGE = 20;

/** True on a phone-width screen; the archive shows its list in pages of PAGE there and all at once elsewhere. */
function usePhone() {
  const q = '(max-width: 640px)';
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia(q);
    const f = () => setOn(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return on;
}

/** Reference data only: inspecting a roster never dispatches a game action. */
export function RosterBrowser({ initialId, hard, onClose, page }: { initialId?: string; hard: boolean; onClose: () => void; /** Shown as its own page (the Roster archive) instead of a pop-up. */ page?: boolean }) {
  const [id, setId] = useState(initialId ?? null);
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('');
  const [placement, setPlacement] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const search = useRef<HTMLInputElement>(null);
  const phone = usePhone();
  const ratings = useDebugRatings();
  const [shown, setShown] = useState(PAGE);
  const [far, setFar] = useState(false);
  useEffect(() => { if (!id) search.current?.focus({ preventScroll: true }); }, [id]);
  // A new filter starts the list over at its first page.
  useEffect(() => { setShown(PAGE); }, [query, year, placement, sort]);
  // The back-to-top button shows once the list has scrolled well past the filters.
  useEffect(() => {
    if (!page || !phone) { setFar(false); return; }
    const f = () => setFar(scrollY > 700);
    f();
    addEventListener('scroll', f, { passive: true });
    return () => removeEventListener('scroll', f);
  }, [page, phone]);
  const roster = ROSTERS.find(r => r.id === id);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ROSTERS.filter(r => (!year || String(r.year) === year) && (!placement || r.result === placement)
      && `${r.org} ${r.event} ${r.coach ?? ''} ${r.players.map(p => `${p.nick} ${p.name ?? ''}`).join(' ')}`.toLowerCase().includes(q))
      .sort(COMPARE[sort]);
  }, [query, year, placement, sort]);
  const chrono = sort === 'newest' || sort === 'oldest';
  const groups = useMemo(() => (chrono ? [] : groupLineups(list, sort)), [list, sort, chrono]);
  const card = (r: Roster, line: string) => <li key={r.id}>
    <button type="button" className={`ra-card ra-card--${resultClass(r.result)}`} style={{ ['--team' as string]: r.color }} onClick={() => setId(r.id)} aria-label={`${r.org} ${r.year}, ${r.event}, ${r.result}`}>
      <span className="ra-card__top">
        <TeamBadge roster={r} size={44} />
        <span className="ra-card__main"><b>{r.org}</b><small>{line}</small></span>
        <span className={`ra-row__result ra-row__result--${resultClass(r.result)}`}>{r.result}</span>
      </span>
      <span className="ra-card__roster">{r.players.map(p => <span key={p.id} className="ra-face"><Avatar player={p} roster={r} /><i>{p.nick}</i>{ratings && <u title="Game rating (debug)">{p.rating}</u>}</span>)}</span>
      {r.unverified && <span className="ra-card__flag">Unverified lineup</span>}
    </button>
  </li>;
  const body = <>
    {roster ? <>
      {!initialId && <button type="button" className="rs-back" onClick={() => setId(null)}><ArrowRightIcon size={16} /><span>All lineups</span></button>}
      <RosterDetails roster={roster} hard={hard} onOpen={setId} />
    </> : <>
      <header className="ra-intro">
        <span className="ra-intro__icon" aria-hidden="true"><RosterIcon size={34} /></span>
        <div className="ra-intro__body">
        <p className="ra-intro__kicker">Reference</p>
        <h3>Roster archive</h3>
        <p>Every lineup in the game, with its event and sources. This is not a full career history.</p>
        <ul className="ra-stats" aria-label="Archive size">
          <li><b>{ROSTERS.length}</b><span>lineups</span></li>
          <li><b>{new Set(ROSTERS.map(r => r.event)).size}</b><span>Majors</span></li>
          <li><b>{new Set(ROSTERS.map(r => r.org)).size}</b><span>teams</span></li>
        </ul>
              </div>
      </header>
      <div className="roster-filters">
        <label>Team or player<input ref={search} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Team, nick or real name" /></label>
        <label>Year<select value={year} onChange={e => setYear(e.target.value)}><option value="">All years</option>{[...new Set(ROSTERS.map(r => r.year))].sort((a,b) => b-a).map(y => <option key={y}>{y}</option>)}</select></label>
        <div className="ra-chips ra-chips--row" role="group" aria-label="Placement">
          <span className="ra-chips__label">Show</span>
          <button type="button" aria-pressed={!placement} onClick={() => setPlacement('')}>All</button>
          {[...new Set(ROSTERS.map(r => r.result))].map(x => <button key={x} type="button" aria-pressed={placement === x} onClick={() => setPlacement(placement === x ? '' : x)}>{x}</button>)}
        </div>
        <div className="ra-chips ra-chips--row ra-sort" role="group" aria-label="Sort by">
          <span className="ra-chips__label">Sort</span>
          {SORTS.map(([v, name]) => <button key={v} type="button" aria-pressed={sort === v} onClick={() => setSort(v)}>{name}</button>)}
        </div>
      </div>
      <p role="status" className="ra-count">{phone && list.length > shown ? `Showing ${shown} of ${list.length} rosters` : `${list.length} roster${list.length === 1 ? '' : 's'}`}</p>
      {!list.length && <div className="ra-empty"><p>No rosters match these filters.</p><button className="ghost-btn" onClick={() => { setQuery(''); setYear(''); setPlacement(''); setSort('newest'); }}>Clear filters</button></div>}
      {chrono ? byYear(phone ? list.slice(0, shown) : list).map(([y, rows]) => <section key={y} className="ra-year" aria-label={String(y)}>
        <h4>{y}<small>{rows.length} lineup{rows.length === 1 ? '' : 's'}</small></h4>
        {byEvent(rows).map(([ev, group]) => <div key={ev} className="ra-event">
          <h5><b>{ev}</b><span>{group[0].dates}</span></h5>
          <ul className="ra-rows">{group.map(r => card(r, r.coach ? `Coach ${r.coach}` : r.event))}</ul>
        </div>)}
      </section>) : limitGroups(groups, phone ? shown : Infinity).map(g => <section key={g.key} className="ra-year" aria-label={g.title}>
        <h4 className="ra-group">{g.badge && <TeamBadge roster={g.badge} size={40} />}<span className="ra-group__name">{g.title}</span><span className="ra-group__stats">{g.stats.map(x => <em key={x} className={/title/.test(x) ? 'is-gold' : ''}>{x}</em>)}</span></h4>
        <ul className="ra-rows">{g.rows.map(r => card(r, `${r.year} · ${r.event}`))}</ul>
      </section>)}
      {phone && list.length > shown && <button type="button" className="ghost-btn ra-more" onClick={() => setShown(n => n + PAGE)}>Show {Math.min(PAGE, list.length - shown)} more <span>({list.length - shown} left)</span></button>}
      {far && <button type="button" className="ra-top" onClick={() => scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })} aria-label="Back to the top of the archive">↑ Top</button>}
    </>}
  </>;
  return page ? <main className="console archive-page">{body}</main>
    : <Modal label={roster ? `${roster.org} ${roster.year} roster` : 'Roster browser'} onClose={onClose} sheet wide>{body}</Modal>;
}

type Sort = 'newest' | 'oldest' | 'placement' | 'team' | 'titles';
const SORTS: [Sort, string][] = [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['placement', 'Best placing'], ['team', 'Team A–Z'], ['titles', 'Most titles']];
const titlesOf = (org: string) => ROSTERS.filter(r => r.org === org && r.result === 'Champions').length;
const lineupsOf = (org: string) => ROSTERS.filter(r => r.org === org).length;
const inEvent = (a: Roster, b: Roster) => a.event.localeCompare(b.event) || rank(a) - rank(b) || a.org.localeCompare(b.org);
/** Each sort is a total order, so the list never reshuffles between equal rows. */
const COMPARE: Record<Sort, (a: Roster, b: Roster) => number> = {
  newest: (a, b) => eventTime(b) - eventTime(a) || inEvent(a, b),
  oldest: (a, b) => eventTime(a) - eventTime(b) || inEvent(a, b),
  placement: (a, b) => rank(a) - rank(b) || eventTime(b) - eventTime(a) || a.org.localeCompare(b.org),
  team: (a, b) => a.org.localeCompare(b.org) || eventTime(a) - eventTime(b),
  titles: (a, b) => titlesOf(b.org) - titlesOf(a.org) || lineupsOf(b.org) - lineupsOf(a.org) || a.org.localeCompare(b.org) || eventTime(a) - eventTime(b),
};
interface Group { key: string; title: string; stats: string[]; badge?: Roster; rows: Roster[] }
/** The list in sections for the sorts that aren't by date: one per placing, or one per team with what it won. */
function groupLineups(list: Roster[], sort: Sort): Group[] {
  const out: Group[] = [];
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  for (const r of list) {
    const key = sort === 'placement' ? r.result : r.org;
    const last = out[out.length - 1];
    if (last && last.key === key) last.rows.push(r); else out.push({ key, title: key, stats: [], rows: [r] });
  }
  for (const g of out) {
    if (sort === 'placement') { g.stats = [plural(g.rows.length, 'lineup')]; continue; }
    const titles = g.rows.filter(r => r.result === 'Champions').length;
    const years = g.rows.map(r => r.year);
    const span = Math.min(...years) === Math.max(...years) ? String(years[0]) : `${Math.min(...years)}–${Math.max(...years)}`;
    g.badge = g.rows[g.rows.length - 1];
    g.stats = [plural(g.rows.length, 'lineup'), ...(titles ? [plural(titles, 'title')] : []), span];
  }
  return out;
}
/** On a phone the groups are cut at `max` lineups in total, so "show more" works the same for every sort. */
function limitGroups(groups: Group[], max: number): Group[] {
  if (max === Infinity) return groups;
  let left = max;
  const out: Group[] = [];
  for (const g of groups) { if (left <= 0) break; out.push({ ...g, rows: g.rows.slice(0, left) }); left -= g.rows.length; }
  return out;
}

/** How a placing ranks, best first. */
const RANK: Record<string, number> = { Champions: 0, 'Runner-up': 1, Semifinalist: 2, Quarterfinalist: 3 };
const rank = (r: Roster) => RANK[r.result] ?? 9;
const era = (r: Roster) => (r.year >= 2024 ? 'CS2' : 'CS:GO');

/** One lineup as a sheet: who played, where they are from, how the team did, and how it sits in the archive. Reference only; it never touches a run. */
function RosterDetails({ roster: r, hard, onOpen }: { roster: Roster; hard: boolean; onOpen: (id: string) => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [r.id]);
  const countries = useMemo(() => {
    const n = new Map<string, number>();
    for (const p of r.players) n.set(p.country, (n.get(p.country) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1]);
  }, [r]);
  // The links the lineup brings with it, as the draft counts them (never from ratings).
  const chem = useMemo(() => { const rows = synergies(naturalLineup(r), r.coach); return { rows, ...chemistryWord(rows) }; }, [r]);
  const field = ROSTERS.filter(x => x.event === r.event).sort((a, b) => rank(a) - rank(b) || a.org.localeCompare(b.org));
  const history = ROSTERS.filter(x => x.org === r.org).sort((a, b) => a.year - b.year || eventTime(a) - eventTime(b));
  const links = ROSTERS.filter(x => x.org === r.org && x.id !== r.id).length;
  const ratings = useDebugRatings();
  return <section className="rs" style={{ ['--team' as string]: r.color }}>
    <header className="rs-head">
      <TeamBadge roster={r} size={84} />
      <div className="rs-head__text">
        <p className="rs-head__event">{r.event}</p>
        <h3 ref={heading} tabIndex={-1}>{r.org} <em>{r.year}</em></h3>
        <p className="rs-head__meta"><b className={`ra-row__result ra-row__result--${resultClass(r.result)}`}>{r.result}</b><span>{r.dates}</span></p>
      </div>
    </header>
    {r.unverified && <p role="note" className="ra-note">This lineup still needs source verification.</p>}

    <ul className="rs-facts" aria-label="At a glance">
      <li><small>Placement</small><b>{r.result}</b></li>
      <li><small>Era</small><b>{era(r)}</b></li>
      <li><small>Nationalities</small><b className="rs-flags">{countries.map(([c, n]) => <span key={c} title={`${n} ${NATION[c] ?? c}`}><Flag code={c} size={14} decorative />{n > 1 && <i>{n}</i>}</span>)}</b></li>
      <li><small>Coach</small><b>{r.coach ?? 'Not recorded'}</b></li>
    </ul>

    <h4 className="rs-sub">Lineup</h4>
    <ul className="rs-lineup">{r.players.map(p => <li key={p.id} className="rs-player">
      <span className="rs-player__photo"><Avatar player={p} roster={r} />{ratings && <u className="rs-player__rating" title="Game rating (debug)">{p.rating}</u>}</span>
      <span className="rs-player__text">
        <b>{p.nick}</b>
        {p.name && <span className="rs-player__real">{p.name}</span>}
        <small><Flag code={p.country} size={12} decorative />{COUNTRY[p.country] ?? p.country}</small>
        {!hard && <span className="rs-roles">{p.roles.map((role, i) => <em key={role} className={i === 0 ? 'is-main' : ''}><RoleIcon role={role} size={12} />{ROLE_SHORT[role]}</em>)}</span>}
      </span>
    </li>)}</ul>

    {!hard && <>
      <h4 className="rs-sub">Chemistry as a lineup</h4>
      <div className="rs-chem">
        <p className="rs-chem__word"><b>{chem.word}</b><span className="pips" aria-hidden="true">{[1, 2, 3].map(i => <i key={i} className={i <= chem.pips ? 'on' : ''} />)}</span></p>
        {chem.rows.length ? <ul className="rs-chem__links">{chem.rows.map(x => <li key={x.label} className={x.value < 0 ? 'is-bad' : ''}><b>{strength(x.value)}</b>{x.label}</li>)}</ul> : <p className="muted small">No links between these five.</p>}
      </div>
    </>}

    <h4 className="rs-sub">At this Major <small>{field.length} lineup{field.length === 1 ? '' : 's'} in the archive</small></h4>
    <ol className="rs-field">{field.map(x => <li key={x.id}>
      <button type="button" className={x.id === r.id ? 'is-now' : ''} aria-current={x.id === r.id ? 'true' : undefined} onClick={() => onOpen(x.id)} style={{ ['--team' as string]: x.color }}>
        <TeamBadge roster={x} size={30} /><b>{x.org}</b><span className={`ra-row__result ra-row__result--${resultClass(x.result)}`}>{x.result}</span>
      </button>
    </li>)}</ol>

    <h4 className="rs-sub">{r.org} in the archive <small>{history.length} lineup{history.length === 1 ? '' : 's'}</small></h4>
    {links ? <ol className="rs-history">{history.map(x => <li key={x.id}>
      <button type="button" className={x.id === r.id ? 'is-now' : ''} aria-current={x.id === r.id ? 'true' : undefined} onClick={() => onOpen(x.id)}>
        <b>{x.year}</b><span>{x.event}</span><em className={`ra-row__result ra-row__result--${resultClass(x.result)}`}>{x.result}</em>
      </button>
    </li>)}</ol> : <p className="muted small">No other lineup from this team is included.</p>}

    <p className="ra-fine">{hard ? 'Role hints are hidden while your hard-mode run is unfinished.' : 'Roles are assigned for this game, not official historical statistics.'} Player strength and match ratings are simulation values and are not shown here.</p>
    <div className="src-links ra-links">{r.liquipediaUrl ? <a href={r.liquipediaUrl} target="_blank" rel="noreferrer">Liquipedia roster</a> : <span>Liquipedia source unavailable</span>}{r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noreferrer">Event standings source</a> : <span>Event source unavailable</span>}
      <a href={`https://github.com/nanox333/major-mayhem/issues/new?template=roster_data.yml&roster=${encodeURIComponent(`${r.org} ${r.year} (${r.event})`)}`} target="_blank" rel="noreferrer">Report incorrect data</a></div>
  </section>;
}

/** A year's lineups grouped by Major, in the order given. */
function byEvent(list: Roster[]): [string, Roster[]][] {
  const out: [string, Roster[]][] = [];
  for (const r of list) {
    const last = out[out.length - 1];
    if (last && last[0] === r.event) last[1].push(r); else out.push([r.event, [r]]);
  }
  return out;
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
