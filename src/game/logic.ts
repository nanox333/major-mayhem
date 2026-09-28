import { ROSTERS, ROLE_ORDER, Role, Roster, Player } from '../data/rosters';

export const rosterById = new Map(ROSTERS.map((r) => [r.id, r]));

/** `offer` is the case the pick came from, kept for the end-of-run draft review. */
export interface Pick { slot: Role; rosterId: string; playerId: string; offer?: string[] }

// ---------- randomness ----------
// All game randomness goes through `random()`. `seeded()` swaps in a deterministic generator,
// so the daily challenge gives everyone the same cases and a saved run replays identically.

/** mulberry32: small, fast, good enough for a game. */
export const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
/** FNV-1a string hash. */
export const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

let rng: () => number = Math.random;
export const random = () => rng();
export function seeded<T>(seed: string, fn: () => T): T {
  const prev = rng;
  rng = mulberry32(hash(seed));
  try { return fn(); } finally { rng = prev; }
}

export const rand = (n: number) => Math.floor(random() * n);
export const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = rand(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };

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
export function makeOffer(picks: Pick[], seen: string[]): string[] {
  const open = openSlots(picks);
  const valid = ROSTERS.filter((r) => rosterEligible(r, picks));
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

// ---------- strength ----------

export const fit = (p: Player, slot: Role) => (p.roles[0] === slot ? 1 : p.roles.includes(slot) ? 0.965 : 0.86);

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

export interface Power { skill: number; balance: number; chemistry: number; total: number }

export function teamPower(l: Lineup[]): Power {
  const skill = l.reduce((s, x) => s + x.player.rating * fit(x.player, x.slot), 0) / l.length;
  const mains = l.filter((x) => x.player.roles[0] === x.slot).length;
  const balance = mains * 0.4 + (l.every((x) => x.player.roles.includes(x.slot)) ? 0.5 : 0);
  let chem = 0;
  for (let i = 0; i < l.length; i++)
    for (let j = i + 1; j < l.length; j++) {
      if (l[i].roster.id === l[j].roster.id) chem += 0.5;
      else if (l[i].roster.org === l[j].roster.org) chem += 0.3;
      else if (Math.abs(l[i].roster.year - l[j].roster.year) <= 1) chem += 0.08;
    }
  const chemistry = Math.min(2, chem);
  return { skill, balance, chemistry, total: skill + balance + chemistry };
}

// ---------- tournament ----------

export type StageKey = 'QUAL' | 'QF' | 'SF' | 'F';
export const STAGE_NAME: Record<StageKey, string> = { QUAL: 'Qualification Stage', QF: 'Quarterfinal', SF: 'Semifinal', F: 'Grand Final' };
export const MAPS = ['Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis', 'Dust2', 'Train'];
/** Qualification matches are Bo1; every playoff match is a Bo3. */
export const BEST_OF: Record<StageKey, 1 | 3> = { QUAL: 1, QF: 3, SF: 3, F: 3 };

export interface MatchEvent { round: number; text: string; playerId?: string; mine: boolean; good: boolean; kind?: 'half' | 'ot' | 'pistol' | 'clutch' }
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
}
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
}

// ---------- map veto ----------

export type Team = 'us' | 'them';
export interface VetoStep { team: Team; action: 'ban' | 'pick'; map: string }
export interface Veto { order: { team: Team; action: 'ban' | 'pick' }[]; steps: VetoStep[]; left: string[] }

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

// ---------- sides ----------

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

function winTarget(a: number, b: number) {
  // MR12, overtime MR3 (first to 16, 19, ...)
  if (a < 12 || b < 12) return 13;
  const ot = Math.floor((Math.min(a, b) - 12) / 3);
  return 16 + ot * 3;
}

