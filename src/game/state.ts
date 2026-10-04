// Run state: the draft, the tournament, and the reducer that moves between them.
// Every random step runs under a seed derived from the run seed, so the daily challenge deals
// everyone the same cases and a reloaded run can't be rerolled by refreshing the page.
import { LATEST_RULES, Player, ROLE_ORDER, Role, Roster, activeRosters, isCoach, rostersOn, rulesOn } from '../data/rosters';
import * as G from './logic';
import { DUEL_ID, Duel, duelRosters, registerDuel, validDuel } from './duel';
import { isRealDate } from './dates';
import { readKey, safeSet } from './persist';

export type Phase = 'draft' | 'ready' | 'preview' | 'live' | 'final';
export type Mode = 'free' | 'daily' | 'duel';
/** Free-play options. Dailies always use the full pool with labels. */
export interface Opts {
  /** Only rosters from one era: CS:GO (to Paris 2023) or CS2 (from Copenhagen 2024). Opponents too, when there are enough. */
  era?: 'csgo' | 'cs2';
  /** Draft only from champions, or only from teams that didn't reach a final. */
  pool?: 'champions' | 'underdogs';
  /** No role labels, hints or rarity colors: draft on knowledge alone. */
  hard?: boolean;
}
export const optsLabel = (o?: Opts) => [o?.era === 'csgo' ? 'CS:GO era' : o?.era === 'cs2' ? 'CS2 era' : '', o?.pool === 'champions' ? 'Champions only' : o?.pool === 'underdogs' ? 'Underdogs only' : '', o?.hard ? 'Hard mode' : ''].filter(Boolean);
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
  /** Every case this run was shown, round by round, with the spins in order: what a duel link carries so a friend is dealt the same ones (#172). */
  offerLog?: string[][][];
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
  /** Free-play mode options. */
  opts?: Opts;
  /** A draft duel: the challenger's team, which this run drafts against. */
  duel?: Duel;
  /** The rules version this run plays under (#24); runs saved before versions existed are v1. */
  rules?: number;
  /**
   * Who this attempt is, apart from its seed (free-play replays and a daily played again share a seed). Recording a result is keyed by it, so it counts once (#163).
   * Saves from before it existed get one when they are loaded.
   */
  attempt?: string;
}
export const newAttempt = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const rulesOf = (s: Pick<Run, 'rules'>) => s.rules ?? 1;
/** Whether this run is an equal-conditions draft duel: the cases are the challenger's, and the showmatch gives neither team form, subs or calls (#172). */
export const equalDuel = (s: Pick<Run, 'duel'>) => s.duel?.v === 2;

/** The cases a duel's challenger saw in a round, in the order they were shown. */
const recordedCases = (s: Run, round: number) => s.duel?.offers?.[round] ?? [];
/** Whether a spin is possible on this case: a duel has one only where the challenger spun. */
/** Spins this run can still use in a duel: only where the challenger spun, as many as they did, and never more than the run has left. */
export const canReroll = (s: Run) => s.rerolls > 0 && (!equalDuel(s) || !!recordedCases(s, roundNumber(s) - 1)[(s.offerLog?.[roundNumber(s) - 1]?.length ?? 1)]);
export const rerollsLeft = (s: Run) => {
  if (!equalDuel(s)) return s.rerolls;
  const here = roundNumber(s) - 1;
  const used = (s.offerLog?.[here]?.length ?? 1) - 1;
  const spare = (s.duel!.offers ?? []).reduce((n, chain, i) => n + (i < here ? 0 : chain.length - 1 - (i === here ? used : 0)), 0);
  return Math.max(0, Math.min(s.rerolls, spare));
};

/** Slots a player can go into: the roles they cover, or in hard mode any open slot (off-role costs as usual). */
export const slotsFor = (s: Run, p: Player): Role[] =>
  s.opts?.hard || flexRound(s) ? (G.draftedIds(s.picks).has(p.id) ? [] : G.openSlots(s.picks)) : G.eligibleSlots(p, s.picks);

