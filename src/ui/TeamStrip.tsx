import React, { useState } from 'react';
import { ROLE_LABEL, ROLE_ORDER, Role } from '../data/rosters';
import * as G from '../game/logic';
import { Run, draftRounds, roundNumber, roundOf } from '../game/state';
import { Avatar, RoleIcon, TeamBadge } from './art';

export interface Slot {
  key: string;
  label: string;
  /** Set for the five player slots, which show a role icon while empty. */
  role?: Role;
  /** Who is in it, or null while it's empty. `badge` is the team's logo, for the lineup panel. */
  who: { nick: string; from: string; face: React.ReactNode; badge?: React.ReactNode } | null;
}

/** The seven places your team fills up, in draft order: five roles, the coach and the bench. */
export function slotsOf(s: Run): Slot[] {
  const out: Slot[] = ROLE_ORDER.map((role) => {
    const pk = s.picks.find((p) => p.slot === role);
    if (!pk) return { key: role, label: ROLE_LABEL[role], role, who: null };
    const roster = G.rosterById.get(pk.rosterId)!;
    const player = roster.players.find((p) => p.id === pk.playerId)!;
    return { key: role, label: ROLE_LABEL[role], role, who: { nick: player.nick, from: `${roster.org} ${roster.year}`, face: <Avatar player={player} roster={roster} />, badge: <TeamBadge roster={roster} size={26} /> } };
  });
  if (!s.extras) return out;
  const from = s.coachFrom ? G.rosterById.get(s.coachFrom) : undefined;
  out.push({ key: 'coach', label: 'Coach', who: s.coach ? { nick: s.coach, from: from ? `${from.org} ${from.year}` : 'Coach', face: from ? <TeamBadge roster={from} size={36} /> : <>C</>, badge: from ? <TeamBadge roster={from} size={26} /> : undefined } : null });
  const b = s.bench && G.rosterById.get(s.bench.rosterId);
  const bp = b && s.bench ? b.players.find((p) => p.id === s.bench!.playerId) : undefined;
  out.push({ key: 'bench', label: 'Bench', who: b && bp ? { nick: bp.nick, from: `${b.org} ${b.year}`, face: <Avatar player={bp} roster={b} />, badge: <TeamBadge roster={b} size={26} /> } : null });
  return out;
}

/**
 * Your team filling up as you draft (#69): a photo and name in each slot you've filled, an icon in each one still open.
 * The slot is where you put the player, never the player's own role, so hard mode shows nothing it shouldn't.
 * On a phone the names drop out and the strip is seven icons; tapping a filled slot names the pick underneath.
 */
export function TeamStrip({ s }: { s: Run }) {
  const [open, setOpen] = useState<string | null>(null);
  const slots = slotsOf(s);
  const filled = slots.filter((x) => x.who).length;
  const next = roundOf(s) === 'player' ? null : roundOf(s);
  const picked = slots.find((x) => x.key === open && x.who);
  const left = slots.filter((x) => !x.who).map((x) => x.label);
  return (
    <div className="strip">
      <ol className="strip__slots" aria-label={`Your team: ${filled} of ${draftRounds(s)} drafted`}>
        {slots.map((x) => (
          <li key={x.key} className={`strip__slot ${x.who ? 'is-full' : ''} ${x.key === next ? 'is-next' : ''}`}>
            {x.who ? (
              <button type="button" aria-pressed={open === x.key} aria-label={`${x.label}: ${x.who.nick}, ${x.who.from}`} data-sfx="none" onClick={() => setOpen(open === x.key ? null : x.key)}>
                <span className="strip__face">{x.who.face}</span>
                <span className="strip__nick">{x.who.nick}</span>
                <span className="strip__role">{x.role && <RoleIcon role={x.role} size={11} />} {x.label}</span>
              </button>
            ) : (
              <div title={`${x.label}: open`} role="img" aria-label={`${x.label}: open`}>
                <span className="strip__face strip__face--empty">{x.role ? <RoleIcon role={x.role} size={18} /> : x.label[0]}</span>
                <span className="strip__nick">Open</span>
                <span className="strip__role">{x.label}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
      <p className="strip__caption" aria-live="polite">
        {picked?.who ? <><b>{picked.label}</b> · {picked.who.nick} · {picked.who.from}</>
          : <>Round {roundNumber(s)} of {draftRounds(s)}{left.length ? <> · Still to fill: {left.join(', ')}</> : null}</>}
      </p>
    </div>
  );
}
