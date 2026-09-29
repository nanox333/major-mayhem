// Run state: the draft, the tournament, and the reducer that moves between them.
// Every random step runs under a seed derived from the run seed, so the daily challenge deals
// everyone the same cases and a reloaded run can't be rerolled by refreshing the page.
import { COACHES, Player, ROLE_ORDER, Role, activeRosters, rostersOn } from '../data/rosters';
import * as G from './logic';

export type Phase = 'draft' | 'ready' | 'preview' | 'live' | 'final';
export type Mode = 'free' | 'daily';
export interface Pending {
  stage: G.StageKey;
  oppId: string;
  /** Match-day form for your starters and bench player, rolled when the match is found. */
  form?: Record<string, number>;
  /** The starter your bench player replaces for this match. */
  subOut?: string | null;
}
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
  /** Drafts started since the coach and bench rounds exist have seven rounds; older saves have five. */
  extras?: boolean;
  /** The coach you picked (undefined until the coach round) and the roster they coached. */
  coach?: string | null;
  coachFrom?: string;
  /** Your bench player, who can sub in before any match. */
  bench?: G.Pick | null;
}

export type Round = 'player' | 'coach' | 'bench';
/** Which kind of draft round is next: five players, then the coach, then the bench. */
export const roundOf = (s: Run): Round => (s.picks.length < 5 ? 'player' : s.extras && s.coach === undefined ? 'coach' : 'bench');
export const draftRounds = (s: Run) => (s.extras ? 7 : 5);
export const roundNumber = (s: Run) => (s.picks.length < 5 ? s.picks.length + 1 : s.coach === undefined ? 6 : 7);

export function benchLineup(s: Run): G.Lineup | null {
  if (!s.bench) return null;
  const roster = G.rosterById.get(s.bench.rosterId)!;
  return { slot: s.bench.slot, roster, player: roster.players.find((p) => p.id === s.bench!.playerId)! };
}
/** The five who play a match (or the pending one): starters, the bench player if subbed in, and match-day form. */
export const lineupFor = (s: Run, subOut?: string | null, form?: Record<string, number>) =>
  G.matchLineup(G.lineupFromPicks(s.picks), benchLineup(s), subOut, form);
/** The five playing the current match. */
export const currentLineup = (s: Run) => lineupFor(s, s.current?.subOut, s.current?.playerForm);
/** Everyone who could have played: the starters plus the bench player (for MVP and results). */
export const squadOf = (s: Run): G.Lineup[] => { const b = benchLineup(s); return b ? [...G.lineupFromPicks(s.picks), b] : G.lineupFromPicks(s.picks); };

const pad = (n: number) => String(n).padStart(2, '0');
export const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Daily #1 is the day the game shipped. */
export const dailyNumber = (date: string) => Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse('2026-09-28T00:00:00Z')) / 86400000) + 1;
export const dailyDate = (s: Run) => (s.mode === 'daily' ? s.seed.replace('daily-', '') : null);

export const fresh = (mode: Mode = 'free', date = today()): Run => ({
  v: 3, mode, seed: mode === 'daily' ? `daily-${date}` : `free-${Math.random().toString(36).slice(2, 10)}`,
  phase: 'draft', step: 'spin', offer: [], offerKey: 0, rerollKey: 0, seen: [], team: null, picks: [], rerolls: 2,
  t: G.newTournament(), pending: null, current: null, recorded: false, extras: true, bench: null,
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
    && (r.coach === undefined || r.coach === null || (typeof r.coach === 'string' && r.coach in COACHES))
    && (!r.bench || (pickOk(r.bench) && !r.picks.some((p: G.Pick) => p.playerId === r.bench.playerId)))
    && (!r.pending?.subOut || r.picks.some((p: G.Pick) => p.playerId === r.pending.subOut))
    && (!r.current?.subOut || r.picks.some((p: G.Pick) => p.playerId === r.current.subOut))
    && (!r.current || roster(r.current.opponentId))
    && Array.isArray(r.t?.matches) && r.t.matches.every((m: G.Match) => roster(m.opponentId));
}
export const save = (r: Run) => { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* storage unavailable: play on */ } };

export type Action =
  | { type: 'spin' } | { type: 'reroll' } | { type: 'team'; id: string } | { type: 'back' }
  | { type: 'draft'; player: Player; slot: Role } | { type: 'play' } | { type: 'start' }
  | { type: 'veto'; map: string } | { type: 'side'; side: G.Side } | { type: 'next' } | { type: 'reset'; mode?: Mode } | { type: 'recorded' }
  | { type: 'coach'; rosterId: string } | { type: 'bench'; player: Player } | { type: 'sub'; out: string | null } | { type: 'call'; call: G.Call };

/** A daily draws only from rosters available on its date, so later data additions don't change it. */
export const rostersFor = (s: Run) => { const date = dailyDate(s); return date ? rostersOn(date) : activeRosters(); };
const offerFor = (s: Run) => G.seeded(`${s.seed}:offer:${s.picks.length}:${s.rerolls}`, () => G.makeOffer(s.picks, s.seen, rostersFor(s)));
const opponentFor = (s: Run, t: G.Tournament, stage: G.StageKey) =>
  G.seeded(`${s.seed}:opp:${t.matches.length}`, () => G.pickOpponent(t, stage, squadOf(s), rostersFor(s)));
