// Starting sides: how the halves run, which maps favour which side, and which roles matter on each.
import { Role } from '../data/rosters';
import { Lineup, pickValue } from './lineup';

export type Side = 'T' | 'CT';
export const otherSide = (s: Side): Side => (s === 'T' ? 'CT' : 'T');

/** Your side in round i (0-based): MR12 halves, then overtime halves of three, starting on the second-half sides. */
export function sideAt(i: number, start: Side): Side {
  if (i < 12) return start;
  if (i < 24) return otherSide(start);
  return Math.floor((i - 24) / 3) % 2 === 0 ? otherSide(start) : start;
}

/** How much each map favours the CT side, in team-power points per round. */
export const CT_BIAS: Record<string, number> = { Nuke: 1.6, Train: 1.2, Ancient: 0.9, Inferno: 0.7, Mirage: 0.4, Dust2: 0, Anubis: -0.6 };
export const sideLean = (map: string) => {
  const b = CT_BIAS[map] ?? 0;
  return b >= 1 ? 'CT-sided' : b >= 0.3 ? 'slightly CT-sided' : b <= -0.3 ? 'T-sided' : 'balanced';
};

/**
 * Roles matter more on one side: entry fraggers and lurkers win T rounds, AWPers and anchors hold CT ones.
 * Returns a small bonus from how strong those two players are.
 */
export function sideEdge(l: Lineup[], side: Side): number {
  const keys: Role[] = side === 'T' ? ['ENTRY', 'LURK'] : ['AWP', 'SUP'];
  const v = l.filter((x) => keys.includes(x.slot)).map((x) => pickValue(x.player, x.slot));
  return v.length ? ((v.reduce((a, b) => a + b, 0) / v.length) - 85) * 0.12 : 0;
}

/** How good a first half on `side` is for `us`: the map's lean plus which roles matter on that side. */
export const sideScore = (map: string, side: Side, us: Lineup[], them: Lineup[]) =>
  (CT_BIAS[map] ?? 0) * (side === 'CT' ? 1 : -1) + sideEdge(us, side) - sideEdge(them, otherSide(side));
export const bestSide = (map: string, us: Lineup[], them: Lineup[]): Side => (sideScore(map, 'CT', us, them) >= sideScore(map, 'T', us, them) ? 'CT' : 'T');