/**
 * In an equal-conditions duel the cases are the challenger's, and none of the three may suit the slots you have left. When none does, any open slot takes
 * any player and the usual off-role cost applies, so the case is never a dead end (#172).
 */
export const flexRound = (s: Run) => equalDuel(s) && s.picks.length < 5 && s.offer.length > 0
  && !s.offer.some((id) => { const r = G.rosterById.get(id); return !!r && G.rosterEligible(r, s.picks); });

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
/**
 * The daily's date: the browser's local calendar day, so it rolls over at local midnight (#26). Friends in other time
 * zones stay on the same challenge through duel links, which carry the date, and rules follow the date too (#24).
 * Every "what day is it" in the game uses this, never UTC.
 */
export const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Daily #1 is the day the game shipped. */
export const dailyNumber = (date: string) => Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse('2026-09-28T00:00:00Z')) / 86400000) + 1;
export const dailyDate = (s: Run) => (s.mode === 'daily' ? s.seed.replace('daily-', '') : null);

export const fresh = (mode: Mode = 'free', date = today(), opts?: Opts): Run => ({
  ...(mode === 'free' && opts && optsLabel(opts).length ? { opts } : {}),
  v: 3, mode, seed: mode === 'daily' ? `daily-${date}` : `free-${Math.random().toString(36).slice(2, 10)}`,
  phase: 'draft', step: 'spin', offer: [], offerKey: 0, rerollKey: 0, seen: [], team: null, picks: [], rerolls: 2,
  t: G.newTournament(), pending: null, current: null, recorded: false, extras: true, bench: null, attempt: newAttempt(), offerLog: [],
  // A daily plays under the rules of its date; everything else starts on the latest.
  rules: mode === 'daily' ? rulesOn(date) : LATEST_RULES,
});

export const KEY = 'major-mayhem-run-v2';

/** A duel run: the challenger's seed and options (so the same cases), then one showmatch against their team. */
export function freshDuel(d: Duel): Run {
  registerDuel(d);
  // The friend drafts under the challenger's rules, so the cases match. Links from before versions existed are v1,
  // or the daily's version when they carry a date.
  const rules = d.rules ?? (d.date ? rulesOn(d.date) : 1);
  return { ...fresh('free', today(), d.opts), mode: 'duel', seed: d.seed, duel: d, t: { ...G.newTournament(), duel: true }, rules, attempt: newAttempt() };
}

/** Parses a saved run and checks it; null when there is none or it is not usable. A v2 save is carried over as a free run. */
export function parseRun(raw: string | null): Run | null {
  try {
    if (!raw) return null;
    const r = JSON.parse(raw);
    // v2 saves predate daily mode: carry them over as free runs.
    if (r?.v === 2) Object.assign(r, { v: 3, mode: 'free', seed: `free-${Math.random().toString(36).slice(2, 10)}`, recorded: r.phase === 'final' });
    // A match saved before map vetoes existed can't be continued: replay it from the match-found screen.
    if (r?.current && typeof r.current === 'object' && !('veto' in r.current)) Object.assign(r, { current: null, phase: r.pending ? 'preview' : r.phase });
    if (!validRun(r)) return null;
    if (!r.attempt) r.attempt = newAttempt();
    return r as Run;
  } catch { return null; }
}

/** The saved run, or a fresh one. `bad` says a save was there but could not be used, so the page can say so instead of quietly starting over. */
export function load(): Run {
  const r = parseRun(readKey(KEY));
  if (!r) return fresh();
  if (r.duel) registerDuel(r.duel);
  G.setRules(rulesOf(r));
  return r;
}
/** Whether there is a saved run that cannot be used. */
export const savedRunIsBroken = () => { const raw = readKey(KEY); return !!raw && !parseRun(raw); };

