// What you can draft: which slots are open, who fits them, and the three teams a spin offers.
import { ROLE_ORDER, ROSTERS, Role, Roster, Player } from '../data/rosters';
import { shuffle } from './random';

/** `offer` is the case the pick came from, kept for the end-of-run draft review. */
export interface Pick { slot: Role; rosterId: string; playerId: string; offer?: string[] }

export const openSlots = (picks: Pick[]) => ROLE_ORDER.filter((r) => !picks.some((p) => p.slot === r));
export const draftedIds = (picks: Pick[]) => new Set(picks.map((p) => p.playerId));

/** Open slots this player could fill right now (empty if already drafted). */
export function eligibleSlots(p: Player, picks: Pick[]): Role[] {
  if (draftedIds(picks).has(p.id)) return [];
  const open = openSlots(picks);
  return p.roles.filter((r) => open.includes(r));
}

export const rosterEligible = (r: Roster, picks: Pick[]) => r.players.some((p) => eligibleSlots(p, picks).length > 0);

/**
 * Three distinct teams, each with at least one valid pick. When possible, the three teams
 * together cover every open slot, and they avoid rosters already seen this run.
 */
export function makeOffer(picks: Pick[], seen: string[], rosters: Roster[] = ROSTERS): string[] {
  const open = openSlots(picks);
  const valid = rosters.filter((r) => rosterEligible(r, picks));
  const fresh = valid.filter((r) => !seen.includes(r.id));
  const pool = fresh.length >= 6 ? fresh : valid;
  let best: Roster[] = [];
  let bestScore = -1;
  for (let i = 0; i < 250; i++) {
    const pickSet: Roster[] = [];
    for (const r of shuffle(pool)) {
      if (pickSet.length === 3) break;
      if (pickSet.some((x) => x.org === r.org)) continue; // no same org twice in one spin
      pickSet.push(r);
    }
    if (pickSet.length < 3) continue;
    const covered = new Set(pickSet.flatMap((r) => r.players.flatMap((p) => eligibleSlots(p, picks))));
    const score = open.filter((s) => covered.has(s)).length;
    if (score > bestScore) { best = pickSet; bestScore = score; }
    if (score === open.length) break;
  }
  return best.map((r) => r.id);
}

/** Coach round: three rosters whose coaches are all different, avoiding rosters already seen when possible. */
export function makeCoachOffer(seen: string[], rosters: Roster[] = ROSTERS): string[] {
  const coached = rosters.filter((r) => r.coach);
  const fresh = coached.filter((r) => !seen.includes(r.id));
  const pool = shuffle(fresh.length >= 6 ? fresh : coached);
  const out: Roster[] = [];
  for (const r of pool) if (out.length < 3 && !out.some((x) => x.coach === r.coach)) out.push(r);
  return out.map((r) => r.id);
}

/** Bench round: three teams from three orgs, each with someone you haven't drafted. */
export function makeBenchOffer(picks: Pick[], seen: string[], rosters: Roster[] = ROSTERS): string[] {
  const taken = draftedIds(picks);
  const valid = rosters.filter((r) => r.players.some((p) => !taken.has(p.id)));
  const fresh = valid.filter((r) => !seen.includes(r.id));
  const pool = shuffle(fresh.length >= 6 ? fresh : valid);
  const out: Roster[] = [];
  for (const r of pool) if (out.length < 3 && !out.some((x) => x.org === r.org)) out.push(r);
  return out.map((r) => r.id);
}
