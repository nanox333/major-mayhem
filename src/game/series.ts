// Playing a series: one map round by round, the veto and side choices around it, tactical calls, and whole matches.
import { COACHES, isCoach } from '../data/rosters';
import { random, rand } from './random';
import { hasRule } from './rulesState';
import { Lineup, naturalLineup, rosterById, rosterPower, teamPower } from './lineup';
import { MAPS, Team, Veto, VETO_ORDER, comfort, vetoChoice, vetoTurn } from './veto';
import { CT_BIAS, Side, bestSide, otherSide, sideAt, sideEdge, sideLean } from './sides';
import { BEST_OF, Call, Calls, Knife, MapGame, Match, MatchEvent, OPP_HANDICAP, STAGE_BOOST, StageKey, halfOf, noCalls } from './match';
import { Buy, EVENT_TEXT, OPP_TEXT, fill, fitting } from './narration';
import { matchRating, tallyRound, tallyRoundV1 } from './tally';

function winTarget(a: number, b: number) {
  // MR12, overtime MR3 (first to 16, 19, ...)
  if (a < 12 || b < 12) return 13;
  const ot = Math.floor((Math.min(a, b) - 12) / 3);
  return 16 + ot * 3;
}

function playMap(map: string, start: Side, mine: Lineup[], oppL: Lineup[], oppOrg: string, A: number, B: number, form: number, calls: Calls, coachRating: number): MapGame {
  const impact: Record<string, number> = Object.fromEntries(mine.map((x) => [x.player.id, 0]));
  const rounds: boolean[] = [];
  const events: MatchEvent[] = [];
  const mapForm = form + (random() - 0.5) * 3; // some maps just go better than others
  const K = [0, 0, 0, 0, 0], D = [0, 0, 0, 0, 0], OK = [0, 0, 0, 0, 0], OD = [0, 0, 0, 0, 0];
  // Each map, each player has a good or bad day on top of their hidden game rating.
  const dayM = mine.map(() => 0.7 + random() * 0.6), dayO = oppL.map(() => 0.7 + random() * 0.6);
  const killW = (l: Lineup[], day: number[]) => l.map((x, i) => (x.player.rating / 85) ** 3 * day[i]);
  const deathW = (l: Lineup[], day: number[]) => l.map((x, i) => (85 / x.player.rating) ** 1.5 / day[i] * (x.slot === 'ENTRY' ? 1.25 : x.slot === 'AWP' || x.slot === 'LURK' ? 0.85 : 1));
  const kwM = killW(mine, dayM), kwO = killW(oppL, dayO), dwM = deathW(mine, dayM), dwO = deathW(oppL, dayO);
  let a = 0, b = 0, halfLead = 0, econ = 0, ecoLeft = 0, forced = false, ourRun = 0, theirRun = 0, toLeft = 0;
  const fam = (comfort(mine, map) - comfort(oppL, map)) * COMFORT;
  const toLift = (hasRule('strongerTimeout') ? TIMEOUT_V4 : TIMEOUT) * (1 + (coachRating - 75) / 40);
  while (a < winTarget(a, b) && b < winTarget(a, b)) {
    const i = rounds.length;
    const side = sideAt(i, start);
    // A timeout stops the other team's run and gives you a lift for the next three rounds.
    if (calls.timeouts.includes(i)) {
      theirRun = 0; toLeft = 3;
      events.push({ round: i, text: `Tactical timeout at ${a}–${b}. The team regroups.`, mine: true, good: true, kind: 'call' });
    }
    if (econ < 0 && ecoLeft === 2 && calls.force.includes(i)) {
      forced = true;
      events.push({ round: i, text: 'You force buy instead of saving.', mine: true, good: true, kind: 'call' });
    }
    const bias = (CT_BIAS[map] ?? 0) * (side === 'CT' ? 1 : -1);
    const edge = sideEdge(mine, side) - sideEdge(oppL, otherSide(side));
    // Momentum: whoever leads at halftime carries confidence into the second half. This is what makes the
    // starting side matter: open on your stronger side and you're likelier to take that lead.
    const momentum = rounds.length >= 12 ? Math.max(-MOMENTUM_CAP, Math.min(MOMENTUM_CAP, halfLead * MOMENTUM)) : 0;
    // Economy: the two rounds after a pistol favour the pistol winner while the losers save. A force buy trades a
    // better first of those rounds for a broke second one if the force fails.
    const eco = forced
      ? (ecoLeft === 2 ? econ * 1 : ecoLeft === 1 && !rounds[i - 1] ? econ * 2.2 : 0)
      : ecoLeft === 2 ? econ * 2.5 : ecoLeft === 1 ? econ * 1.2 : 0;
    // A team on a run of three or more rounds gets a little confidence from it.
    const roll = Math.min(ROLL_CAP, Math.max(0, ourRun - 2) * ROLL) - Math.min(ROLL_CAP, Math.max(0, theirRun - 2) * ROLL);
    const to = toLeft > 0 ? toLift : 0;
    if (toLeft > 0) toLeft--;
    const swing = (random() - 0.5) * 4; // luck per round
    const p = 1 / (1 + Math.exp(-(A - B + mapForm + fam + bias + edge + momentum + eco + roll + to + swing) / 5.5));
    const won = random() < p;
    rounds.push(won);
    won ? a++ : b++;
    if (won) { ourRun++; theirRun = 0; } else { theirRun++; ourRun = 0; }
    const rn = rounds.length;
    // Who is buying what this round, so the narration can't contradict the economy.
    const buy: Buy = { ourForce: forced && ecoLeft === 2, theirEco: econ > 0 && ecoLeft > 0 };
    if (ecoLeft > 0) ecoLeft--;
    if (ecoLeft === 0) forced = false;
    let star: number | undefined, clutch: { who: number; vs: number } | undefined;
    if (won && random() < 0.05) {
      star = rand(5);
      clutch = { who: star, vs: 2 + rand(3) };
      const x = mine[star];
      impact[x.player.id] += 5;
      events.push({ round: rn, text: `${x.player.nick} clutches a 1v${clutch.vs}!`, playerId: x.player.id, mine: true, good: true, kind: 'clutch' });
    } else if (random() < 0.22) {
      if (won) {
        star = rand(5);
        const x = mine[star];
        impact[x.player.id] += 2.5;
        const lines = fitting(EVENT_TEXT[x.slot], buy);
        events.push({ round: rn, text: fill(lines[rand(lines.length)], x.player.nick, oppOrg, map), playerId: x.player.id, mine: true, good: true });
      } else {
        const y = oppL[rand(5)];
        const lines = fitting(OPP_TEXT, buy);
        events.push({ round: rn, text: fill(lines[rand(lines.length)], y.player.nick, oppOrg, map), playerId: mine[rand(5)].player.id, mine: false, good: false });
      }
    }
    const t = hasRule('oneDeathPerRound') ? tallyRound(won, kwM, dwM, kwO, dwO, star, clutch) : tallyRoundV1(won, kwM, dwM, kwO, dwO, star);
    for (let j = 0; j < 5; j++) { K[j] += t.ourKills[j]; D[j] += t.ourDeaths[j]; OK[j] += t.theirKills[j]; OD[j] += t.theirDeaths[j]; }
    if (rn === 1 || rn === 13) {
      econ = won ? 1 : -1; ecoLeft = 2; forced = false;
      // The buy after a lost pistol is the player's call, narrated by the call event, so don't presume it here.
      events.push({ round: rn, text: won ? `Pistol round to you. ${oppOrg} are on an eco.` : `${oppOrg} take the pistol round.`, mine: true, good: won, kind: 'pistol' });
    }
    if (rn === 12) halfLead = a - b;
    if (rn === 12) events.push({ round: rn, text: `Halftime ${a}–${b}. You switch to ${otherSide(start)}.`, mine: true, good: a >= b, kind: 'half' });
    if (a === 12 && b === 12) events.push({ round: rn, text: 'Overtime! First to 16, sides swap every three rounds.', mine: true, good: true, kind: 'ot' });
    else if (rn > 24 && (rn - 24) % 3 === 0 && a < winTarget(a, b) && b < winTarget(a, b)) events.push({ round: rn, text: `Overtime ${a}–${b}. You switch to ${sideAt(rn, start)}.`, mine: true, good: a >= b, kind: 'half' });
  }
  const r = rounds.length;
  mine.forEach((x, i) => (impact[x.player.id] += K[i] * 0.6 - D[i] * 0.2));
  const stat = (l: Lineup[], k: number[], d: number[]) => l.map((x, i) => ({ id: x.player.id, nick: x.player.nick, k: k[i], d: d[i], rating: Math.round(matchRating(k[i], d[i], r) * 100) / 100 }));
  return { map, start, rounds, events, score: [a, b], won: a > b, stats: { mine: stat(mine, K, D), opp: stat(oppL, OK, OD) }, calls, impact };
}

