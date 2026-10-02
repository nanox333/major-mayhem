import { Role } from '../data/rosters';
import * as G from '../game/logic';
import { Run, fresh, reducer, roundOf, slotsFor } from '../game/state';

/** Debug only: a run with a random, valid team, built by playing the real reducer, so it is exactly what a player could have drafted. */
export type DebugStop = 'draft' | 'lobby' | 'match' | 'results';

const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

export function randomRun(stop: DebugStop): Run {
  let s = fresh('free');
  // Five players, a coach and a bench player. The draft page stops after three, with the next case still sealed.
  const rounds = stop === 'draft' ? 3 : 7;
  for (let round = 0; round < rounds; round++) {
    s = reducer(s, { type: 'spin' });
    const kind = roundOf(s);
    if (kind === 'coach') {
      const choices = s.offer.filter((id) => G.rosterById.get(id)?.coach);
      s = reducer(s, { type: 'coach', rosterId: pick(choices.length ? choices : s.offer) });
      continue;
    }
    // Shuffle the three rosters until one has a player who fits an open slot (the reducer refuses anything else).
    const order = [...s.offer].sort(() => Math.random() - 0.5);
    let done = false;
    for (const id of order) {
      const roster = G.rosterById.get(id)!;
      const withTeam = reducer(s, { type: 'team', id });
      if (kind === 'bench') {
        const free = roster.players.filter((p) => !G.draftedIds(s.picks).has(p.id));
        if (!free.length) continue;
        s = reducer(withTeam, { type: 'bench', player: pick(free) });
        done = true; break;
      }
      const options = roster.players.flatMap((p) => slotsFor(withTeam, p).map((slot) => ({ p, slot: slot as Role }))).filter((o) => !G.draftedIds(s.picks).has(o.p.id));
      if (!options.length) continue;
      const o = pick(options);
      s = reducer(withTeam, { type: 'draft', player: o.p, slot: o.slot });
      done = true; break;
    }
    if (!done) return randomRun(stop);
  }
  if (stop === 'draft') return s;
  if (stop === 'lobby') return s;
  s = reducer(s, { type: 'play' });
  if (stop === 'match') return reducer(s, { type: 'start' });
  // Results: play every match through the real reducer (the map veto and sides chosen for you) until the run is over.
  while (s.phase !== 'final') {
    s = reducer(s, { type: 'start' });
    const oppL = G.naturalLineup(G.rosterById.get(s.current!.opponentId)!);
    while (G.vetoTurn(s.current!.veto)) s = reducer(s, { type: 'veto', map: G.vetoChoice(s.current!.veto, 'us', G.lineupFromPicks(s.picks), oppL) });
    while (!s.current!.done) s = reducer(s, { type: 'side', side: G.autoSide(s.current!.next!) });
    s = reducer(s, { type: 'next' });
  }
  return s;
}
