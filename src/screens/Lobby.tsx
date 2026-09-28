import React from 'react';
import { ROLE_LABEL } from '../data/rosters';
import * as G from '../game/logic';
import { Action } from '../game/state';
import { Avatar, RoleIcon, TeamBadge } from '../ui/art';
import { fmt, ratingClass } from '../ui/util';

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
            {st && <span className="lobby__stat"><small>{st.k}–{st.d}</small><b className={ratingClass(st.rating)}>{fmt(st.rating)}</b></span>}
          </li>
        );
      })}
    </ul>
  );
}

export function ReadyScreen({ mine, dispatch }: { mine: G.Lineup[]; dispatch: React.Dispatch<Action> }) {
  const orgs = new Set(mine.map((x) => x.roster.org));
  const offRoles = mine.filter((x) => x.player.roles[0] !== x.slot).length;
  return (
    <div className="stack">
      <RosterList mine={mine} />
      <div className="notes">
        <span>{offRoles === 0 ? 'Everyone on their main role' : `${offRoles} player${offRoles > 1 ? 's' : ''} off their main role`}</span>
        <span>{orgs.size < 5 ? 'Shared history: small chemistry bonus' : 'Five different organizations'}</span>
      </div>
      <p className="muted small">Qualification: two Bo1 wins to reach the playoffs, two losses and you're out. Quarterfinal, semifinal and grand final are best of three.</p>
      <button className="cta cta--go" onClick={() => dispatch({ type: 'play' })}>Find match</button>
    </div>
  );
}
