// Run state: the draft, the tournament, and the reducer that moves between them.
// Every random step runs under a seed derived from the run seed, so the daily challenge deals
// everyone the same cases and a reloaded run can't be rerolled by refreshing the page.
import { Player, ROLE_ORDER, Role, activeRosters, rostersOn } from '../data/rosters';
import * as G from './logic';

export type Phase = 'draft' | 'ready' | 'preview' | 'live' | 'final';
export type Mode = 'free' | 'daily';
export interface Pending { stage: G.StageKey; oppId: string }
export interface Run {
  v: 3;
  mode: Mode;
  /** Base seed. Daily runs use the date (`daily-2026-09-28`); free runs get a random one. */
  seed: string;
  phase: Phase;
  step: 'spin' | 'teams' | 'players';
  offer: string[];
  offerKey: number;
  rerollKey: number;
  seen: string[];
  team: string | null;
  picks: G.Pick[];
  rerolls: number;
  t: G.Tournament;
  pending: Pending | null;
  current: G.Match | null;
  /** Set once the finished run has been added to lifetime stats. */
  recorded: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Daily #1 is the day the game shipped. */
export const dailyNumber = (date: string) => Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse('2026-09-28T00:00:00Z')) / 86400000) + 1;
export const dailyDate = (s: Run) => (s.mode === 'daily' ? s.seed.replace('daily-', '') : null);

export const fresh = (mode: Mode = 'free', date = today()): Run => ({
  v: 3, mode, seed: mode === 'daily' ? `daily-${date}` : `free-${Math.random().toString(36).slice(2, 10)}`,
  phase: 'draft', step: 'spin', offer: [], offerKey: 0, rerollKey: 0, seen: [], team: null, picks: [], rerolls: 2,
  t: G.newTournament(), pending: null, current: null, recorded: false,
});

export const KEY = 'major-mayhem-run-v2';

export function load(): Run {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const r = JSON.parse(raw);
    // v2 saves predate daily mode: carry them over as free runs.
    if (r.v === 2) Object.assign(r, { v: 3, mode: 'free', seed: `free-${Math.random().toString(36).slice(2, 10)}`, recorded: r.phase === 'final' });
    // A match saved before map vetoes existed can't be continued: replay it from the match-found screen.
    if (r.current && !('veto' in r.current)) Object.assign(r, { current: null, phase: r.pending ? 'preview' : r.phase });
    return validRun(r) ? (r as Run) : fresh();
  } catch { return fresh(); }
}

/**
 * Checks that everything a save points at still exists in the roster data, so a renamed or removed player or team
 * starts a new run instead of crashing the page on every load.
 */
export function validRun(r: any): boolean {
  const roster = (id: unknown) => typeof id === 'string' && G.rosterById.has(id);
  const pickOk = (p: G.Pick) => roster(p.rosterId) && ROLE_ORDER.includes(p.slot)
    && G.rosterById.get(p.rosterId)!.players.some((x) => x.id === p.playerId)
    && (!p.offer || p.offer.every(roster));
  return r?.v === 3
    && Array.isArray(r.picks) && r.picks.length <= 5 && r.picks.every(pickOk)
    && new Set(r.picks.map((p: G.Pick) => p.slot)).size === r.picks.length
    && Array.isArray(r.offer) && r.offer.every(roster)
    && (r.team === null || roster(r.team))
    && (r.picks.length === 5 || !['ready', 'preview', 'live', 'final'].includes(r.phase))
    && (!r.pending || roster(r.pending.oppId))
    && (!r.current || roster(r.current.opponentId))
    && Array.isArray(r.t?.matches) && r.t.matches.every((m: G.Match) => roster(m.opponentId));
}
export const save = (r: Run) => { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* storage unavailable: play on */ } };