/** Average match rating per player across a set of maps (weighted by rounds). */
export function seriesRatings(maps: MapGame[], side: 'mine' | 'opp' | 'both' = 'both'): Record<string, { k: number; d: number; rating: number }> {
  const acc: Record<string, { k: number; d: number; rr: number; r: number }> = {};
  for (const g of maps) for (const st of side === 'both' ? [...g.stats.mine, ...g.stats.opp] : g.stats[side]) {
    const e = (acc[st.id] ??= { k: 0, d: 0, rr: 0, r: 0 });
    e.k += st.k; e.d += st.d; e.rr += st.rating * g.rounds.length; e.r += g.rounds.length;
  }
  return Object.fromEntries(Object.entries(acc).map(([id, e]) => [id, { k: e.k, d: e.d, rating: Math.round((e.rr / e.r) * 100) / 100 }]));
}

const MOMENTUM = 0.7, MOMENTUM_CAP = 3, COMFORT = 1, ROLL = 0.4, ROLL_CAP = 1.2, TIMEOUT = 1.2, TIMEOUT_V4 = 2.4;

/** Side choice before map `i`: the non-picker chooses on a picked map, a knife round decides the decider and Bo1s. */
function setupMap(bestOf: 1 | 3, pool: string[], i: number, mine: Lineup[], oppL: Lineup[], veto: Veto): Knife {
  const map = pool[i];
  // The first two maps of a Bo3 are picks: whoever picked a map, the other team chooses its side. Usually that is you for the first one, but not after a coin flip.
  const picker = veto.steps.filter((x) => x.action === 'pick')[i]?.team ?? (i === 0 ? 'us' : 'them');
  const how: Knife['how'] = bestOf === 3 && i < 2 ? (picker === 'us' ? 'our-pick' : 'their-pick') : 'knife';
  const won = how === 'their-pick' ? true : how === 'our-pick' ? false : random() < 0.5;
  return { map, how, won, best: bestSide(map, mine, oppL), oppPick: bestSide(map, oppL, mine) };
}

