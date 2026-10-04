// The map veto and how comfortable each team is on each map.
import { hash } from './random';
import type { Lineup } from './lineup';

export const MAPS = ['Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis', 'Dust2', 'Train'];

export type Team = 'us' | 'them';
export interface VetoStep { team: Team; action: 'ban' | 'pick'; map: string }
export interface Veto {
  order: { team: Team; action: 'ban' | 'pick' }[]; steps: VetoStep[]; left: string[];
  /** Both teams chose by the same rule, with a coin flip for who started (an equal-conditions showmatch, #172): nobody on screen vetoes. */
  auto?: boolean;
}

const turn = (team: Team, action: 'ban' | 'pick') => ({ team, action });
/** Bo1: six alternating bans, the last map is played. Bo3: ban, ban, pick, pick, ban, ban, then the decider. */
export const VETO_ORDER: Record<1 | 3, Veto['order']> = {
  1: [turn('us', 'ban'), turn('them', 'ban'), turn('us', 'ban'), turn('them', 'ban'), turn('us', 'ban'), turn('them', 'ban')],
  3: [turn('us', 'ban'), turn('them', 'ban'), turn('us', 'pick'), turn('them', 'pick'), turn('us', 'ban'), turn('them', 'ban')],
};

/**
 * Invented game values, like the ratings: how comfortable a roster was on each map, from -1.5 to +1.5.
 * A drafted team averages the comfort of each player's original lineup.
 */
export const rosterComfort = (rosterId: string, map: string) => ((hash(`${rosterId}:${map}`) % 1001) / 1000 - 0.5) * 3;
export const comfort = (l: Lineup[], map: string) => l.reduce((s, x) => s + rosterComfort(x.roster.id, map), 0) / l.length;
/** Comfort shown as 1–5 pips. */
export const comfortPips = (c: number) => Math.max(1, Math.min(5, Math.round(((c + 1.5) / 3) * 4) + 1));

export const vetoTurn = (v: Veto) => (v.steps.length < v.order.length ? v.order[v.steps.length] : null);

/** A sensible veto choice for `team`: ban the map that suits the other side most, pick the one that suits you most. */
export function vetoChoice(v: Veto, team: Team, mine: Lineup[], oppL: Lineup[]): string {
  const edge = (map: string) => (comfort(mine, map) - comfort(oppL, map)) * (team === 'us' ? 1 : -1);
  const t = vetoTurn(v)!;
  return [...v.left].sort((a, b) => (t.action === 'pick' ? edge(b) - edge(a) : edge(a) - edge(b)))[0];
}

/** How far apart two comfort values must be before one side has an edge (comfort runs from about -1.5 to 1.5). */
export const EDGE_EVEN = 0.25;
/**
 * Who has the comfort edge on a map, from the underlying values rather than rounded pips (#65). Comfort is one input
 * among many (players, form, sides, luck), so this says who is more comfortable, never who will win.
 */
export function comfortEdge(mine: Lineup[], oppL: Lineup[], map: string): { who: 'us' | 'them' | 'even'; diff: number } {
  const diff = comfort(mine, map) - comfort(oppL, map);
  return { who: Math.abs(diff) < EDGE_EVEN ? 'even' : diff > 0 ? 'us' : 'them', diff };
}
/** The turn after the current one, so the veto can say what happens next. */
export const vetoNextTurn = (v: Veto) => (v.steps.length + 1 < v.order.length ? v.order[v.steps.length + 1] : null);
/** The maps that will be played, in order: picks first (by whoever picked them), then the decider. */
export function vetoMaps(v: Veto): { map: string; by: Team | 'decider' }[] {
  const picks = v.steps.filter((s) => s.action === 'pick').map((s) => ({ map: s.map, by: s.team as Team | 'decider' }));
  return vetoTurn(v) ? picks : [...picks, ...v.left.map((map) => ({ map, by: 'decider' as const }))];
}