// ---------- checking a save (#165) ----------
// A save is only used when everything the game will read from it has the right shape, so an edited or damaged one is refused up front and not half-way
// through a match. Saves from older versions stay valid: what they lack is optional, what they have must still be the right kind of thing.
const isObj = (x: unknown): x is Record<string, any> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isInt = (x: unknown, lo: number, hi: number) => typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi;
const isNum = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
const isPair = (x: unknown) => Array.isArray(x) && x.length === 2 && isInt(x[0], 0, 99) && isInt(x[1], 0, 99);
const STAGES = ['QUAL', 'QF', 'SF', 'F', 'DUEL'];
const SIDES = ['T', 'CT'];
const PHASES = ['draft', 'ready', 'preview', 'live', 'final'];

const teamId = (id: unknown) => typeof id === 'string' && (G.rosterById.has(id) || id === DUEL_ID);
const statOk = (x: any) => isObj(x) && typeof x.id === 'string' && typeof x.nick === 'string' && isNum(x.k) && isNum(x.d) && isNum(x.rating);
const mapOk = (g: any) => isObj(g) && typeof g.map === 'string' && SIDES.includes(g.start)
  && Array.isArray(g.rounds) && g.rounds.length <= 60 && g.rounds.every((x: unknown) => typeof x === 'boolean')
  && Array.isArray(g.events) && g.events.every((e: any) => isObj(e) && isInt(e.round, 0, 99) && typeof e.text === 'string')
  && isPair(g.score) && typeof g.won === 'boolean'
  && isObj(g.stats) && Array.isArray(g.stats.mine) && g.stats.mine.every(statOk) && Array.isArray(g.stats.opp) && g.stats.opp.every(statOk)
  && (g.calls === undefined || (isObj(g.calls) && Array.isArray(g.calls.timeouts) && g.calls.timeouts.every((n: unknown) => isInt(n, 0, 99)) && Array.isArray(g.calls.force) && g.calls.force.every((n: unknown) => isInt(n, 0, 99))));
/** A match, finished or in progress. The veto, map order and knife only exist from later versions, so for a finished match they are optional. */
const matchOk = (m: any, live: boolean) => isObj(m) && STAGES.includes(m.stage) && teamId(m.opponentId) && (m.bestOf === 1 || m.bestOf === 3)
  && Array.isArray(m.maps) && m.maps.length <= 3 && m.maps.every(mapOk)
  && typeof m.done === 'boolean' && typeof m.won === 'boolean' && isPair(m.score)
  && (m.impact === undefined || isObj(m.impact)) && (m.form === undefined || isNum(m.form))
  && (!live || (isObj(m.veto) && Array.isArray(m.veto.order) && Array.isArray(m.veto.steps) && Array.isArray(m.veto.left) && Array.isArray(m.pool) && m.pool.every((x: unknown) => typeof x === 'string')))
  && (m.veto === undefined || (isObj(m.veto) && Array.isArray(m.veto.order) && Array.isArray(m.veto.steps) && Array.isArray(m.veto.left)))
  && (m.next === undefined || m.next === null || (isObj(m.next) && typeof m.next.map === 'string' && typeof m.next.won === 'boolean' && SIDES.includes(m.next.best) && SIDES.includes(m.next.oppPick)))
  && (m.playerForm === undefined || (isObj(m.playerForm) && Object.values(m.playerForm).every(isNum)));

/**
 * Checks that a save is something the game can run: the state machine's fields, counters, people (no one twice), the tournament and any match in
 * progress, and that everything it points at still exists in the roster data, so a renamed or removed player or team starts a new run instead of crashing.
 */
