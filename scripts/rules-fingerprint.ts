// Fingerprints of whole runs, played through the reducer, so a rules version can be checked against the code that
// first shipped it (#24). `npx tsx scripts/rules-fingerprint.ts` prints JSON; src/game/rules.test.ts compares the
// v1 fingerprints with the ones recorded from the launch code (commit afeb745).
import { ROSTERS } from '../src/data/rosters';
import * as G from '../src/game/logic';
import { Run, fresh, reducer, roundOf } from '../src/game/state';
import { answerFor } from '../src/game/guess';

function draftThrough(start: Run): Run {
  let s = start;
  while (s.phase === 'draft') {
    s = reducer(s, { type: 'spin' });
    const round = roundOf(s);
    if (round === 'coach') { s = reducer(s, { type: 'coach', rosterId: s.offer[0] }); continue; }
    if (round === 'bench') {
      s = reducer(s, { type: 'team', id: s.offer[0] });
      const taken = G.draftedIds(s.picks);
      s = reducer(s, { type: 'bench', player: G.rosterById.get(s.offer[0])!.players.find((p) => !taken.has(p.id))! });
      continue;
    }
    const r = G.rosterById.get(s.offer.find((id) => G.rosterEligible(G.rosterById.get(id)!, s.picks))!)!;
    s = reducer(s, { type: 'team', id: r.id });
    const p = r.players.find((p) => G.eligibleSlots(p, s.picks).length)!;
    s = reducer(s, { type: 'draft', player: p, slot: G.eligibleSlots(p, s.picks)[0] });
  }
  return s;
}

/** Plays a whole run, forcing after every lost first pistol and calling a timeout at round 6 when allowed. */
function playThrough(start: Run): Run {
  let s = reducer(draftThrough(start), { type: 'play' });
  while (s.phase !== 'final') {
    s = reducer(s, { type: 'start' });
    const oppL = G.naturalLineup(G.rosterById.get(s.current!.opponentId)!);
    while (G.vetoTurn(s.current!.veto)) s = reducer(s, { type: 'veto', map: G.vetoChoice(s.current!.veto, 'us', G.lineupFromPicks(s.picks), oppL) });
    while (!s.current!.done) {
      s = reducer(s, { type: 'side', side: G.autoSide(s.current!.next!) });
      s = reducer(s, { type: 'call', call: { kind: 'force', round: 1 } });
      s = reducer(s, { type: 'call', call: { kind: 'timeout', round: 6 } });
    }
    s = reducer(s, { type: 'next' });
  }
  return s;
}

/** Fingerprints under rules `rules`: runs are compared on outcomes (narration text is left out). */
export function fingerprints(rules: number) {
  const fp = (x: unknown) => G.hash(JSON.stringify(x, (k, v) => (k === 'text' ? undefined : v))).toString(16);
  const runs: Record<string, string> = {};
  for (const date of ['2026-09-28', '2026-09-29']) runs[`daily ${date}`] = fp(playThrough(fresh('daily', date)).t);
  // A daily played under v2 (from 2026-09-30), so later versions can be checked against it too.
  if (rules >= 2) runs['daily 2026-09-30'] = fp(playThrough(fresh('daily', '2026-09-30')).t);
  for (const seed of ['a', 'b', 'c', 'd']) runs[`free ${seed}`] = fp(playThrough({ ...fresh('free', '2026-09-29'), seed: `free-${seed}`, rules } as Run).t);
  const [lineups, guesses] = G.withRules(rules, () => [
    fp(ROSTERS.map((r) => G.naturalLineup(r).map((x) => [x.slot, x.player.id]))),
    fp(['2026-09-28', '2026-09-29'].map((d) => answerFor(d))),
  ]);
  return { runs, lineups, guesses };
}

if (process.argv[1]?.includes('rules-fingerprint')) console.log(JSON.stringify(fingerprints(Number(process.argv[2] ?? 1)), null, 1));