// {p} player, {t} opposing org, {s} a callout on the current map.
const EVENT_TEXT: Record<Role, string[]> = {
  IGL: [
    '{p} reads the rotate and calls a perfect mid-round', '{p} calls a fake that pulls three off {s}', '{p} wins the round with a gutsy anti-eco call',
    '{p} spots the stack on {s} and calls the team the other way', '{p} calls a late execute through {s} with seconds to spare', '{p} keeps the team calm on a 4v5 and wins it',
  ],
  AWP: [
    '{p} opens it up with an AWP pick on {s}', '{p} flicks a no-scope to save the round', '{p} holds {s} and takes two with the AWP',
    '{p} lands a collateral on {s}', '{p} one-taps the rotator with a quick-scope', '{p} picks the aggressive peek on {s} and the round is over',
  ],
  ENTRY: [
    '{p} dry-peeks {s} and gets the opening frag', '{p} storms the site for a 4K', '{p} trades perfectly on the entry',
    '{p} swings through {s} and takes the first two', '{p} jiggles {s}, baits the AWP, and the team trades', '{p} deagles two on the force buy',
  ],
  LURK: [
    '{p} catches the rotation from behind', '{p} backstabs three on the flank', '{p} wins a 1v2 from {s}',
    '{p} waits out the timing on {s} and takes two', '{p} cuts off the retake alone', '{p} steals the pick on {s} while everyone looks the other way',
  ],
  SUP: [
    '{p} pops a flash that blinds the whole site', '{p} holds {s} alone and wins a 1v3', '{p} molly-stalls the push until help arrives',
    '{p} smokes off {s} and the execute walks in', '{p} drops the AWP for the star and survives to trade', '{p} defuses with 0.3 on the clock',
  ],
};
const OPP_TEXT = [
  '{p} wins a clutch for {t}', '{p} hits a triple kill on the retake', '{t} steamrolls {s} with {p} leading', '{p} lands a lucky wallbang',
  '{p} holds {s} and shuts the push down', '{t} win the force buy through {s}', '{p} ninja-defuses behind the smoke', '{p} gets a 1v3 on {s}',
];
/** A few recognizable callouts per map so the killfeed isn't all Dust 2. */
export const CALLOUTS: Record<string, string[]> = {
  Mirage: ['Palace', 'A ramp', 'Connector', 'Jungle', 'Window', 'B apartments', 'Short', 'Underpass'],
  Inferno: ['Banana', 'Apartments', 'Pit', 'Mid', 'Arch', 'Library', 'Car', 'Second mid'],
  Nuke: ['Outside', 'Ramp', 'Heaven', 'Secret', 'Hut', 'Lobby', 'Vents', 'Silo'],
  Ancient: ['Donut', 'Cave', 'Main', 'Temple', 'B ramp', 'Elbow', 'Red room'],
  Anubis: ['Canal', 'Bridge', 'Connector', 'Palace', 'Water', 'Ruins', 'Street'],
  Dust2: ['Long A', 'Catwalk', 'Mid doors', 'Upper tunnels', 'B window', 'Pit', 'Xbox', 'Goose'],
  Train: ['Ivy', 'Connector', 'Popdog', 'Upper B', 'Lower hall', 'Heaven', 'Z-connector'],
};
const fill = (tpl: string, p: string, t: string, map: string) => {
  const spots = CALLOUTS[map] ?? ['mid'];
  return tpl.replace('{p}', p).replace('{t}', t).replace('{s}', spots[rand(spots.length)]);
};

/** Hand out n kills (or deaths) to five players, weighted by skill and luck. */
function spread(n: number, weights: number[], out: number[], forced?: number) {
  for (let i = 0; i < n; i++) {
    if (forced !== undefined && i < 1) { out[forced]++; continue; }
    let r = random() * weights.reduce((a, b) => a + b, 0);
    let k = 0;
    while (r > weights[k] && k < 4) { r -= weights[k]; k++; }
    out[k]++;
  }
}

/** A made-up but consistent match rating: ~1.00 is average, 1.30+ is a big game. */
const matchRating = (k: number, d: number, r: number) => Math.max(0.2, Math.min(2.6, 0.26 + (k / r) * 0.95 + ((r - d) / r) * 0.5));

