// Balance and sanity check: simulated drafts are always completable, tournaments always finish,
// and draft skill matters. Seeded, so the numbers are reproducible. Exits 1 on any failure.
import { ROSTERS } from '../src/data/rosters';
import * as G from '../src/game/logic';

const N = Number(process.env.RUNS ?? 3000);
type Drafter = 'random' | 'fan' | 'expert';

/**
 * random clicks anything. expert knows every hidden rating and takes the best rating-for-slot on the board.
 * fan stands in for a real player: knows the scene, but misjudges each player's rating by about ±4.
 */
function simulate(drafter: Drafter, seed: string) {
  let fails = 0;
  const place: Record<string, number> = {};
  for (let run = 0; run < N; run++) {
    G.seeded(`${seed}:${run}`, () => {
      let picks: G.Pick[] = []; const seen: string[] = [];
      for (let round = 0; round < 5; round++) {
        const offer = G.makeOffer(picks, seen);
        if (offer.length !== 3 || !offer.every((id) => G.rosterEligible(G.rosterById.get(id)!, picks))) { fails++; return; }
        seen.push(...offer);
        const opts = offer.flatMap((id) => G.rosterById.get(id)!.players.flatMap((p) => G.eligibleSlots(p, picks).map((s) => ({ id, p, s }))));
        const noise = new Map(opts.map((o) => [o.p.id, drafter === 'fan' ? (G.random() + G.random() + G.random() - 1.5) * 8 : 0]));
        const v = (o: (typeof opts)[number]) => G.pickValue(o.p, o.s) + noise.get(o.p.id)!;
        const o = drafter === 'random' ? opts[G.rand(opts.length)] : opts.sort((a, b) => v(b) - v(a))[0];
        picks = [...picks, { slot: o.s, rosterId: o.id, playerId: o.p.id }];
      }
      if (new Set(picks.map((p) => p.playerId)).size !== 5) { fails++; return; }
      const mine = G.lineupFromPicks(picks);
      let t = G.newTournament(); let guard = 0;
      for (let st = G.nextStage(t); st && guard++ < 10; st = G.nextStage(t)) {
        const m = G.playMatch(st, mine, G.pickOpponent(t, st, mine), G.STAGE_BOOST[st]);
        if (m.maps.some((g) => g.rounds.length < 13) || (m.bestOf === 3 && m.maps.length < 2)) fails++;
        t = G.applyResult(t, m);
      }
      if (t.status === 'running') fails++;
      const pl = G.placement(t).key; place[pl] = (place[pl] ?? 0) + 1;
    });
  }
  const pct = (k: string) => Math.round(((place[k] ?? 0) / N) * 1000) / 10;
  return { fails, champ: pct('CHAMP'), final: pct('CHAMP') + pct('F'), qualOut: pct('QUAL'), place };
}

const random = simulate('random', 'check-random');
const fan = simulate('fan', 'check-fan');
const expert = simulate('expert', 'check-expert');
console.log({ rosters: ROSTERS.length, players: new Set(ROSTERS.flatMap((r) => r.players.map((p) => p.id))).size });
console.log('random drafter', random);
console.log('fan drafter', fan);
console.log('expert drafter', expert);

const powers = ROSTERS.map((r) => [r.org + ' ' + r.year, G.teamPower(G.naturalLineup(r)).total.toFixed(1)]).sort((a, b) => +b[1] - +a[1]);
console.log('strongest real rosters', powers.slice(0, 5), 'weakest', powers.slice(-3));

// Rating sanity: average match rating by hidden game rating band should rise with the band.
const bands: Record<string, number[]> = {};
G.seeded('check-bands', () => {
  const mine = G.naturalLineup(ROSTERS[0]);
  for (let i = 0; i < 400; i++) {
    const m = G.playMatch('QF', mine, ROSTERS[5].id, 0);
    for (const g of m.maps) for (const s of [...g.stats.mine, ...g.stats.opp]) {
      const p = ROSTERS.flatMap((r) => r.players).find((p) => p.id === s.id)!;
      (bands[String(Math.floor(p.rating / 5) * 5)] ??= []).push(s.rating);
    }
  }
});
const bandAvg = Object.entries(bands).sort(([a], [b]) => +a - +b).map(([k, v]) => [k, +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)] as const);
console.log('avg match rating by game rating band', Object.fromEntries(bandAvg));

// Balance targets: a knowledgeable fan wins a fair share of Majors, perfect knowledge wins more
// but not nearly every time, and random clicking rarely wins.
const problems: string[] = [];
if (random.fails || fan.fails || expert.fails) problems.push(`simulation failures: random ${random.fails}, fan ${fan.fails}, expert ${expert.fails}`);
if (fan.champ < 20 || fan.champ > 40) problems.push(`fan title rate ${fan.champ}% outside 20–40%`);
if (expert.champ > 65) problems.push(`expert title rate ${expert.champ}% above 65%`);
if (random.champ > 8) problems.push(`random title rate ${random.champ}% above 8%`);
if (fan.champ < random.champ * 4) problems.push(`draft skill barely matters: fan ${fan.champ}% vs random ${random.champ}%`);
const top = bandAvg[bandAvg.length - 1][1], bottom = bandAvg[0][1];
if (top <= bottom) problems.push('stronger players do not post better match ratings');

if (problems.length) { console.error('\nFAIL\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('\nOK: all balance targets met');
