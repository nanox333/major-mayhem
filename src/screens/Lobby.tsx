import React from 'react';
import { ROLE_LABEL } from '../data/rosters';
import * as G from '../game/logic';
import { Action, Run, benchLineup } from '../game/state';
import { challengerLineup } from '../game/duel';
import { Avatar, RatingMark, RoleIcon, Sr, TeamBadge } from '../ui/art';
import { fmt, ratingClass } from '../ui/util';
import { Synergy, strength } from '../game/synergy';
import { mapComfort } from '../game/draftui';

export function RosterList({ mine, stats, mvpId }: { mine: G.Lineup[]; stats?: Record<string, { k: number; d: number; rating: number }>; mvpId?: string }) {
  return (
    <ul className="lobby">
      {mine.map((l, i) => {
        const main = l.player.roles[0] === l.slot;
        const st = stats?.[l.player.id];
        return (
          <li key={l.player.id} className={`lobby__row anim-in ${mvpId === l.player.id ? 'is-mvp' : ''}`} style={{ animationDelay: `${i * 55}ms` }}>
            <span className="lobby__avatar"><Avatar player={l.player} roster={l.roster} /></span>
            <span className="lobby__who">
              <strong>{l.player.nick}{mvpId === l.player.id && <em className="mvp-tag">★ MVP</em>}</strong>
              <small><TeamBadge roster={l.roster} size={14} /> {l.roster.org} {l.roster.year}</small>
            </span>
            <span className="lobby__slot" title={main ? 'Main role' : 'Playing an off-role (small penalty)'}>
              <RoleIcon role={l.slot} size={14} /> {ROLE_LABEL[l.slot]}{!main && <i className="offrole">off-role</i>}
            </span>
            {st && <span className="lobby__stat"><small>{st.k}–{st.d}</small><b className={ratingClass(st.rating)}>{fmt(st.rating)}<RatingMark r={st.rating} /></b></span>}
          </li>
        );
      })}
    </ul>
  );
}

/** The synergies behind a lineup's chemistry, strongest first, with their size as + / − marks. */
export function SynergyList({ list }: { list: Synergy[] }) {
  if (!list.length) return <p className="muted small">No synergies: five strangers from five different eras and countries.</p>;
  return (
    <ul className="synergies">
      {list.map((x) => (
        <li key={x.label} className={`syn syn--${x.kind} ${x.value < 0 ? 'is-bad' : ''}`}>
          <b>{strength(x.value)}</b><span>{x.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** The team you're drafting against in a duel. */
function Challenger({ s }: { s: Run }) {
  const d = s.duel!;
  const lineup = challengerLineup(d);
  return (
    <div className="challenger">
      <small>Your opponent: {d.name}'s team, best of three</small>
      <ul>{lineup.map((l) => <li key={l.player.id}><RoleIcon role={l.slot} size={12} /> {l.player.nick} <span className="muted">{l.roster.org} {l.roster.year}</span></li>)}</ul>
      {d.coach && <span className="muted small">Coach {d.coach}</span>}
    </div>
  );
}

/** The coach and the bench player, under the five starters. */
export function Staff({ s, stats }: { s: Run; stats?: Record<string, { k: number; d: number; rating: number }> }) {
  const bench = benchLineup(s);
  const from = s.coachFrom ? G.rosterById.get(s.coachFrom) : undefined;
  if (!s.coach && !bench) return null;
  const st = bench ? stats?.[bench.player.id] : undefined;
  return (
    <ul className="lobby lobby--staff">
      {s.coach && (
        <li className="lobby__row">
          <span className="lobby__avatar lobby__avatar--coach">{from ? <TeamBadge roster={from} size={30} /> : 'C'}</span>
          <span className="lobby__who"><strong>{s.coach}</strong><small>{from ? `Coach of ${from.org} ${from.year}` : 'Coach'}</small></span>
          <span className="lobby__slot">Coach</span>
        </li>
      )}
      {bench && (
        <li className="lobby__row">
          <span className="lobby__avatar"><Avatar player={bench.player} roster={bench.roster} /></span>
          <span className="lobby__who"><strong>{bench.player.nick}</strong><small><TeamBadge roster={bench.roster} size={14} /> {bench.roster.org} {bench.roster.year}</small></span>
          <span className="lobby__slot"><RoleIcon role={bench.player.roles[0]} size={14} /> Bench</span>
          {st && <span className="lobby__stat"><small>{st.k}–{st.d}</small><b className={ratingClass(st.rating)}>{fmt(st.rating)}<RatingMark r={st.rating} /></b></span>}
        </li>
      )}
    </ul>
  );
}

export function ReadyScreen({ mine, s, dispatch }: { mine: G.Lineup[]; s: Run; dispatch: React.Dispatch<Action> }) {
  const offRoles = mine.filter((x) => x.player.roles[0] !== x.slot).length;
  const power = G.teamPower(mine, s.coach);
  return (
    <div className="stack">
      <RosterList mine={mine} />
      <Staff s={s} />
      <div className="notes">
        <span>{offRoles === 0 ? 'Everyone on their main role' : `${offRoles} player${offRoles > 1 ? 's' : ''} off their main role`}</span>
      </div>
      <SynergyList list={power.synergies} />
      <MapComfort mine={mine} />
      {s.duel && <Challenger s={s} />}
      {!s.duel && <p className="muted small">Swiss stage: three wins to reach the playoffs, three losses and you're out. Matches that can send you through or out are best of three, like the quarterfinal, semifinal and grand final.{s.bench ? ' Before each match, check everyone\'s form: you can sub your bench player in.' : ''}</p>}
      <div className="action-bar"><button className="cta cta--go" data-sfx="accept" onClick={() => dispatch({ type: 'play' })}>{s.duel ? 'Play the showmatch' : 'Find match'}</button></div>
    </div>
  );
}

/**
 * Which maps your five are at home on, before the first veto (#49), so the veto isn't a surprise. The same comfort the veto panel compares with the
 * opponent's, shown as pips and a word; the opponent's comfort still decides who has the edge, so this is half of the picture.
 */
function MapComfort({ mine }: { mine: G.Lineup[] }) {
  const maps = mapComfort(mine);
  return (
    <section className="comfort" aria-labelledby="comfort-h">
      <h4 id="comfort-h">Your maps <small>Where your five are most at home. Your opponent's comfort decides the veto too.</small></h4>
      <ul>
        {maps.map((x) => (
          <li key={x.map} className={`comfort--${x.word}`}>
            <b>{x.map}</b>
            <span className="comfort__pips" aria-hidden="true">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= x.pips ? 'on' : ''} />)}</span>
            <span>{x.word}<Sr>: {x.pips} of 5</Sr></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
