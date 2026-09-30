// Kills and deaths for a round, and the match rating made from them. Rules v1 tallies are kept so v1 dailies replay exactly.
import { random, rand } from './random';

/** Pick one index by weight from `from`. */
function weighted(weights: number[], from: number[]): number {
  let r = random() * from.reduce((s, i) => s + weights[i], 0);
  for (const i of from) { if (r <= weights[i]) return i; r -= weights[i]; }
  return from[from.length - 1];
}

/** Hand out n kills to five players, weighted by skill and luck. One player can get several kills in a round. */
function spread(n: number, weights: number[], out: number[], from = [0, 1, 2, 3, 4]) {
  for (let i = 0; i < n && from.length; i++) out[weighted(weights, from)]++;
}

/** Pick n distinct players to die this round, weighted by risk. A player dies at most once per round. */
function dead(n: number, weights: number[], keep?: number): number[] {
  const left = [0, 1, 2, 3, 4].filter((i) => i !== keep), out: number[] = [];
  while (out.length < n && left.length) { const k = weighted(weights, left); out.push(k); left.splice(left.indexOf(k), 1); }
  return out;
}

/** Rules v1 tallies: kills and deaths handed out independently, with replacement. Kept so v1 dailies replay exactly. */
function spreadV1(n: number, weights: number[], out: number[], forced?: number) {
  for (let i = 0; i < n; i++) {
    if (forced !== undefined && i < 1) { out[forced]++; continue; }
    let r = random() * weights.reduce((a, b) => a + b, 0);
    let k = 0;
    while (r > weights[k] && k < 4) { r -= weights[k]; k++; }
    out[k]++;
  }
}
export function tallyRoundV1(won: boolean, kw: number[], dw: number[], okw: number[], odw: number[], star?: number): RoundTally {
  const t: RoundTally = { ourKills: [0, 0, 0, 0, 0], ourDeaths: [0, 0, 0, 0, 0], theirKills: [0, 0, 0, 0, 0], theirDeaths: [0, 0, 0, 0, 0] };
  const ours = won ? 3 + rand(3) : rand(5), theirs = won ? rand(5) : 3 + rand(3);
  spreadV1(Math.min(5, ours), kw, t.ourKills, star);
  spreadV1(Math.min(5, ours), odw, t.theirDeaths);
  spreadV1(Math.min(5, theirs), okw, t.theirKills);
  spreadV1(Math.min(5, theirs), dw, t.ourDeaths);
  return t;
}

export interface RoundTally { ourKills: number[]; ourDeaths: number[]; theirKills: number[]; theirDeaths: number[] }

/**
 * Kills and deaths for one round. Kills always equal the other side's deaths, nobody dies twice, and a round
 * is won by the side that ends with someone alive. A clutch (`clutch` = player index, `vs` = enemies left)
 * leaves that player as the only survivor, and they take the last `vs` kills.
 */
export function tallyRound(won: boolean, kw: number[], dw: number[], okw: number[], odw: number[], star?: number, clutch?: { who: number; vs: number }): RoundTally {
  const ourKills = [0, 0, 0, 0, 0], theirKills = [0, 0, 0, 0, 0], ourDeaths = [0, 0, 0, 0, 0], theirDeaths = [0, 0, 0, 0, 0];
  if (clutch) {
    // Four teammates fall; before that they took 5 - vs of the enemy with them. The clutcher finishes the rest.
    for (const i of dead(4, dw, clutch.who)) ourDeaths[i] = 1;
    spread(4, okw, theirKills);
    ourKills[clutch.who] += clutch.vs;
    spread(5 - clutch.vs, kw, ourKills, [0, 1, 2, 3, 4].filter((i) => i !== clutch.who));
    for (const i of dead(5, odw)) theirDeaths[i] = 1;
  } else {
    // Winners usually wipe the other side; losers take a few with them (and never all five).
    const ours = won ? 3 + rand(3) : rand(5), theirs = won ? rand(5) : 3 + rand(3);
    const oursDead = dead(Math.min(5, theirs), dw), theirsDead = dead(Math.min(5, ours), odw);
    oursDead.forEach((i) => (ourDeaths[i] = 1));
    theirsDead.forEach((i) => (theirDeaths[i] = 1));
    const n = theirsDead.length;
    if (star !== undefined && n > 0) { ourKills[star]++; spread(n - 1, kw, ourKills); } else spread(n, kw, ourKills);
    spread(oursDead.length, okw, theirKills);
  }
  return { ourKills, ourDeaths, theirKills, theirDeaths };
}

/** A made-up but consistent match rating: ~1.00 is average, 1.30+ is a big game. */
export const matchRating = (k: number, d: number, r: number) => Math.max(0.2, Math.min(2.6, 0.26 + (k / r) * 0.95 + ((r - d) / r) * 0.5));