export function validRun(r: any): boolean {
  if (!isObj(r) || r.v !== 3) return false;
  const roster = (id: unknown) => typeof id === 'string' && G.rosterById.has(id);
  const pickOk = (p: any) => isObj(p) && roster(p.rosterId) && ROLE_ORDER.includes(p.slot)
    && G.rosterById.get(p.rosterId)!.players.some((x) => x.id === p.playerId)
    && (!p.offer || (Array.isArray(p.offer) && p.offer.every(roster)));
  if (!['free', 'daily', 'duel'].includes(r.mode) || !PHASES.includes(r.phase) || !['spin', 'teams', 'players'].includes(r.step)) return false;
  if (typeof r.seed !== 'string' || r.seed.length > 60) return false;
  if (r.mode === 'daily' && !(r.seed.startsWith('daily-') && isRealDate(r.seed.slice(6)))) return false;
  if (r.mode === 'free' && r.seed.startsWith('daily-')) return false;
  if ((r.mode === 'duel') !== (r.duel !== undefined)) return false;
  if (r.duel !== undefined && (!validDuel(r.duel) || r.duel.seed !== r.seed)) return false;
  if (!isInt(r.offerKey, 0, 10000) || !isInt(r.rerollKey, 0, 10000) || !isInt(r.rerolls, 0, 10)) return false;
  if (typeof r.recorded !== 'boolean' || (r.extras !== undefined && typeof r.extras !== 'boolean')) return false;
  if (r.attempt !== undefined && (typeof r.attempt !== 'string' || r.attempt.length > 60)) return false;
  if (!Array.isArray(r.picks) || r.picks.length > 5 || !r.picks.every(pickOk)) return false;
  if (new Set(r.picks.map((p: G.Pick) => p.slot)).size !== r.picks.length) return false;
  if (new Set(r.picks.map((p: G.Pick) => p.playerId)).size !== r.picks.length) return false;
  if (!Array.isArray(r.offer) || r.offer.length > 3 || !r.offer.every(roster)) return false;
  if (!Array.isArray(r.seen) || r.seen.length > 400 || !r.seen.every(roster)) return false;
  if (r.offerLog !== undefined && !(Array.isArray(r.offerLog) && r.offerLog.length <= 7 && r.offerLog.every((c: unknown) => Array.isArray(c) && c.length >= 1 && c.length <= 3 && c.every((o: unknown) => Array.isArray(o) && o.length <= 3 && o.every(roster))))) return false;
  if (!(r.team === null || roster(r.team)) || (r.step === 'players' && r.team === null)) return false;
  if (!(r.coach === undefined || r.coach === null || isCoach(r.coach)) || !(r.coachFrom === undefined || roster(r.coachFrom))) return false;
  if (r.bench && (!pickOk(r.bench) || r.picks.some((p: G.Pick) => p.playerId === r.bench.playerId))) return false;
  if (r.opts !== undefined && !(isObj(r.opts) && [undefined, 'csgo', 'cs2'].includes(r.opts.era) && [undefined, 'champions', 'underdogs'].includes(r.opts.pool) && [undefined, true, false].includes(r.opts.hard))) return false;
  if (!(r.rules === undefined || isInt(r.rules, 1, LATEST_RULES))) return false;
  // Where the run is must agree with what it holds.
  if (r.picks.length !== 5 && ['ready', 'preview', 'live', 'final'].includes(r.phase)) return false;
  if (r.extras && ['ready', 'preview', 'live', 'final'].includes(r.phase) && (r.coach === undefined || !r.bench)) return false;
  // The pending match and the one in progress.
  const p = r.pending;
  if (p !== null && p !== undefined) {
    if (!isObj(p) || !STAGES.includes(p.stage) || !teamId(p.oppId)) return false;
    if (p.form !== undefined && !(isObj(p.form) && Object.values(p.form).every(isNum))) return false;
    if (p.subOut && !r.picks.some((x: G.Pick) => x.playerId === p.subOut)) return false;
  }
  if (r.current !== null && r.current !== undefined) {
    if (!matchOk(r.current, true)) return false;
    if (r.current.subOut && !r.picks.some((x: G.Pick) => x.playerId === r.current.subOut)) return false;
  }
  if (r.phase === 'preview' && !p) return false;
  if (r.phase === 'live' && !r.current) return false;
  // The tournament.
  const t = r.t;
  if (!isObj(t) || !Array.isArray(t.matches) || t.matches.length > 40 || !t.matches.every((m: unknown) => matchOk(m, false))) return false;
  if (!isObj(t.qual) || !isInt(t.qual.w, 0, 20) || !isInt(t.qual.l, 0, 20) || !(t.qual.need === undefined || isInt(t.qual.need, 1, 10))) return false;
  if (!['running', 'eliminated', 'champion'].includes(t.status) || !Array.isArray(t.used) || !t.used.every((x: unknown) => typeof x === 'string')) return false;
  if (t.duel !== undefined && typeof t.duel !== 'boolean') return false;
  if (r.phase === 'final' && t.status === 'running') return false;
  return true;
}
export const save = (r: Run) => { safeSet(KEY, JSON.stringify(r), 'your run'); };

