// Basic check: random drafts are always completable and tournaments always terminate.
import { ROSTERS } from '../src/data/rosters';
import * as G from '../src/game/logic';
let champs = 0, fails = 0; const place: Record<string, number> = {};
const N = 3000;
for (let run = 0; run < N; run++) {
  let picks: G.Pick[] = []; const seen: string[] = [];
  for (let round = 0; round < 5; round++) {
    const offer = G.makeOffer(picks, seen);
    if (offer.length !== 3 || !offer.every(id => G.rosterEligible(G.rosterById.get(id)!, picks))) { fails++; break; }
    seen.push(...offer);
    const r = G.rosterById.get(offer[G.rand(3)])!;
    const opts = r.players.flatMap(p => G.eligibleSlots(p, picks).map(s => ({ p, s })));
    const o = process.env.SMART ? opts.sort((a,b)=>b.p.rating-a.p.rating)[0] : opts[G.rand(opts.length)];
    picks = [...picks, { slot: o.s, rosterId: r.id, playerId: o.p.id }];
  }
  if (picks.length !== 5 || new Set(picks.map(p => p.playerId)).size !== 5) { fails++; continue; }
  const mine = G.lineupFromPicks(picks);
  let t = G.newTournament(); let guard = 0;
  while (G.nextStage(t) && guard++ < 10) { const st = G.nextStage(t)!; const opp = G.pickOpponent(t, st, mine); const m = G.playMatch(st, mine, opp, G.STAGE_BOOST[st]); if (m.maps.some(g => g.rounds.length < 13) || (m.bestOf === 3 && m.maps.length < 2)) fails++; t = G.applyResult(t, m); }
  const pl = G.placement(t).key; place[pl] = (place[pl] ?? 0) + 1;
}
const powers = ROSTERS.map(r => [r.org + ' ' + r.year, G.teamPower(G.naturalLineup(r)).total.toFixed(1)]).sort((a, b) => +b[1] - +a[1]);
console.log({ rosters: ROSTERS.length, players: new Set(ROSTERS.flatMap(r => r.players.map(p => p.id))).size, fails, place });
console.log(powers.slice(0, 5), powers.slice(-3));
// rating sanity: average match rating by hidden game rating band
{
  const mine = G.naturalLineup(ROSTERS[0]); const bands: Record<string, number[]> = {};
  for (let i = 0; i < 400; i++) { const m = G.playMatch('QF', mine, ROSTERS[5].id, 0); for (const g of m.maps) for (const s of [...g.stats.mine, ...g.stats.opp]) { const p = ROSTERS.flatMap(r => r.players).find(p => p.id === s.id)!; const band = String(Math.floor(p.rating / 5) * 5); (bands[band] ??= []).push(s.rating); } }
  console.log('avg match rating by game rating band', Object.fromEntries(Object.entries(bands).map(([k, v]) => [k, +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)])));
}