/** Whether a stage is a showmatch played on equal terms: no form, subs or calls, and a veto and sides chosen by the same rule for both teams (#172). */
export const equalShowmatch = (stage: StageKey) => stage === 'DUEL' && hasRule('equalDuel');

/** Sets up a series: match-day form and an empty map veto. No maps are played yet. */
export function startMatch(stage: StageKey, mine: Lineup[], oppId: string, bestOf: 1 | 3 = BEST_OF[stage]): Match {
  const roll = (random() - 0.5) * 5;
  // An equal-conditions showmatch has no match-day form: neither team gets a lift or a dip (#172).
  const form = equalShowmatch(stage) ? 0 : roll; // match-day form
  const impact: Record<string, number> = Object.fromEntries(mine.map((x) => [x.player.id, 0]));
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
  return { ...m, veto: v, pool, next: setupMap(m.bestOf, pool, 0, mine, oppL, v) };
}

/**
 * The whole veto, chosen by one rule for both teams (#172): each bans the map that suits the other most and picks the one that suits itself most. A coin
 * flip, seeded like the rest of the match, says who goes first, so neither side has the first ban.
 */
export function autoVeto(m: Match, mine: Lineup[]): Match {
  const oppL = naturalLineup(rosterById.get(m.opponentId)!);
  const swap = random() < 0.5;
  let v: Veto = { ...m.veto, auto: true, order: swap ? m.veto.order.map((o) => ({ ...o, team: (o.team === 'us' ? 'them' : 'us') as Team })) : m.veto.order };
  for (let t = vetoTurn(v); t; t = vetoTurn(v)) {
    const map = vetoChoice(v, t.team, mine, oppL);
    v = { ...v, steps: [...v.steps, { team: t.team, action: t.action, map }], left: v.left.filter((x) => x !== map) };
  }
  const pool = [...v.steps.filter((x) => x.action === 'pick').map((x) => x.map), v.left[0]];
  return { ...m, veto: v, pool, next: setupMap(m.bestOf, pool, 0, mine, oppL, v) };
}

