import React, { useState } from 'react';
import { ROLE_LABEL, ROLE_ORDER, ROLE_SHORT, Role } from '../data/rosters';
import { Preview } from '../game/draftui';
import * as G from '../game/logic';
import { Run, draftRounds, roundNumber, roundOf } from '../game/state';
import { Avatar, RoleIcon, TeamBadge } from './art';
import { BenchIcon, CoachIcon, PlusIcon } from './icons';

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
 * Your team filling up as you draft (#69): the seven slots in one row above the case. A filled slot shows the photo, the nick, the slot you chose and the pick's team and year; an open one shows its role icon and "+".
 * The slot is where you put the player, never the player's own role, so hard mode shows nothing it shouldn't.
 * Pointing at a player in the case previews them in the slot they would take (#143). On a phone this row gives way to the lineup sheet (MobileLineup).
 */
export function TeamStrip({ s, preview }: { s: Run; /** The player or coach you are pointing at in the case, shown as a ghost in the slot they would take (#143). */ preview?: Preview | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const slots = slotsOf(s);
  const filled = slots.filter((x) => x.who).length;
  const next = roundOf(s) === 'player' ? null : roundOf(s);
  const picked = slots.find((x) => x.key === open && x.who);
  const left = slots.filter((x) => !x.who).map((x) => x.label);
  const roster = preview ? G.rosterById.get(preview.rosterId) : undefined;
  const pl = roster && preview?.playerId ? roster.players.find((p) => p.id === preview.playerId) : undefined;
  const ghost = roster && preview ? { key: preview.slot, nick: pl?.nick ?? preview.coach ?? '', from: `${roster.org} ${roster.year}`, face: pl ? <Avatar player={pl} roster={roster} /> : <TeamBadge roster={roster} size={34} /> } : null;
  return (
    <div className="strip">
      <ol className="strip__slots" aria-label={`Your team: ${filled} of ${draftRounds(s)} drafted`}>
        {slots.map((x) => {
          const pv = ghost && !x.who && ghost.key === x.key ? ghost : null;
          return (
            <li key={x.key} className={`strip__slot ${x.who ? 'is-full' : ''} ${pv ? 'is-preview' : ''} ${x.key === next ? 'is-next' : ''}`}>
              {x.who ? (
                <button type="button" aria-pressed={open === x.key} aria-label={`${x.label}: ${x.who.nick}, ${x.who.from}`} title={`${x.label}: ${x.who.nick}, ${x.who.from}`} data-sfx="none" onClick={() => setOpen(open === x.key ? null : x.key)}>
                  <span className="strip__face">{x.who.face}</span>
                  <span className="strip__text">
                    <span className="strip__nick">{x.who.nick}</span>
                    <span className="strip__sub"><span className="strip__role">{x.role && <RoleIcon role={x.role} size={11} />} {x.role ? ROLE_SHORT[x.role] : x.label}</span><span className="strip__from">{x.who.from}</span></span>
                  </span>
                </button>
              ) : pv ? (
                <div title={`${x.label}: ${pv.nick} would go here`} role="img" aria-label={`${x.label}: preview, ${pv.nick} would go here`}>
                  <span className="strip__face">{pv.face}</span>
                  <span className="strip__text">
                    <span className="strip__nick">{pv.nick}</span>
                    <span className="strip__sub"><span className="strip__role">Preview</span><span className="strip__from">{x.label}</span></span>
                  </span>
                </div>
              ) : (
                <div title={`${x.label}: open`} role="img" aria-label={`${x.label}: open`}>
                  <span className="strip__face strip__face--empty">{x.role ? <RoleIcon role={x.role} size={18} /> : x.key === 'coach' ? <CoachIcon size={18} /> : <BenchIcon size={18} />}</span>
                  <span className="strip__text"><span className="strip__sub"><span className="strip__role"><PlusIcon size={11} /> {x.label}</span></span></span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {/* The round and what's left are already in the heading and the slots above; the caption only speaks up for a tapped pick (screen readers still get the status). */}
      <p className={`strip__caption ${picked?.who ? '' : 'sr'}`} aria-live="polite">
        {picked?.who ? <><b>{picked.label}</b> · {picked.who.nick} · {picked.who.from}</>
          : <>Round {roundNumber(s)} of {draftRounds(s)}{left.length ? <> · Still to fill: {left.join(', ')}</> : null}</>}
      </p>
    </div>
  );
}