export type Action =
  | { type: 'spin' } | { type: 'reroll' } | { type: 'team'; id: string } | { type: 'back' }
  | { type: 'draft'; player: Player; slot: Role } | { type: 'play' } | { type: 'start' }
  | { type: 'veto'; map: string } | { type: 'side'; side: G.Side } | { type: 'next' } | { type: 'reset'; mode?: Mode } | { type: 'recorded' };

/** A daily draws only from rosters available on its date, so later data additions don't change it. */
export const rostersFor = (s: Run) => { const date = dailyDate(s); return date ? rostersOn(date) : activeRosters(); };
const offerFor = (s: Run) => G.seeded(`${s.seed}:offer:${s.picks.length}:${s.rerolls}`, () => G.makeOffer(s.picks, s.seen, rostersFor(s)));
const opponentFor = (s: Run, t: G.Tournament, stage: G.StageKey) =>
  G.seeded(`${s.seed}:opp:${t.matches.length}`, () => G.pickOpponent(t, stage, G.lineupFromPicks(s.picks), rostersFor(s)));

export function reducer(s: Run, a: Action): Run {
  switch (a.type) {
    case 'spin': {
      const offer = offerFor(s);
      return { ...s, step: 'teams', offer, seen: [...s.seen, ...offer], offerKey: s.offerKey + 1, team: null };
    }
    case 'reroll': {
      if (s.rerolls <= 0 || s.step !== 'teams') return s;
      const next = { ...s, rerolls: s.rerolls - 1 };
      const offer = offerFor(next);
      return { ...next, offer, seen: [...s.seen, ...offer], rerollKey: s.rerollKey + 1 };
    }
    case 'team': return { ...s, step: 'players', team: a.id };
    case 'back': return { ...s, step: 'teams', team: null };
    case 'draft': {
      if (!s.team || !G.eligibleSlots(a.player, s.picks).includes(a.slot)) return s;
      const picks = [...s.picks, { slot: a.slot, rosterId: s.team, playerId: a.player.id, offer: s.offer }];
      return { ...s, picks, team: null, offer: [], step: 'spin', phase: picks.length === 5 ? 'ready' : 'draft' };
    }
    case 'play': {
      const stage = G.nextStage(s.t)!;
      return { ...s, phase: 'preview', pending: { stage, oppId: opponentFor(s, s.t, stage) } };
    }
    case 'start': {
      if (!s.pending) return s;
      const { stage, oppId } = s.pending;
      const m = G.seeded(`${s.seed}:match:${s.t.matches.length}`, () => G.startMatch(stage, G.lineupFromPicks(s.picks), oppId, G.bestOfFor(stage, s.t)));
      return { ...s, phase: 'live', current: m };
    }
    case 'veto': {
      // The veto has no luck in it except the decider's knife round, seeded like the maps.
      const m = s.current;
      if (!m || m.done) return s;
      return { ...s, current: G.seeded(`${s.seed}:match:${s.t.matches.length}:veto`, () => G.applyVeto(m, G.lineupFromPicks(s.picks), a.map)) };
    }
    case 'side': {
      // Your pick after winning the knife, or the side the opponent left you. The map's luck is seeded by
      // its place in the series, so in a daily the same pick always plays out the same way.
      const m = s.current;
      if (!m?.next || m.done) return s;
      if (!m.next.won && a.side !== G.otherSide(m.next.oppPick)) return s;
      const k = m.maps.length;
      return { ...s, current: G.seeded(`${s.seed}:match:${s.t.matches.length}:map:${k}`, () => G.playNextMap(m, G.lineupFromPicks(s.picks), a.side)) };
    }
    case 'next': {
      if (!s.current?.done) return s;
      const t = G.applyResult(s.t, s.current);
      const stage = G.nextStage(t);
      if (!stage) return { ...s, t, current: null, pending: null, phase: 'final' };
      return { ...s, t, current: null, phase: 'preview', pending: { stage, oppId: opponentFor(s, t, stage) } };
    }
    case 'reset': return fresh(a.mode);
    case 'recorded': return { ...s, recorded: true };
  }
}