function playMap(map: string, start: Side, mine: Lineup[], oppL: Lineup[], oppOrg: string, A: number, B: number, form: number, impact: Record<string, number>): MapGame {
  const rounds: boolean[] = [];
  const events: MatchEvent[] = [];
  const mapForm = form + (random() - 0.5) * 3; // some maps just go better than others
  const K = [0, 0, 0, 0, 0], D = [0, 0, 0, 0, 0], OK = [0, 0, 0, 0, 0], OD = [0, 0, 0, 0, 0];
  // Each map, each player has a good or bad day on top of their hidden game rating.
  const dayM = mine.map(() => 0.7 + random() * 0.6), dayO = oppL.map(() => 0.7 + random() * 0.6);
  const killW = (l: Lineup[], day: number[]) => l.map((x, i) => (x.player.rating / 85) ** 3 * day[i]);
  const deathW = (l: Lineup[], day: number[]) => l.map((x, i) => (85 / x.player.rating) ** 1.5 / day[i] * (x.slot === 'ENTRY' ? 1.25 : x.slot === 'AWP' || x.slot === 'LURK' ? 0.85 : 1));
  const kwM = killW(mine, dayM), kwO = killW(oppL, dayO), dwM = deathW(mine, dayM), dwO = deathW(oppL, dayO);
  let a = 0, b = 0, halfLead = 0, econ = 0, ecoLeft = 0;
  const fam = (comfort(mine, map) - comfort(oppL, map)) * COMFORT;
  while (a < winTarget(a, b) && b < winTarget(a, b)) {
    const side = sideAt(rounds.length, start);
    const bias = (CT_BIAS[map] ?? 0) * (side === 'CT' ? 1 : -1);
    const edge = sideEdge(mine, side) - sideEdge(oppL, otherSide(side));
    // Momentum: whoever leads at halftime carries confidence into the second half. This is what makes the
    // starting side matter: open on your stronger side and you're likelier to take that lead.
    const momentum = rounds.length >= 12 ? Math.max(-MOMENTUM_CAP, Math.min(MOMENTUM_CAP, halfLead * MOMENTUM)) : 0;
    // Economy: the two rounds after a pistol favour the pistol winner while the losers save.
    const eco = ecoLeft === 2 ? econ * 2.5 : ecoLeft === 1 ? econ * 1.2 : 0;
    const swing = (random() - 0.5) * 4; // luck per round
    const p = 1 / (1 + Math.exp(-(A - B + mapForm + fam + bias + edge + momentum + eco + swing) / 5.5));
    const won = random() < p;
    rounds.push(won);
    won ? a++ : b++;
    const rn = rounds.length;
    if (ecoLeft > 0) ecoLeft--;
    let star: number | undefined;
    if (won && random() < 0.05) {
      star = rand(5);
      const x = mine[star];
      impact[x.player.id] += 5;
      events.push({ round: rn, text: `${x.player.nick} clutches a 1v${2 + rand(3)}!`, playerId: x.player.id, mine: true, good: true, kind: 'clutch' });
    } else if (random() < 0.22) {
      if (won) {
        star = rand(5);
        const x = mine[star];
        impact[x.player.id] += 2.5;
        events.push({ round: rn, text: fill(EVENT_TEXT[x.slot][rand(EVENT_TEXT[x.slot].length)], x.player.nick, oppOrg, map), playerId: x.player.id, mine: true, good: true });
      } else {
        const y = oppL[rand(5)];
        events.push({ round: rn, text: fill(OPP_TEXT[rand(OPP_TEXT.length)], y.player.nick, oppOrg, map), playerId: mine[rand(5)].player.id, mine: false, good: false });
      }
    }
    // kills this round: winners usually wipe the other side, losers take a few with them
    const ourKills = won ? 3 + rand(3) : rand(5);
    const theirKills = won ? rand(5) : 3 + rand(3);
    spread(Math.min(5, ourKills), kwM, K, star);
    spread(Math.min(5, ourKills), dwO, OD);
    spread(Math.min(5, theirKills), kwO, OK);
    spread(Math.min(5, theirKills), dwM, D);
    if (rn === 1 || rn === 13) {
      econ = won ? 1 : -1; ecoLeft = 2;
      events.push({ round: rn, text: won ? `Pistol round to you. ${oppOrg} are on an eco.` : `${oppOrg} take the pistol round. You're saving.`, mine: true, good: won, kind: 'pistol' });
    }
    if (rn === 12) halfLead = a - b;
    if (rn === 12) events.push({ round: rn, text: `Halftime ${a}–${b}. You switch to ${otherSide(start)}.`, mine: true, good: a >= b, kind: 'half' });
    if (a === 12 && b === 12) events.push({ round: rn, text: 'Overtime! First to 16, sides swap every three rounds.', mine: true, good: true, kind: 'ot' });
    else if (rn > 24 && (rn - 24) % 3 === 0 && a < winTarget(a, b) && b < winTarget(a, b)) events.push({ round: rn, text: `Overtime ${a}–${b}. You switch to ${sideAt(rn, start)}.`, mine: true, good: a >= b, kind: 'half' });
  }
  const r = rounds.length;
  mine.forEach((x, i) => (impact[x.player.id] += K[i] * 0.6 - D[i] * 0.2));
  const stat = (l: Lineup[], k: number[], d: number[]) => l.map((x, i) => ({ id: x.player.id, nick: x.player.nick, k: k[i], d: d[i], rating: Math.round(matchRating(k[i], d[i], r) * 100) / 100 }));
  return { map, start, rounds, events, score: [a, b], won: a > b, stats: { mine: stat(mine, K, D), opp: stat(oppL, OK, OD) } };
}

