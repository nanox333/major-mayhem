// The shapes of a match: stages, maps, tactical calls and the knife round, plus the stage constants.
import type { Side } from './sides';
import type { Veto } from './veto';

/** DUEL is a draft duel's one-off showmatch against a friend's drafted team. */
export type StageKey = 'QUAL' | 'QF' | 'SF' | 'F' | 'DUEL';
export const STAGE_NAME: Record<StageKey, string> = { QUAL: 'Swiss Stage', QF: 'Quarterfinal', SF: 'Semifinal', F: 'Grand Final', DUEL: 'Showmatch' };
/** Swiss matches are Bo1 unless they decide advancement or elimination (see bestOfFor); every playoff match is a Bo3. */
export const BEST_OF: Record<StageKey, 1 | 3> = { QUAL: 1, QF: 3, SF: 3, F: 3, DUEL: 3 };

/** The kinds of legendary moment (#292): the first two are rolled on a won round, the other two are read off the map's own results. */
export const LEGENDS = ['ace', 'clutch5', 'flawless', 'miracle'] as const;
export type LegendKind = (typeof LEGENDS)[number];
export interface MatchEvent { round: number; text: string; playerId?: string; mine: boolean; good: boolean; kind?: 'half' | 'ot' | 'pistol' | 'clutch' | 'call' | 'legend'; /** Which legendary moment, when `kind` is 'legend'. */ legend?: LegendKind }
export interface PlayerStat { id: string; nick: string; k: number; d: number; rating: number }
export interface MapGame {
  map: string;
  /** The side your team starts on; sides swap at halftime and every three rounds of overtime. */
  start: Side;
  rounds: boolean[];      // true = we won the round
  events: MatchEvent[];
  score: [number, number];
  won: boolean;
  stats: { mine: PlayerStat[]; opp: PlayerStat[] };
  /** How the starting side was decided (kept so the map can be replayed with a new tactical call). */
  knife?: Knife;
  /** Your tactical calls on this map. */
  calls?: Calls;
  /** Highlight impact per player on this map (the series total is Match.impact). */
  impact?: Record<string, number>;
}

/**
 * Tactical calls, each tied to the round (0-based) it takes effect from. One timeout per half (one in overtime):
 * it stops the opponent's run and lifts your next three rounds, more with a better coach. After a lost pistol you
 * can force buy instead of saving: a better next round, but you're broke for the one after if it fails.
 */
export interface Calls { timeouts: number[]; force: number[] }
export const noCalls = (): Calls => ({ timeouts: [], force: [] });
export type Call = { kind: 'timeout' | 'force'; round: number };
export const halfOf = (i: number) => (i < 12 ? 0 : i < 24 ? 1 : 2);
/**
 * Who picks the starting side before a map. On a picked map the other team chooses; on the decider (and in a Bo1)
 * a knife round decides.
 */
export interface Knife {
  map: string;
  how: 'knife' | 'our-pick' | 'their-pick';
  /** True when you choose the starting side. */
  won: boolean;
  /** The better starting side for your team on this map, against this lineup. */
  best: Side;
  /** The side the opponent takes if they win the knife. */
  oppPick: Side;
}
export interface Match {
  stage: StageKey;
  opponentId: string;
  bestOf: 1 | 3;
  maps: MapGame[];
  impact: Record<string, number>;
  /** Match-day form, shared by every map of the series. */
  form: number;
  /** The map veto, played before the first map. */
  veto: Veto;
  /** Map order for the series, set when the veto is done. */
  pool: string[];
  /** Set up for the next map once the veto is done, while the series is still going. */
  next: Knife | null;
  done: boolean;
  won: boolean;
  /** maps won–lost for a Bo3, rounds for a Bo1 */
  score: [number, number];
  /** The starter the bench player replaced for this match, if any. */
  subOut?: string | null;
  /** Match-day form per player id, in rating points. */
  playerForm?: Record<string, number>;
}

/** Real rosters are tuned down slightly: your dream team is the star of the show. Tuned with `npm run check`. */
export const OPP_HANDICAP = 2.5;
export const STAGE_BOOST: Record<StageKey, number> = { QUAL: 1.5, QF: 0, SF: 0.8, F: 1.6, DUEL: 0 };