export type Action =
  | { type: 'spin' } | { type: 'reroll' } | { type: 'team'; id: string } | { type: 'back' }
  | { type: 'draft'; player: Player; slot: Role } | { type: 'play' } | { type: 'start' }
  | { type: 'veto'; map: string } | { type: 'side'; side: G.Side } | { type: 'next' } | { type: 'reset'; mode?: Mode; opts?: Opts } | { type: 'recorded' }
  | { type: 'opts'; opts: Opts } | { type: 'duel'; duel: Duel } | { type: 'adopt'; run: Run }
  | { type: 'coach'; rosterId: string } | { type: 'bench'; player: Player } | { type: 'sub'; out: string | null } | { type: 'call'; call: G.Call };

/** A daily draws only from rosters available on its date, so later data additions don't change it. */
const eraOf = (year: number) => (year >= 2024 ? 'cs2' : 'csgo');
/** The rosters a run can face: a daily's pinned set, or free play's active rosters (one era, if chosen and big enough). */
export const rostersFor = (s: Run) => {
  const date = dailyDate(s);
  if (date) return rostersOn(date);
  const pinned = s.duel ? duelRosters(s.duel) : null;
  if (pinned) return pinned;
  const all = activeRosters();
  const era = s.opts?.era ? all.filter((r) => eraOf(r.year) === s.opts!.era) : all;
  return era.length >= 16 ? era : all;
};
/** The fewest rosters a free-play filter needs for a full draft (five players, coach and bench) to stay inside it. */
export const MIN_POOL = 9;
/** Narrows rosters by the free-play options. */
export const narrowPool = (base: Roster[], o?: Opts) => {
  const era = o?.era ? base.filter((r) => eraOf(r.year) === o.era) : base;
  return o?.pool === 'champions' ? era.filter((r) => r.result === 'Champions')
    : o?.pool === 'underdogs' ? era.filter((r) => r.result !== 'Champions' && r.result !== 'Runner-up') : era;
};
/** How many rosters a free-play filter leaves, and whether that's enough to draft from. */
export const poolCheck = (o?: Opts) => {
  const n = narrowPool(activeRosters(), o).length;
  return { n, ok: n >= MIN_POOL };
};
/**
 * The rosters the draft offers: the run's pool, narrowed further by the free-play options. Too-small filters
 * can't be chosen (#63), so a selected restriction is never silently widened. Old saves from before that check
 * keep the era they asked for rather than breaking.
 */
export const draftPoolFor = (s: Run) => {
  const base = rostersFor(s);
  const pool = narrowPool(base, s.opts);
  return pool.length >= MIN_POOL ? pool : narrowPool(base, { era: s.opts?.era });
};
const offerFor = (s: Run) => G.seeded(`${s.seed}:offer:${s.picks.length}:${s.rerolls}`, () => G.makeOffer(s.picks, s.seen, draftPoolFor(s)));
const opponentFor = (s: Run, t: G.Tournament, stage: G.StageKey) => stage === 'DUEL' ? DUEL_ID :
  G.seeded(`${s.seed}:opp:${t.matches.length}`, () => G.pickOpponent(t, stage, squadOf(s), rostersFor(s)));
