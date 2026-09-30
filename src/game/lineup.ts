// Turning picks and rosters into five players in five slots, and how strong that is: role fit, match-day form, chemistry and the coach.
import { ROLE_ORDER, ROSTERS, Role, Roster, Player } from '../data/rosters';
import { Synergy, chemistryOf, coachBonus, synergies } from './synergy';
import { random } from './random';
import { onRulesChange } from './rulesState';
import type { Pick } from './offers';

export const rosterById = new Map(ROSTERS.map((r) => [r.id, r]));

// ---------- match-day form and the bench ----------

/** How each player feels on match day, in rating points. Rolled per match; the bench player can cover a cold one. */
export const FORM_STEPS = [{ v: 4, label: 'Hot', p: 0.12 }, { v: 2, label: 'Good', p: 0.23 }, { v: 0, label: 'Normal', p: 0.45 }, { v: -3, label: 'Cold', p: 0.2 }];
export function rollForm(ids: string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id) => {
    let r = random();
    const step = FORM_STEPS.find((s) => (r -= s.p) < 0) ?? FORM_STEPS[2];
    return [id, step.v];
  }));
}
export const formLabel = (v: number | undefined) => FORM_STEPS.find((s) => s.v === v)?.label ?? 'Normal';

/**
 * The five who play a match: your starters with the bench player in for `subOut` (in the same slot), each rated
 * with their match-day form.
 */
export function matchLineup(base: Lineup[], bench: Lineup | null, subOut: string | null | undefined, form: Record<string, number> | undefined): Lineup[] {
  return base.map((x) => {
    const l = subOut && bench && x.player.id === subOut ? { ...bench, slot: x.slot } : x;
    const f = form?.[l.player.id] ?? 0;
    return f ? { ...l, player: { ...l.player, rating: Math.max(60, Math.min(99, l.player.rating + f)) } } : l;
  });
}

// ---------- strength ----------

/** What playing `p` in `slot` means, in words, for draft and substitution buttons (#17). */
export function fitNote(p: Player, slot: Role): { kind: 'main' | 'secondary' | 'off'; text: string } {
  const f = fit(p, slot);
  return f === 1 ? { kind: 'main', text: 'main role' }
    : f > 0.9 ? { kind: 'secondary', text: 'secondary role, small penalty' }
      : { kind: 'off', text: 'off-role, big penalty' };
}
export const fit = (p: Player, slot: Role) => (p.roles[0] === slot ? 1 : p.roles.includes(slot) ? 0.965 : 0.86);
/** Game value of a pick: rating adjusted for role fit. */
export const pickValue = (p: Player, slot: Role) => p.rating * fit(p, slot);

export interface Lineup { slot: Role; player: Player; roster: Roster }

export function lineupFromPicks(picks: Pick[]): Lineup[] {
  return ROLE_ORDER.map((slot) => {
    const pk = picks.find((p) => p.slot === slot)!;
    const roster = rosterById.get(pk.rosterId)!;
    return { slot, roster, player: roster.players.find((p) => p.id === pk.playerId)! };
  });
}

/** Best slot assignment for a real roster (brute force over 120 permutations, cached per roster). */
const natural = new Map<string, Lineup[]>();
/** Made-up teams (duel challengers): their lineups are fixed, so a rules change keeps them. */
const registered = new Set<string>();
// Lineups depend on roles, which follow the rules version, so a rules change drops the cached ones (made-up teams keep theirs).
onRulesChange(() => { for (const id of [...natural.keys()]) if (!registered.has(id)) natural.delete(id); });
/**
 * Adds a made-up team (a friend's drafted five, for a duel) that plays like a roster. Its lineup keeps each player's
 * own roster, so map comfort and synergies work as they do for a drafted team.
 */
export function registerTeam(r: Roster, lineup: Lineup[]) {
  rosterById.set(r.id, r);
  natural.set(r.id, lineup);
  registered.add(r.id);
}
export function naturalLineup(r: Roster): Lineup[] {
  let l = natural.get(r.id);
  if (!l) natural.set(r.id, (l = bestLineup(r)));
  return l;
}
function bestLineup(r: Roster): Lineup[] {
  const perms = (a: number[]): number[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  let best: number[] = [0, 1, 2, 3, 4];
  let bestV = -1;
  for (const perm of perms([0, 1, 2, 3, 4])) {
    const v = perm.reduce((s, pi, si) => s + fit(r.players[pi], ROLE_ORDER[si]), 0);
    if (v > bestV) { bestV = v; best = perm; }
  }
  return ROLE_ORDER.map((slot, i) => ({ slot, player: r.players[best[i]], roster: r }));
}

export interface Power { skill: number; balance: number; chemistry: number; coach: number; synergies: Synergy[]; total: number }

/**
 * Team power = average (rating × role fit) + role balance + chemistry (synergies, see synergy.ts) + the coach.
 * Real rosters get their own coach; a drafted team gets the one you picked.
 */
export function teamPower(l: Lineup[], coach?: string | null): Power {
  const skill = l.reduce((s, x) => s + x.player.rating * fit(x.player, x.slot), 0) / l.length;
  const mains = l.filter((x) => x.player.roles[0] === x.slot).length;
  const balance = mains * 0.4 + (l.every((x) => x.player.roles.includes(x.slot)) ? 0.5 : 0);
  const syn = synergies(l, coach);
  const chemistry = chemistryOf(syn);
  const c = coachBonus(coach);
  return { skill, balance, chemistry, coach: c, synergies: syn, total: skill + balance + chemistry + c };
}
/** A real roster at full strength: its natural lineup under its own coach. */
export const rosterPower = (r: Roster) => teamPower(naturalLineup(r), r.coach);