/** Plays the next map with your team starting on `start`, then sets up the following side choice if the series goes on. */
export function playNextMap(m: Match, mine: Lineup[], start: Side, coach?: string | null, calls: Calls = noCalls()): Match {
  if (m.done || !m.next) return m;
  const opp = rosterById.get(m.opponentId)!;
  const oppL = naturalLineup(opp);
  const A = teamPower(mine, coach).total;
  // A friend's drafted team is a dream team too: no handicap in a showmatch.
  const B = rosterPower(opp).total - (m.stage === 'DUEL' ? 0 : OPP_HANDICAP) + STAGE_BOOST[m.stage];
  const g = { ...playMap(m.next.map, start, mine, oppL, opp.org, A, B, m.form, calls, coach ? (isCoach(coach) ? COACHES[coach].rating : 75) : 70), knife: m.next };
  const impact = { ...m.impact };
  for (const [id, v] of Object.entries(g.impact!)) impact[id] = (impact[id] ?? 0) + v;
  const maps = [...m.maps, g];
  const w = maps.filter((x) => x.won).length, l = maps.length - w;
  const need = Math.ceil(m.bestOf / 2);
  const done = w >= need || l >= need;
  const score: [number, number] = m.bestOf === 1 ? maps[0].score : [w, l];
  return { ...m, maps, impact, done, won: done && w > l, score, next: done ? null : setupMap(m.bestOf, m.pool, maps.length, mine, oppL, m.veto) };
}

/**
 * Replays the last map with a new set of calls. Run under the same seed as the original, the rounds before the first
 * changed call come out exactly the same; only what follows changes.
 */
export function replayLastMap(m: Match, mine: Lineup[], coach: string | null | undefined, calls: Calls): Match {
  const last = m.maps[m.maps.length - 1];
  if (!last?.knife || !last.impact) return m;
  const impact = { ...m.impact };
  for (const [id, v] of Object.entries(last.impact)) impact[id] = (impact[id] ?? 0) - v;
  const before: Match = { ...m, maps: m.maps.slice(0, -1), impact, next: last.knife, done: false, won: false };
  return playNextMap(before, mine, last.start, coach, calls);
}

/**
 * Whether a call is allowed on the last map at `call.round` (the next round to be played): a timeout once per half
 * (once in overtime), a force buy only in the round after a lost pistol.
 */
export function canCall(m: Match, call: Call): boolean {
  if (equalShowmatch(m.stage)) return false; // the other team has no calls, so nobody does
  const g = m.maps[m.maps.length - 1];
  if (!g?.knife || !g.impact || call.round < 1 || call.round >= g.rounds.length) return false;
  const calls = g.calls ?? noCalls();
  if (call.kind === 'timeout') return !calls.timeouts.some((r) => halfOf(r) === halfOf(call.round));
  return (call.round === 1 || call.round === 13) && !g.rounds[call.round - 1] && !calls.force.includes(call.round);
}

export const withCall = (c: Calls, call: Call): Calls =>
  call.kind === 'timeout' ? { ...c, timeouts: [...c.timeouts, call.round] } : { ...c, force: [...c.force, call.round] };

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
export function playMatch(stage: StageKey, mine: Lineup[], oppId: string, bestOf: 1 | 3 = BEST_OF[stage], coach?: string | null): Match {
  let m = startMatch(stage, mine, oppId, bestOf);
  const oppL = naturalLineup(rosterById.get(oppId)!);
  while (vetoTurn(m.veto)) m = applyVeto(m, mine, vetoChoice(m.veto, 'us', mine, oppL));
  while (!m.done) m = playNextMap(m, mine, autoSide(m.next!), coach);
  return m;
}