/** Average match rating per player across a set of maps (weighted by rounds). */
export function seriesRatings(maps: MapGame[]): Record<string, { k: number; d: number; rating: number }> {
  const acc: Record<string, { k: number; d: number; rr: number; r: number }> = {};
  for (const g of maps) for (const st of [...g.stats.mine, ...g.stats.opp]) {
    const e = (acc[st.id] ??= { k: 0, d: 0, rr: 0, r: 0 });
    e.k += st.k; e.d += st.d; e.rr += st.rating * g.rounds.length; e.r += g.rounds.length;
  }
  return Object.fromEntries(Object.entries(acc).map(([id, e]) => [id, { k: e.k, d: e.d, rating: Math.round((e.rr / e.r) * 100) / 100 }]));
}

const MOMENTUM = 0.7, MOMENTUM_CAP = 3, COMFORT = 1;

/** How good a first half on `side` is for `us`: the map's lean plus which roles matter on that side. */
export const sideScore = (map: string, side: Side, us: Lineup[], them: Lineup[]) =>
  (CT_BIAS[map] ?? 0) * (side === 'CT' ? 1 : -1) + sideEdge(us, side) - sideEdge(them, otherSide(side));
const bestSide = (map: string, us: Lineup[], them: Lineup[]): Side => (sideScore(map, 'CT', us, them) >= sideScore(map, 'T', us, them) ? 'CT' : 'T');

/** Side choice before map `i`: the non-picker chooses on a picked map, a knife round decides the decider and Bo1s. */
function setupMap(bestOf: 1 | 3, pool: string[], i: number, mine: Lineup[], oppL: Lineup[]): Knife {
  const map = pool[i];
  const how: Knife['how'] = bestOf === 3 && i === 0 ? 'our-pick' : bestOf === 3 && i === 1 ? 'their-pick' : 'knife';
  const won = how === 'their-pick' ? true : how === 'our-pick' ? false : random() < 0.5;
  return { map, how, won, best: bestSide(map, mine, oppL), oppPick: bestSide(map, oppL, mine) };
}

/** Sets up a series: match-day form and an empty map veto. No maps are played yet. */
export function startMatch(stage: StageKey, mine: Lineup[], oppId: string): Match {
  const form = (random() - 0.5) * 5; // match-day form
  const impact: Record<string, number> = Object.fromEntries(mine.map((x) => [x.player.id, 0]));
  const bestOf = BEST_OF[stage];
  const veto: Veto = { order: VETO_ORDER[bestOf], steps: [], left: [...MAPS] };
  return { stage, opponentId: oppId, bestOf, maps: [], impact, form, veto, pool: [], next: null, done: false, won: false, score: [0, 0] };
}

