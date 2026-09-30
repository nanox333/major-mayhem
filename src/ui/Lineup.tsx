import React from 'react';
import { Run, draftRounds } from '../game/state';
import { ROLE_SHORT } from '../data/rosters';
import { RoleIcon, Sr } from './art';
import { PlusIcon } from './icons';
import { slotsOf } from './TeamStrip';

/**
 * Your lineup as a panel (#102): a row per slot with the photo, nick, team and year and the team's logo, and "Add player" where it is still open.
 * It is the wide-screen version of the team strip. A row shows the slot you chose, never a player's own role, so hard mode reveals nothing.
 */
export function LineupPanel({ s }: { s: Run }) {
  const slots = slotsOf(s);
  const filled = slots.filter((x) => x.who).length;
  return (
    <section className="lineup" aria-labelledby="lineup-h">
      <h3 id="lineup-h" className="lineup__head">Your lineup <span>{filled} / {draftRounds(s)}</span></h3>
      <ol className="lineup__rows">
        {slots.map((x) => (
          <li key={x.key} className={`lrow ${x.who ? 'is-full' : ''}`}>
            <span className={`lrow__face ${x.who ? '' : 'is-empty'}`}>{x.who ? x.who.face : x.role ? <RoleIcon role={x.role} size={18} /> : <span>{x.label[0]}</span>}</span>
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
