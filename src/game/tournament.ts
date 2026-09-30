// The Major: the Swiss stage and playoffs, who you meet next, and how a run ends.
import { ROSTERS, Roster } from '../data/rosters';
import { rand } from './random';
import { hasRule } from './rulesState';
import { Lineup, rosterPower } from './lineup';
import { BEST_OF, Match, StageKey } from './match';
import { seriesRatings } from './series';

export interface Tournament {
  matches: Match[];
  /** Swiss record. `need` is the wins to advance and losses to go out: 3 (runs saved before the Swiss stage use 2). */
  qual: { w: number; l: number; need?: number };
  status: 'running' | 'eliminated' | 'champion';
  used: string[];
  /** A draft duel: a single showmatch instead of a Major. */
  duel?: boolean;
}

export const newTournament = (): Tournament => ({ matches: [], qual: { w: 0, l: 0, need: 3 }, status: 'running', used: [] });
export const qualNeed = (t: Tournament) => t.qual.need ?? 2;

/** What stage the next match belongs to, or null if the run is over. */
export function nextStage(t: Tournament): StageKey | null {
  if (t.status !== 'running') return null;
  if (t.duel) return t.matches.length ? null : 'DUEL';
  if (t.qual.w < qualNeed(t)) return 'QUAL';
  const playoff = t.matches.filter((m) => m.stage !== 'QUAL').length;
  return (['QF', 'SF', 'F'] as StageKey[])[playoff] ?? null;
}

/** Like a real Major's Swiss stage: matches that can send you through or out are Bo3, the rest Bo1. */
export function bestOfFor(stage: StageKey, t: Tournament): 1 | 3 {
  if (stage !== 'QUAL') return BEST_OF[stage];
  const need = qualNeed(t);
  return need === 3 && (t.qual.w === need - 1 || t.qual.l === need - 1) ? 3 : 1;
}

/** Opponents get tougher as the bracket goes on. Excludes rosters you drafted from. */
export function pickOpponent(t: Tournament, stage: StageKey, mine: Lineup[], rosters: Roster[] = ROSTERS): string {
  // Skip rosters that include anyone on your team, so nobody faces themselves.
  const mineIds = new Set(mine.map((x) => x.player.id));
  const clean = rosters.filter((r) => !r.players.some((p) => mineIds.has(p.id)) && !t.used.includes(r.id));
  // Smaller pools (era modes) can run short over a long run: fall back to rosters you drafted from, then to repeats.
  const notUsed = rosters.filter((r) => !t.used.includes(r.id));
  // From rules v3 a clean opponent is used for as long as one is left: a smaller clean pool is better than facing someone on your own team (#167).
  // Earlier versions fall back once fewer than eight remain, and keep doing so, so old dailies and challenges replay as they did.
  const pool = (hasRule('cleanOpponentPool') ? clean.length > 0 : clean.length >= 8) ? clean
    : [notUsed.filter((r) => !mine.some((x) => x.roster.id === r.id)), notUsed, rosters].find((x) => x.length)!;
  const ranked = pool
    .map((r) => ({ r, p: rosterPower(r).total }))
    .sort((x, y) => y.p - x.p);
  const n = ranked.length;
  const range: Record<StageKey, [number, number]> = { QUAL: [0.35, 1], QF: [0.15, 0.6], SF: [0.05, 0.35], F: [0, 0.18], DUEL: [0, 1] };
  // Swiss pairs teams on the same record: winners meet stronger teams, strugglers weaker ones.
  const swiss: Record<number, [number, number]> = { [-2]: [0.35, 1], [-1]: [0.25, 0.9], 0: [0.1, 0.75], 1: [0.05, 0.5], 2: [0, 0.35] };
  const [lo, hi] = stage === 'QUAL' && qualNeed(t) === 3 ? swiss[Math.max(-2, Math.min(2, t.qual.w - t.qual.l))] : range[stage];
  const slice = ranked.slice(Math.floor(lo * n), Math.max(Math.floor(lo * n) + 1, Math.ceil(hi * n)));
  return slice[rand(slice.length)].r.id;
}

export function applyResult(t: Tournament, m: Match): Tournament {
  const next: Tournament = { ...t, matches: [...t.matches, m], used: [...t.used, m.opponentId], qual: { ...t.qual } };
  if (m.stage === 'DUEL') next.status = m.won ? 'champion' : 'eliminated';
  else if (m.stage === 'QUAL') {
    m.won ? next.qual.w++ : next.qual.l++;
    if (next.qual.l >= qualNeed(next)) next.status = 'eliminated';
  } else if (!m.won) next.status = 'eliminated';
  else if (m.stage === 'F') next.status = 'champion';
  return next;
}

export function placement(t: Tournament): { key: string; label: string; reached: number } {
  // reached: 0 qual, 1 QF, 2 SF, 3 F, 4 champion
  if (t.duel) return t.status === 'champion' ? { key: 'DUEL-W', label: 'Won the showmatch', reached: 4 } : { key: 'DUEL-L', label: 'Lost the showmatch', reached: 0 };
  if (t.status === 'champion') return { key: 'CHAMP', label: 'Major Champions', reached: 4 };
  const last = t.matches[t.matches.length - 1];
  if (!last || last.stage === 'QUAL') return { key: 'QUAL', label: t.qual.need ? `Swiss Stage (${t.qual.w}–${t.qual.l})` : 'Qualification Stage', reached: 0 };
  if (last.stage === 'QF') return { key: 'QF', label: 'Quarterfinals', reached: 1 };
  if (last.stage === 'SF') return { key: 'SF', label: 'Semifinals', reached: 2 };
  return { key: 'F', label: 'Runner-up', reached: 3 };
}

export function mvp(t: Tournament, mine: Lineup[]): Lineup {
  // MVP = best average match rating over the whole event, with highlight impact as a tiebreaker
  const r = seriesRatings(t.matches.flatMap((m) => m.maps), 'mine');
  const tot: Record<string, number> = {};
  for (const m of t.matches) for (const [k, v] of Object.entries(m.impact)) tot[k] = (tot[k] ?? 0) + v;
  const score = (id: string) => (r[id]?.rating ?? 0) * 100 + (tot[id] ?? 0) * 0.05;
  return [...mine].sort((a, b) => score(b.player.id) - score(a.player.id))[0];
}