/** Your veto step, followed by the opponent's replies. When the veto ends, the map order and first side choice are set. */
export function applyVeto(m: Match, mine: Lineup[], map: string): Match {
  const t = vetoTurn(m.veto);
  if (!t || t.team !== 'us' || !m.veto.left.includes(map)) return m;
  const oppL = naturalLineup(rosterById.get(m.opponentId)!);
  let v = m.veto;
  const step = (team: Team, pickMap: string) => {
    const tt = vetoTurn(v)!;
    v = { ...v, steps: [...v.steps, { team, action: tt.action, map: pickMap }], left: v.left.filter((x) => x !== pickMap) };
  };
  step('us', map);
  while (vetoTurn(v)?.team === 'them') step('them', vetoChoice(v, 'them', mine, oppL));
  if (vetoTurn(v)) return { ...m, veto: v };
  const picks = v.steps.filter((x) => x.action === 'pick').map((x) => x.map);
  const pool = [...picks, v.left[0]];
  return { ...m, veto: v, pool, next: setupMap(m.bestOf, pool, 0, mine, oppL) };
}

/** Plays the next map with your team starting on `start`, then sets up the following knife round if the series goes on. */
export function playNextMap(m: Match, mine: Lineup[], start: Side): Match {
  if (m.done || !m.next) return m;
  const opp = rosterById.get(m.opponentId)!;
  const oppL = naturalLineup(opp);
  const A = teamPower(mine).total;
  const B = teamPower(oppL).total - OPP_HANDICAP + STAGE_BOOST[m.stage];
  const impact = { ...m.impact };
  const g = playMap(m.next.map, start, mine, oppL, opp.org, A, B, m.form, impact);
  const maps = [...m.maps, g];
  const w = maps.filter((x) => x.won).length, l = maps.length - w;
  const need = Math.ceil(m.bestOf / 2);
  const done = w >= need || l >= need;
  const score: [number, number] = m.bestOf === 1 ? maps[0].score : [w, l];
  return { ...m, maps, impact, done, won: done && w > l, score, next: done ? null : setupMap(m.bestOf, m.pool, maps.length, mine, oppL) };
}

/** The side you end up on with the sensible pick: your better side if you won the knife, else what's left. */
export const autoSide = (k: Knife): Side => (k.won ? k.best : otherSide(k.oppPick));

/** One-line reasons for the knife-round screen. */
export function sideAdvice(k: Knife, mine: Lineup[]): string {
  const lean = sideLean(k.map);
  const tEdge = sideEdge(mine, 'T'), ctEdge = sideEdge(mine, 'CT');
  const roles = Math.abs(ctEdge - tEdge) < 0.4 ? '' : ctEdge > tEdge
    ? ' Your AWPer and anchor make CT your stronger side.'
    : ' Your entry and lurker make T your stronger side.';
  return `${k.map} is ${lean}.${roles}`;
}

/** Plays a whole series with the veto and sides picked automatically (for simulations and tests). */
export function playMatch(stage: StageKey, mine: Lineup[], oppId: string): Match {
  let m = startMatch(stage, mine, oppId);
  const oppL = naturalLineup(rosterById.get(oppId)!);
  while (vetoTurn(m.veto)) m = applyVeto(m, mine, vetoChoice(m.veto, 'us', mine, oppL));
  while (!m.done) m = playNextMap(m, mine, autoSide(m.next!));
  return m;
}

export interface Tournament {
  matches: Match[];
  qual: { w: number; l: number };
  status: 'running' | 'eliminated' | 'champion';
  used: string[];
}

export const newTournament = (): Tournament => ({ matches: [], qual: { w: 0, l: 0 }, status: 'running', used: [] });

/** What stage the next match belongs to, or null if the run is over. */
export function nextStage(t: Tournament): StageKey | null {
  if (t.status !== 'running') return null;
  if (t.qual.w < 2) return 'QUAL';
  const playoff = t.matches.filter((m) => m.stage !== 'QUAL').length;
  return (['QF', 'SF', 'F'] as StageKey[])[playoff] ?? null;
}

