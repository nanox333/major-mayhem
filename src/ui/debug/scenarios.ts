import { Role } from '../../data/rosters';
import * as G from '../../game/logic';
import { LEGENDS, LegendKind, ROLLED_LEGENDS } from '../../game/match';
import { debugHooks } from '../../game/debugHooks';
import { Opts, Run, fresh, reducer, roundOf, slotsFor } from '../../game/state';

// Debug only (#296): every screen and state, built by replaying the real reducer, so each one is exactly what a player could reach.
// A scenario that needs a particular result (a lost pistol round, overtime, a champion) is found by building real runs until one has it:
// nothing in the simulation is forced or changed for that.

/** What a scenario hands to the app: the run to adopt and where to open it. */
export interface Built {
  run: Run;
  /** Opens the live match at this round, paused (what the match page remembers between visits). */
  seen?: { n: number; paused?: boolean; bought?: number[] };
  /** The draft opens on its sealed case (`began`), as a freshly started run does. */
  sealed?: boolean;
}
export interface Scenario { id: string; group: string; title: string; note?: string; build: () => Built | null }

type Strategy = 'random' | 'strong';
const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
const best = <T,>(xs: T[], score: (x: T) => number): T => xs.reduce((a, b) => (score(b) > score(a) ? b : a));

/** A run with `picks` of its seven draft rounds done (five players, then the coach, then the bench), each case opened first. */
export function draftedRun(picks: number, strategy: Strategy = 'random', opts?: Opts): Run {
  for (let attempt = 0; attempt < 50; attempt++) {
    let s = fresh('free', undefined, opts);
    let ok = true;
    for (let round = 0; round < picks && ok; round++) {
      s = reducer(s, { type: 'spin' });
      const kind = roundOf(s);
      if (kind === 'coach') {
        const choices = s.offer.filter((id) => G.rosterById.get(id)?.coach);
        s = reducer(s, { type: 'coach', rosterId: pick(choices.length ? choices : s.offer) });
        continue;
      }
      let done = false;
      for (const id of [...s.offer].sort(() => Math.random() - 0.5)) {
        const roster = G.rosterById.get(id)!;
        const withTeam = reducer(s, { type: 'team', id });
        const taken = G.draftedIds(s.picks);
        if (kind === 'bench') {
          const free = roster.players.filter((p) => !taken.has(p.id));
          if (!free.length) continue;
          s = reducer(withTeam, { type: 'bench', player: strategy === 'strong' ? best(free, (p) => p.rating) : pick(free) });
          done = true; break;
        }
        const options = roster.players.flatMap((p) => slotsFor(withTeam, p).map((slot) => ({ p, slot: slot as Role }))).filter((o) => !taken.has(o.p.id));
        if (!options.length) continue;
        const o = strategy === 'strong' ? best(options, (x) => x.p.rating) : pick(options);
        s = reducer(withTeam, { type: 'draft', player: o.p, slot: o.slot });
        done = true; break;
      }
      ok = done;
    }
    if (ok) return s;
  }
  throw new Error('Could not build a draft');
}

const oppLineup = (s: Run) => G.naturalLineup(G.rosterById.get(s.current!.opponentId)!);
/** Plays the map veto through, choosing for you. */
const vetoed = (s: Run): Run => {
  while (G.vetoTurn(s.current!.veto)) s = reducer(s, { type: 'veto', map: G.vetoChoice(s.current!.veto, 'us', G.lineupFromPicks(s.picks), oppLineup(s)) });
  return s;
};
/** Chooses the starting side and so plays the map. */
const sided = (s: Run): Run => reducer(s, { type: 'side', side: G.autoSide(s.current!.next!) });
/** From a finished draft to the first match: found, then the veto played through, then the knife page. */
const toKnife = (strategy: Strategy = 'strong'): Run => vetoed(reducer(reducer(draftedRun(7, strategy), { type: 'play' }), { type: 'start' }));
/** The map being played, if there is one. */
export const gameOf = (s: Run): G.MapGame | undefined => s.current?.maps[s.current.maps.length - 1];

/** Builds real runs until one satisfies `want`, up to `tries`; null when none did. */
function search(want: (s: Run) => boolean, make: () => Run, tries = 600): Run | null {
  for (let i = 0; i < tries; i++) { const s = make(); if (want(s)) return s; }
  return null;
}
/** A run on the live map with a map that satisfies `want`. */
const liveWhere = (want: (g: G.MapGame) => boolean, n: (g: G.MapGame) => number, extra?: (s: Run) => Run): Built | null => {
  const s = search((r) => { const g = gameOf(r); return !!g && want(g); }, () => sided(toKnife()));
  if (!s) return null;
  const out = extra ? extra(s) : s;
  return { run: out, seen: { n: n(gameOf(out)!), paused: true } };
};
/** Plays whole runs until one ends the way you ask. */
export function finishedRun(want: (s: Run) => boolean, tries = 500): Run | null {
  return search(want, () => {
    let s = reducer(draftedRun(7, 'strong'), { type: 'play' });
    while (s.phase !== 'final') {
      s = reducer(s, { type: 'start' });
      s = vetoed(s);
      while (!s.current!.done) s = sided(s);
      s = reducer(s, { type: 'next' });
    }
    return s;
  }, tries);
}
const placed = (key: string) => (s: Run) => G.placement(s.t).key === key;
/** A finished run counts as seen, so showing it does not write anything to the player's record. */
const quiet = (run: Run): Run => ({ ...run, recorded: true });

