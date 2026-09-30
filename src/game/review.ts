// The team review on the results screen (#18): what the team was, beyond how strong each pick was on its own. It
// describes what happened; it never claims one call or pick decided a result.
import * as G from './logic';

export interface TeamReview {
  roles: { main: number; secondary: number; off: number };
  synergies: string[];
  chemistry: number;
  strongest: { nick: string; rating: number } | null;
  weakest: { nick: string; rating: number } | null;
  maps: { won: number; lost: number; bestMap: string | null; worstMap: string | null };
  calls: { timeouts: number; forces: number; forcesWon: number };
  suggestion: string;
}

/**
 * The team as drafted (`lineup`: its roles and chemistry) and as fielded (who stood out is judged on everyone who actually played, the bench player
 * included if they were subbed in; a starter who never played has no rating and is not credited, #177).
 */
export function teamReview(lineup: G.Lineup[], coach: string | null | undefined, t: G.Tournament, bench?: G.Lineup | null): TeamReview {
  const roles = { main: 0, secondary: 0, off: 0 };
  for (const x of lineup) roles[G.fitNote(x.player, x.slot).kind]++;
  const power = G.teamPower(lineup, coach);
  const games = t.matches.flatMap((m) => m.maps);
  const ratings = G.seriesRatings(games);
  const played = (bench ? [...lineup, bench] : lineup).filter((x) => ratings[x.player.id]).map((x) => ({ nick: x.player.nick, rating: ratings[x.player.id].rating }))
    .sort((a, b) => b.rating - a.rating);
  const byMap = new Map<string, { w: number; l: number }>();
  for (const g of games) { const e = byMap.get(g.map) ?? { w: 0, l: 0 }; g.won ? e.w++ : e.l++; byMap.set(g.map, e); }
  const net = [...byMap].map(([map, e]) => ({ map, d: e.w - e.l })).sort((a, b) => b.d - a.d);
  const calls = { timeouts: 0, forces: 0, forcesWon: 0 };
  for (const g of games) {
    calls.timeouts += g.calls?.timeouts.length ?? 0;
    for (const r of g.calls?.force ?? []) { calls.forces++; if (g.rounds[r]) calls.forcesWon++; }
  }
  // A run of 4+ rounds against you, in a half where no timeout was called: the moment a timeout exists for.
  const missedTimeout = games.some((g) => {
    let run = 0;
    return g.rounds.some((won, i) => {
      run = won ? 0 : run + 1;
      const half = i < 12 ? [0, 12] : i < 24 ? [12, 24] : [24, 99];
      return run >= 4 && !(g.calls?.timeouts ?? []).some((r) => r >= half[0] && r < half[1]);
    });
  });
  const lost = games.filter((g) => !g.won).length;
  const suggestion = roles.off > 0 ? 'Put every player in a role they play: an off-role pick costs the most of anything in the draft.'
    : roles.secondary > 1 ? 'Try to fill more slots with players in their main role; secondary roles cost a little each.'
      : power.synergies.length === 0 ? 'Look for chemistry: players from the same team, era or nation, or a coach who knows them, add up.'
        : missedTimeout ? 'When the other side wins three or four in a row, call a timeout: it stops their run.'
          : lost > 0 && net.length > 1 && net[net.length - 1].d < 0 ? `In the veto, check the comfort edge: ${net[net.length - 1].map} went against you.`
            : 'A well-built team. Try hard mode, or a narrower era, for a tougher test.';
  return {
    roles,
    synergies: power.synergies.map((x) => x.label),
    chemistry: power.chemistry,
    strongest: played[0] ?? null,
    weakest: played.length > 1 ? played[played.length - 1] : null,
    maps: { won: games.length - lost, lost, bestMap: net[0]?.d > 0 ? net[0].map : null, worstMap: net.length && net[net.length - 1].d < 0 ? net[net.length - 1].map : null },
    calls,
    suggestion,
  };
}