/** Opponents get tougher as the bracket goes on. Excludes rosters you drafted from. */
export function pickOpponent(t: Tournament, stage: StageKey, mine: Lineup[]): string {
  // Skip rosters that include anyone on your team, so nobody faces themselves.
  const mineIds = new Set(mine.map((x) => x.player.id));
  const clean = ROSTERS.filter((r) => !r.players.some((p) => mineIds.has(p.id)) && !t.used.includes(r.id));
  const pool = clean.length >= 8 ? clean : ROSTERS.filter((r) => !mine.some((x) => x.roster.id === r.id) && !t.used.includes(r.id));
  const ranked = pool
    .map((r) => ({ r, p: teamPower(naturalLineup(r)).total }))
    .sort((x, y) => y.p - x.p);
  const n = ranked.length;
  const range: Record<StageKey, [number, number]> = { QUAL: [0.35, 1], QF: [0.15, 0.6], SF: [0.05, 0.35], F: [0, 0.18] };
  const [lo, hi] = range[stage];
  const slice = ranked.slice(Math.floor(lo * n), Math.max(Math.floor(lo * n) + 1, Math.ceil(hi * n)));
  return slice[rand(slice.length)].r.id;
}

/** Real rosters are tuned down slightly: your dream team is the star of the show. Tuned with `npm run check`. */
export const OPP_HANDICAP = 2;
export const STAGE_BOOST: Record<StageKey, number> = { QUAL: -0.5, QF: 0, SF: 0.8, F: 1.6 };

export function applyResult(t: Tournament, m: Match): Tournament {
  const next: Tournament = { ...t, matches: [...t.matches, m], used: [...t.used, m.opponentId], qual: { ...t.qual } };
  if (m.stage === 'QUAL') {
    m.won ? next.qual.w++ : next.qual.l++;
    if (next.qual.l >= 2) next.status = 'eliminated';
  } else if (!m.won) next.status = 'eliminated';
  else if (m.stage === 'F') next.status = 'champion';
  return next;
}

export function placement(t: Tournament): { key: string; label: string; reached: number } {
  // reached: 0 qual, 1 QF, 2 SF, 3 F, 4 champion
  if (t.status === 'champion') return { key: 'CHAMP', label: 'Major Champions', reached: 4 };
  const last = t.matches[t.matches.length - 1];
  if (!last || last.stage === 'QUAL') return { key: 'QUAL', label: 'Qualification Stage', reached: 0 };
  if (last.stage === 'QF') return { key: 'QF', label: 'Quarterfinals', reached: 1 };
  if (last.stage === 'SF') return { key: 'SF', label: 'Semifinals', reached: 2 };
  return { key: 'F', label: 'Runner-up', reached: 3 };
}

export function mvp(t: Tournament, mine: Lineup[]): Lineup {
  // MVP = best average match rating over the whole event, with highlight impact as a tiebreaker
  const r = seriesRatings(t.matches.flatMap((m) => m.maps));
  const tot: Record<string, number> = {};
  for (const m of t.matches) for (const [k, v] of Object.entries(m.impact)) tot[k] = (tot[k] ?? 0) + v;
  const score = (id: string) => (r[id]?.rating ?? 0) * 100 + (tot[id] ?? 0) * 0.05;
  return [...mine].sort((a, b) => score(b.player.id) - score(a.player.id))[0];
}

// ---------- draft review ----------

export interface PickReview {
  slot: Role;
  player: Player;
  roster: Roster;
  value: number;
  /** Strongest pick that was on the board that round (from the same case), or null if the case wasn't recorded. */
  best: { player: Player; roster: Roster; slot: Role; value: number } | null;
}

/** Game value of a pick: rating adjusted for role fit. */
export const pickValue = (p: Player, slot: Role) => p.rating * fit(p, slot);

/** Compare each pick with the best one available in its case that round. Picks are in draft order. */
export function draftReview(picks: Pick[]): { rounds: PickReview[]; grade: number | null } {
  const rounds = picks.map((pk, i) => {
    const before = picks.slice(0, i);
    const roster = rosterById.get(pk.rosterId)!;
    const player = roster.players.find((p) => p.id === pk.playerId)!;
    let best: PickReview['best'] = null;
    for (const id of pk.offer ?? []) {
      const r = rosterById.get(id);
      if (!r) continue;
      for (const p of r.players) for (const slot of eligibleSlots(p, before)) {
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