/** The run's case log with this round's cases replaced. */
const logCase = (s: Run, chain: string[][]): string[][][] => { const log = [...(s.offerLog ?? [])]; log[roundNumber(s) - 1] = chain; return log; };
/** The offer for whichever round is next. Coach and bench offers are seeded apart from the player rounds. */
const offerForRound = (s: Run) => {
  const round = roundOf(s);
  // A duel deals the challenger's cases, not new ones: what you pick can't change what comes next, so both drafts face the same offers.
  const first = equalDuel(s) ? recordedCases(s, roundNumber(s) - 1)[0] : undefined;
  if (first) return first;
  if (round === 'coach') return G.seeded(`${s.seed}:coach:${s.rerolls}`, () => G.makeCoachOffer(s.seen, draftPoolFor(s)));
  if (round === 'bench') return G.seeded(`${s.seed}:bench:${s.rerolls}`, () => G.makeBenchOffer(s.picks, s.seen, draftPoolFor(s)));
  return offerFor(s);
};
/** A found match: the opponent, plus everyone's match-day form (only for drafts with a bench). */
const pendingFor = (s: Run, t: G.Tournament, stage: G.StageKey): Pending => {
  const oppId = opponentFor(s, t, stage);
  if (!s.extras || equalDuel(s)) return { stage, oppId };
  const ids = squadOf(s).map((x) => x.player.id);
  return { stage, oppId, form: G.seeded(`${s.seed}:form:${t.matches.length}`, () => G.rollForm(ids)), subOut: null };
};

/**
 * Every step runs under the run's own rules version, and the resulting run's version stays active afterwards,
 * so the screens show the same roles the simulation uses.
 */
export function reducer(s: Run, a: Action): Run {
  G.setRules(rulesOf(s));
  const next = reduce(s, a);
  G.setRules(rulesOf(next));
  return next;
}

function reduce(s: Run, a: Action): Run {
  switch (a.type) {
    case 'spin': {
      const offer = offerForRound(s);
      return { ...s, step: 'teams', offer, seen: [...s.seen, ...offer], offerKey: s.offerKey + 1, team: null, offerLog: logCase(s, [offer]) };
    }
    case 'reroll': {
      if (s.rerolls <= 0 || s.step !== 'teams') return s;
      const here = roundNumber(s) - 1, shown = s.offerLog?.[here] ?? [s.offer];
      let next = { ...s, rerolls: s.rerolls - 1 };
      let offer: string[];
      if (equalDuel(s)) {
        // Only the cases the challenger spun to exist, and in the rounds where they spun.
        const spun = recordedCases(s, here)[shown.length];
        if (!spun) return s;
        offer = spun;
      } else offer = offerForRound(next);
      return { ...next, offer, seen: [...s.seen, ...offer], rerollKey: s.rerollKey + 1, offerLog: logCase(s, [...shown, offer]) };
    }
    case 'team': return { ...s, step: 'players', team: a.id };
    case 'back': return { ...s, step: 'teams', team: null };
    case 'draft': {
      if (!s.team || !slotsFor(s, a.player).includes(a.slot)) return s;
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
      const m = G.seeded(`${s.seed}:match:${s.t.matches.length}`, () => {
        const lineup = lineupFor(s, subOut, form);
        const start = G.startMatch(stage, lineup, oppId, G.bestOfFor(stage, s.t));
        return equalDuel(s) ? G.autoVeto(start, lineup) : start;
      });
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
      // Equal-conditions showmatch: both teams take their stronger side, so the choice isn't yours to make.
      const side = m.veto.auto ? G.autoSide(m.next) : a.side;
      if (!m.next.won && side !== G.otherSide(m.next.oppPick)) return s;
      const k = m.maps.length;
      return { ...s, current: G.seeded(`${s.seed}:match:${s.t.matches.length}:map:${k}`, () => G.playNextMap(m, currentLineup(s), side, s.coach)) };
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
    // Play again keeps your free-play options; switching to a daily drops them.
    case 'reset': return fresh(a.mode, today(), a.opts ?? ((a.mode ?? 'free') === 'free' ? s.opts : undefined));
    case 'opts': return s.offerKey === 0 && s.mode === 'free' && poolCheck(a.opts).ok ? fresh('free', today(), a.opts) : s;
    case 'duel': return freshDuel(a.duel);
    case 'recorded': return { ...s, recorded: true };
    // Another tab moved this run on: take its version rather than overwrite it with a stale one (#163).
    case 'adopt': return a.run;
  }
}