const lostPistol = (g: G.MapGame, i: number) => g.rounds.length > i && g.rounds[i] === false;
const runOfLosses = (g: G.MapGame) => { for (let i = 3; i < g.rounds.length; i++) if (!g.rounds[i] && !g.rounds[i - 1] && !g.rounds[i - 2] && !g.rounds[i - 3]) return i + 1; return -1; };

const LEGEND_WORDS: Record<(typeof ROLLED_LEGENDS)[number], string> = { ace: 'ace', clutch5: '1v5 clutch', ninja: 'ninja defuse', noscope: 'no-scope', knife: 'knife kill' };

export const SCENARIOS: Scenario[] = [
  // ---- the draft ----
  { id: 'draft-sealed', group: 'Draft', title: 'Sealed case, round 1', note: 'The page a new run opens on.', build: () => ({ run: fresh('free'), sealed: true }) },
  { id: 'draft-sealed-3', group: 'Draft', title: 'Sealed case, round 4', build: () => ({ run: draftedRun(3), sealed: true }) },
  { id: 'draft-open-1', group: 'Draft', title: 'Open case, round 1', build: () => ({ run: reducer(draftedRun(0), { type: 'spin' }) }) },
  { id: 'draft-open-4', group: 'Draft', title: 'Open case, round 4', build: () => ({ run: reducer(draftedRun(3), { type: 'spin' }) }) },
  { id: 'draft-coach', group: 'Draft', title: 'Coach round', build: () => ({ run: reducer(draftedRun(5), { type: 'spin' }) }) },
  { id: 'draft-bench', group: 'Draft', title: 'Bench round', build: () => ({ run: reducer(draftedRun(6), { type: 'spin' }) }) },
  { id: 'draft-hard', group: 'Draft', title: 'Hard mode (no role labels), round 3', build: () => ({ run: reducer(draftedRun(2, 'random', { hard: true }), { type: 'spin' }) }) },
  { id: 'draft-cs2', group: 'Draft', title: 'CS2 era only, round 3', build: () => ({ run: reducer(draftedRun(2, 'random', { era: 'cs2' }), { type: 'spin' }) }) },
  { id: 'draft-champions', group: 'Draft', title: 'Champions only, round 3', build: () => ({ run: reducer(draftedRun(2, 'random', { pool: 'champions' }), { type: 'spin' }) }) },
  // ---- before the match ----
  { id: 'lobby', group: 'Lobby and match-ready', title: 'Lobby', build: () => ({ run: draftedRun(7) }) },
  { id: 'lobby-strong', group: 'Lobby and match-ready', title: 'Lobby with a strong team (best players)', build: () => ({ run: draftedRun(7, 'strong') }) },
  { id: 'preview', group: 'Lobby and match-ready', title: 'Match found, with the bench panel', build: () => ({ run: reducer(draftedRun(7), { type: 'play' }) }) },
  // ---- veto and knife ----
  { id: 'veto-start', group: 'Veto and knife', title: 'Veto: your first ban', build: () => ({ run: reducer(reducer(draftedRun(7), { type: 'play' }), { type: 'start' }) }) },
  { id: 'veto-done', group: 'Veto and knife', title: 'Veto finished: the map is locked', build: () => ({ run: toKnife() }) },
  { id: 'knife-won', group: 'Veto and knife', title: 'Knife round won: choose a side', build: () => { const r = search((s) => !!s.current?.next?.won, toKnife); return r ? { run: r } : null; } },
  { id: 'knife-lost', group: 'Veto and knife', title: 'Knife round lost: they choose', build: () => { const r = search((s) => s.current?.next?.won === false, toKnife); return r ? { run: r } : null; } },
  // ---- the live match ----
  { id: 'live-r0', group: 'Live match', title: 'Round 0, ready to start', build: () => ({ run: sided(toKnife()), seen: { n: 0, paused: true } }) },
  { id: 'live-mid', group: 'Live match', title: 'Round 8, paused', build: () => ({ run: sided(toKnife()), seen: { n: 8, paused: true } }) },
  { id: 'live-pistol-lost-1', group: 'Live match', title: 'Lost pistol round 1: the buy question', note: 'Found by playing real maps until one starts with a lost pistol.', build: () => liveWhere((g) => lostPistol(g, 0), () => 1) },
  { id: 'live-pistol-lost-13', group: 'Live match', title: 'Lost pistol round 13: the buy question', build: () => liveWhere((g) => lostPistol(g, 12), () => 13) },
  { id: 'live-pistol-won', group: 'Live match', title: 'Won pistol round 1', build: () => liveWhere((g) => g.rounds[0] === true, () => 3) },
  { id: 'live-run', group: 'Live match', title: "The opponent's run: the timeout warning", note: 'Four lost rounds in a row, timeout still available.', build: () => liveWhere((g) => runOfLosses(g) > 0 && runOfLosses(g) < 12, (g) => runOfLosses(g)) },
  { id: 'live-timeout', group: 'Live match', title: 'After a timeout: the card and the boost tags', note: 'Calls the timeout through the real action, then shows the three boosted rounds.', build: () => {
    const b = liveWhere((g) => runOfLosses(g) > 0 && runOfLosses(g) < 12, (g) => runOfLosses(g));
    if (!b) return null;
    const at = b.seen!.n;
    const run = reducer(b.run, { type: 'call', call: { kind: 'timeout', round: at } });
    return { run, seen: { n: Math.min(at + 3, gameOf(run)!.rounds.length), paused: true } };
  } },
  { id: 'live-overtime', group: 'Live match', title: 'Overtime', build: () => liveWhere((g) => g.rounds.length > 24, () => 25) },
  { id: 'live-comeback', group: 'Live match', title: 'A comeback from 8 down (a legendary moment)', note: 'Rare; may take a few tries.', build: () => liveWhere((g) => g.events.some((e) => e.legend === 'miracle'), (g) => g.rounds.length - 1) },
  { id: 'live-stomp', group: 'Live match', title: 'A 13–0 stomp, at the last round', build: () => liveWhere((g) => g.score[0] === 13 && g.score[1] === 0, (g) => g.rounds.length - 1) },
  { id: 'map-won', group: 'Live match', title: 'Map complete: won', build: () => liveWhere((g) => g.won, (g) => g.rounds.length) },
  { id: 'map-lost', group: 'Live match', title: 'Map complete: lost', build: () => liveWhere((g) => !g.won, (g) => g.rounds.length) },
  // ---- legendary moments ----
  ...ROLLED_LEGENDS.map((k): Scenario => ({
    id: `live-legend-${k}`, group: 'Legendary moments', title: `A real ${LEGEND_WORDS[k]}, one round before it happens`,
    note: 'Arms the debug hook for the next map, so the first round your team wins is legendary; press Next round to watch it arrive.',
    build: () => {
      debugHooks.legend = k;
      const run = sided(toKnife());
      debugHooks.legend = null;
      const at = gameOf(run)!.events.find((e) => e.kind === 'legend')?.round;
      return at ? { run, seen: { n: at - 1, paused: true, bought: [1, 13] } } : null;
    },
  })),
  { id: 'live-legend-flawless', group: 'Legendary moments', title: 'A real flawless 13–0, at the last round', note: 'Searched for in real maps; rare.', build: () => liveWhere((g) => g.events.some((e) => e.legend === 'flawless'), (g) => g.rounds.length - 1) },
  { id: 'live-legend-marathon', group: 'Legendary moments', title: 'A real marathon (more than one overtime), at the last round', note: 'Searched for in real maps; rare.', build: () => liveWhere((g) => g.events.some((e) => e.legend === 'marathon'), (g) => g.rounds.length - 1) },
  // ---- results ----
  { id: 'results-champion', group: 'Results', title: 'Champions', build: () => { const r = finishedRun(placed('CHAMP')); return r ? { run: quiet(r) } : null; } },
  { id: 'results-final', group: 'Results', title: 'Runner-up', build: () => { const r = finishedRun(placed('F')); return r ? { run: quiet(r) } : null; } },
  { id: 'results-sf', group: 'Results', title: 'Out at the semifinal', build: () => { const r = finishedRun(placed('SF')); return r ? { run: quiet(r) } : null; } },
  { id: 'results-qf', group: 'Results', title: 'Out at the quarterfinal', build: () => { const r = finishedRun(placed('QF')); return r ? { run: quiet(r) } : null; } },
  { id: 'results-swiss', group: 'Results', title: 'Out in the Swiss stage', build: () => { const r = finishedRun((s) => G.placement(s.t).key === 'QUAL' || G.placement(s.t).reached === 0); return r ? { run: quiet(r) } : null; } },
  { id: 'results-legend', group: 'Results', title: 'A run with a legendary moment', note: 'Searches many real runs; it can take a few seconds.', build: () => { const r = finishedRun((s) => s.t.matches.some((m) => m.maps.some((g) => g.events.some((e) => e.kind === 'legend'))), 900); return r ? { run: quiet(r) } : null; } },
  { id: 'results-record', group: 'Results', title: 'Results that DO count: new achievements (writes to your record)', note: 'Unlike the others, this one is recorded in the stats. A snapshot of your data is taken first, so "Restore my data" undoes it.', build: () => { const r = finishedRun(placed('CHAMP')); return r ? { run: r } : null; } },
];

export const scenarioById = new Map(SCENARIOS.map((s) => [s.id, s]));
export const SCENARIO_GROUPS = [...new Set(SCENARIOS.map((s) => s.group))];
export const isLegend = (k: string): k is LegendKind => (LEGENDS as readonly string[]).includes(k);
