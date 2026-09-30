import React, { useId } from 'react';
import { Run, draftRounds } from '../game/state';
import { ROLE_SHORT } from '../data/rosters';
import * as G from '../game/logic';
import { Preview } from '../game/draftui';
import { Avatar, RoleIcon, Sr, TeamBadge } from './art';
import { BenchIcon, CoachIcon, PlusIcon } from './icons';
import { slotsOf } from './TeamStrip';

/**
 * Your lineup as a panel (#102): a row per slot with the photo, nick, team and year and the team's logo, and "Add player" where it is still open.
 * It is the wide-screen version of the team strip. A row shows the slot you chose, never a player's own role, so hard mode reveals nothing.
 */
export function LineupPanel({ s, preview }: { s: Run; /** The player or coach you are pointing at, shown as a ghost row in the slot they would take (#143). */ preview?: Preview | null }) {
  const lineup_h = useId();
  const slots = slotsOf(s);
  const filled = slots.filter((x) => x.who).length;
  const roster = preview ? G.rosterById.get(preview.rosterId) : undefined;
  const pl = roster && preview?.playerId ? roster.players.find((p) => p.id === preview.playerId) : undefined;
  const ghost = roster && preview ? { key: preview.slot, nick: pl?.nick ?? preview.coach ?? '', from: `${roster.org} ${roster.year}`, face: pl ? <Avatar player={pl} roster={roster} /> : <TeamBadge roster={roster} size={34} /> } : null;
  return (
    <section className="lineup" aria-labelledby={lineup_h}>
      <h3 id={lineup_h} className="lineup__head">Your lineup <span>{filled} / {draftRounds(s)}</span></h3>
      <ol className="lineup__rows">
        {slots.map((x) => ghost && !x.who && ghost.key === x.key ? (
          <li key={x.key} className="lrow is-preview">
            <span className="lrow__face">{ghost.face}</span>
            <span className="lrow__text"><span className="lrow__line"><b>{ghost.nick}</b></span><small>{ghost.from}</small></span>
            <span className="lrow__pv">Preview<Sr>: {ghost.nick} would go in {x.label}</Sr></span>
          </li>
        ) : (
          <li key={x.key} className={`lrow ${x.who ? 'is-full' : ''}`}>
            <span className={`lrow__face ${x.who ? '' : 'is-empty'}`}>{x.who ? x.who.face : x.role ? <RoleIcon role={x.role} size={18} /> : x.key === 'coach' ? <CoachIcon size={18} /> : <BenchIcon size={18} />}</span>
            {x.who ? (
              <>
                <span className="lrow__text">
                  <span className="lrow__line"><b>{x.who.nick}</b><span className="lrow__slot" title={x.label}>{x.role && <RoleIcon role={x.role} size={11} />}<span aria-hidden="true">{x.role ? ROLE_SHORT[x.role] : x.label}</span><Sr>{x.label}</Sr></span></span>
                  <small>{x.who.from}</small>
                </span>
                {x.who.badge}
              </>
            ) : (
              <span className="lrow__text"><b className="lrow__add"><PlusIcon size={13} /> Add player</b><small>{x.label}</small></span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
