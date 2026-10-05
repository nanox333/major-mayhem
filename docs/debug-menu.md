# The debug menu

A hidden workbench for reaching any screen, state and effect without playing for minutes (#237, #296). It is **off by default in every build**: it only appears with `?debug` in the address, or after Ctrl+Shift+D (remembered in that browser; "Hide debug" in the Data tab turns it off). Nothing in it is part of the game, and with it off nothing here can change a result.

## Tabs

**Scenarios.** About 40 states, each built by playing the real game (`src/ui/debug/scenarios.ts`) and then opened on its page: every draft round (sealed and open case, coach, bench, hard mode, era and champions pools), the lobby, match found with the bench panel, the veto and knife round, the live match (round 0, a lost pistol round 1 or 13 with the buy question, the opponent's run, after a timeout, overtime, a comeback, a 13–0, map complete), real legendary aces and 1v5s one round before they happen, and every result (champion, runner-up, semifinal, quarterfinal, Swiss, a run with a legendary moment). A scenario that needs a particular result is *found* by building real runs until one has it, so nothing in the simulation is forced. Rare ones (a miracle comeback, a 13–0) may need a few tries.

**Effects.** The legendary cinematic for each kind, "arm the next map" for a real ace or 1v5, *Replay animations* for the page you are on, freeze, slow motion (×0.1, ×0.25, ×0.5) and shortcuts to where each effect plays.

**Environment.** The game at 320, 360, 375, 390, 430, 768 or 1024px in a frame (same saves), a forced lite reel, a forced reduced-motion answer for the parts of the app that ask in code, and a fake clock (a date, or ten seconds before midnight, to watch the daily roll over).

**Tools.** *Scan* the page for horizontal overflow, tap targets under 40px and text under 11.5px (offenders are outlined), the run's phase, rules version and seed, *Copy bug report*, *Copy scenario link*, and *Restore my data*.

**Data.** What the menu always had: clear things, dummy stats, a streak of any length, achievements, the saved keys.

## Linking a state

`/?debug&scenario=live-pistol-lost-1` opens that scenario when the page loads (the ids are in `scenarios.ts`; *Copy scenario link* in Tools gives the link for the last one you opened). Use it in an issue, or from an end-to-end test instead of playing the flow.

## Your own data

The first time the menu changes anything it takes a snapshot of your saves; *Restore my data* puts them back. Scenarios open finished runs as already recorded, so they never touch your stats. The one that does, "Results that DO count", says so and is covered by the snapshot.

## For developers

- `debugRuns.ts` and `debug/scenarios.ts` replay the real reducer; add a scenario by adding an entry to `SCENARIOS`. `scenarios.test.ts` builds every one and checks the run is valid.
- `game/debugHooks.ts` holds the only switch that reaches into the simulation (force the next legendary round). It is `null` in normal play; the rules fingerprints in `rules.test.ts` prove nothing else changes.
- `game/clock.ts` is the one place that knows "now"; the debug offset is read only while the debug tools are on.