/** The offer for whichever round is next. Coach and bench offers are seeded apart from the player rounds. */
const offerForRound = (s: Run) => {
  const round = roundOf(s);
  if (round === 'coach') return G.seeded(`${s.seed}:coach:${s.rerolls}`, () => G.makeCoachOffer(s.seen, rostersFor(s)));
  if (round === 'bench') return G.seeded(`${s.seed}:bench:${s.rerolls}`, () => G.makeBenchOffer(s.picks, s.seen, rostersFor(s)));
  return offerFor(s);
};
/** A found match: the opponent, plus everyone's match-day form (only for drafts with a bench). */
const pendingFor = (s: Run, t: G.Tournament, stage: G.StageKey): Pending => {
  const oppId = opponentFor(s, t, stage);
  if (!s.extras) return { stage, oppId };
  const ids = squadOf(s).map((x) => x.player.id);
  return { stage, oppId, form: G.seeded(`${s.seed}:form:${t.matches.length}`, () => G.rollForm(ids)), subOut: null };
};

export function reducer(s: Run, a: Action): Run {
  switch (a.type) {
    case 'spin': {
      const offer = offerForRound(s);
      return { ...s, step: 'teams', offer, seen: [...s.seen, ...offer], offerKey: s.offerKey + 1, team: null };
    }
    case 'reroll': {
      if (s.rerolls <= 0 || s.step !== 'teams') return s;
      const next = { ...s, rerolls: s.rerolls - 1 };
      const offer = offerForRound(next);
      return { ...next, offer, seen: [...s.seen, ...offer], rerollKey: s.rerollKey + 1 };
    }
    case 'team': return { ...s, step: 'players', team: a.id };
    case 'back': return { ...s, step: 'teams', team: null };
    case 'draft': {
      if (!s.team || !G.eligibleSlots(a.player, s.picks).includes(a.slot)) return s;
      if (roundOf(s) !== 'player') return s;
      const picks = [...s.picks, { slot: a.slot, rosterId: s.team, playerId: a.player.id, offer: s.offer }];
      return { ...s, picks, team: null, offer: [], step: 'spin', phase: picks.length === 5 && !s.extras ? 'ready' : 'draft' };
    }
    case 'coach': {
      const r = G.rosterById.get(a.rosterId);
      if (roundOf(s) !== 'coach' || s.step !== 'teams' || !s.offer.includes(a.rosterId) || !r?.coach) return s;
      return { ...s, coach: r.coach, coachFrom: r.id, team: null, offer: [], step: 'spin' };
    }
    case 'bench': {
      if (roundOf(s) !== 'bench' || !s.extras || !s.team || G.draftedIds(s.picks).has(a.player.id)) return s;
      if (!G.rosterById.get(s.team)?.players.some((p) => p.id === a.player.id)) return s;
      const bench: G.Pick = { slot: a.player.roles[0], rosterId: s.team, playerId: a.player.id, offer: s.offer };
      return { ...s, bench, team: null, offer: [], step: 'spin', phase: 'ready' };
    }
    case 'play': {
      const stage = G.nextStage(s.t)!;
      return { ...s, phase: 'preview', pending: pendingFor(s, s.t, stage) };
    }
    case 'sub': {
      if (s.phase !== 'preview' || !s.pending || !s.bench) return s;
      if (a.out !== null && !s.picks.some((p) => p.playerId === a.out)) return s;
      return { ...s, pending: { ...s.pending, subOut: a.out } };
    }
    case 'start': {
      if (!s.pending) return s;
      const { stage, oppId, form, subOut } = s.pending;
      const m = G.seeded(`${s.seed}:match:${s.t.matches.length}`, () => G.startMatch(stage, lineupFor(s, subOut, form), oppId, G.bestOfFor(stage, s.t)));
      return { ...s, phase: 'live', current: { ...m, ...(form ? { playerForm: form, subOut: subOut ?? null } : {}) } };
    }
    case 'veto': {
      // The veto has no luck in it except the decider's knife round, seeded like the maps.
      const m = s.current;
      if (!m || m.done) return s;
      return { ...s, current: G.seeded(`${s.seed}:match:${s.t.matches.length}:veto`, () => G.applyVeto(m, currentLineup(s), a.map)) };
    }
    case 'side': {
      // Your pick after winning the knife, or the side the opponent left you. The map's luck is seeded by
      // its place in the series, so in a daily the same pick always plays out the same way.
      const m = s.current;
      if (!m?.next || m.done) return s;
      if (!m.next.won && a.side !== G.otherSide(m.next.oppPick)) return s;
      const k = m.maps.length;
      return { ...s, current: G.seeded(`${s.seed}:match:${s.t.matches.length}:map:${k}`, () => G.playNextMap(m, currentLineup(s), a.side, s.coach)) };
    }
    case 'call': {
      // A tactical call replays the map being watched under the same seed: rounds already shown don't change.
      const m = s.current;
      if (!m || !G.canCall(m, a.call)) return s;
      const k = m.maps.length - 1;
      const calls = G.withCall(m.maps[k].calls ?? G.noCalls(), a.call);
      return { ...s, current: G.seeded(`${s.seed}:match:${s.t.matches.length}:map:${k}`, () => G.replayLastMap(m, currentLineup(s), s.coach, calls)) };
    }
    case 'next': {
      if (!s.current?.done) return s;
      const t = G.applyResult(s.t, s.current);
      const stage = G.nextStage(t);
      if (!stage) return { ...s, t, current: null, pending: null, phase: 'final' };
      return { ...s, t, current: null, phase: 'preview', pending: pendingFor(s, t, stage) };
    }
    case 'reset': return fresh(a.mode);
    case 'recorded': return { ...s, recorded: true };
  }
}
