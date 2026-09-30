// The draft review on the results screen: each pick against the best one that was on the board that round.
import { Player, Role, Roster } from '../data/rosters';
import { Pick, draftedIds, eligibleSlots, openSlots } from './offers';
import { pickValue, rosterById } from './lineup';

export interface PickReview {
  slot: Role;
  player: Player;
  roster: Roster;
  value: number;
  /** Strongest pick that was on the board that round (from the same case), or null if the case wasn't recorded. */
  best: { player: Player; roster: Roster; slot: Role; value: number } | null;
}


/** Compare each pick with the best one available in its case that round. Picks are in draft order. */
export function draftReview(picks: Pick[], hard = false): { rounds: PickReview[]; grade: number | null } {
  const rounds = picks.map((pk, i) => {
    const before = picks.slice(0, i);
    const roster = rosterById.get(pk.rosterId)!;
    const player = roster.players.find((p) => p.id === pk.playerId)!;
    let best: PickReview['best'] = null;
    for (const id of pk.offer ?? []) {
      const r = rosterById.get(id);
      if (!r) continue;
      for (const p of r.players) for (const slot of hard ? (draftedIds(before).has(p.id) ? [] : openSlots(before)) : eligibleSlots(p, before)) {
        const v = pickValue(p, slot);
        if (!best || v > best.value) best = { player: p, roster: r, slot, value: v };
      }
    }
    return { slot: pk.slot, player, roster, value: pickValue(player, pk.slot), best };
  });
  const scored = rounds.filter((r) => r.best);
  const grade = scored.length ? scored.reduce((a, r) => a + r.value, 0) / scored.reduce((a, r) => a + r.best!.value, 0) : null;
  return { rounds, grade };
}
