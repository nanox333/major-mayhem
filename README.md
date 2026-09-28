# Major Mayhem

A Counter-Strike take on LoLdle's *Worlds Mayhem*. Spin for three historical Major rosters, draft one player per round into IGL, AWPer, Entry, Lurker and Support/Anchor, then run your dream team through a simulated Major: a qualification stage (2 wins to advance, 2 losses and you're out), quarterfinal, semifinal and grand final.

**Daily challenge:** everyone gets the same cases each day (Daily #1 was 28 Sep 2026). At the end, copy a spoiler-light result to share. The results screen also reveals the hidden ratings in a **draft review**: each pick against the strongest pick in that round's case. **Lifetime stats** (titles, finishes, streaks, most-drafted players, recent dailies) live behind the chart button.

React 18 + TypeScript + Vite. The build is a single self-contained HTML file (`dist/index.html`) with React bundled in, so it works offline. Only the Google Fonts stylesheet is external, and system fonts stand in without it.

## Run it

```bash
npm install
npm run dev          # local dev server
npm test             # unit tests (vitest): rules, seeding, daily mode, stats, share text
npm run check        # balance check: 9,000 seeded simulated runs, fails if balance drifts out of range
npm run build        # typecheck + single-file build in dist/
npx playwright install chromium   # once, for e2e
npm run e2e          # plays a full daily run in headless Chromium (desktop + phone width), screenshots in shots/
```

`dev`, `build`, `test` and `check` first run `npm run media`, which generates `src/data/media.json` and `src/data/radars.json` from `assets-src/` (skipped when it's already up to date). Set `CHROMIUM_PATH` to use an existing Chromium for e2e. GitHub Actions runs all of the above on every push (`.github/workflows/ci.yml`).

**Live site:** every push to `main` builds the game and publishes it to GitHub Pages (`.github/workflows/pages.yml`) at https://nanox333.github.io/major-mayhem/. It's public, photos and logos included. Pages must be switched on once under Settings → Pages → Source: "GitHub Actions".

## Data

- **Rosters, event dates and placements** come from the "Final standings" tables of English Wikipedia's Major pages (19 events, 2014–2026), retrieved 28 Sep 2026 and cached in `data/cache/wikipedia-standings.json`. The game reads only the bundled data; nothing is scraped at spin time.
- **Liquipedia** was the requested source but couldn't be used from the build environment: network egress to liquipedia.net was blocked, its `api.php` is disallowed for automated fetchers in robots.txt, and the site showed a Cloudflare human check in the browser. The game doesn't claim Liquipedia as its source; each roster and player links to Liquipedia so you can check it there.
- `npm run fetch-data` (Wikipedia) or `CONTACT=you@example.com npm run fetch-data -- --source liquipedia` fetches each event page through the MediaWiki API with a descriptive User-Agent, gzip and throttling (2 s between Liquipedia requests), caches the raw wikitext in `data/cache/<source>/`, and reports any roster whose players aren't found on the page. The Liquipedia page titles in the script are best guesses; it reports any title that doesn't resolve.
- **Roles** are assigned for the game (the sources don't list them). Players list a main role plus roles they can also cover; off-main roles cost a little strength.
- **Ratings** are invented *game ratings* for balance, not HLTV ratings or any real statistic. They're hidden in the game. After every map the scoreboard shows simulated kills, deaths and a match rating (1.00 = average) that tracks the hidden rating with plenty of map-to-map variance.
- **Maps:** radars for all seven maps (Dust 2, Mirage, Inferno, Nuke, Ancient, Anubis and Train) were supplied by the player (`assets-src/radars/`). `scripts/build-radars.mjs` trims each one to a square with a transparent background and writes `src/data/radars.json` (generated, not committed). During a match the tactics board switches to the map being played. Your team starts from each role's usual T-side spot and opponents hold CT positions (`POSITIONS` in `src/ui/art.tsx`). A map without a radar or positions falls back to the Dust 2 board. Nuke's radar shows the upper level only. The live killfeed uses callouts from whichever map is being played.
- **Photos and logos:** 134 of 147 player photos and 22 of 27 team logos. Most come from bo3.gg's public player and team pages (allowed by its robots.txt; its `/api/` wasn't used), loaded in a normal browser at a gentle pace, checked by eye against the player's real name, and cropped. A few gaps are filled with freely licensed Wikimedia Commons files. `scripts/build-media.mjs` turns the two bundles in `assets-src/` into `src/data/media.json` (generated, not committed); credits are in the game's "?" panel. Logos are trademarks of their teams and photos belong to their owners: fine for a personal fan project, but get permission before sharing the game publicly. Still missing: 910, GeT_RiGhT, pronax, jdm64, sergej, RpK, saffee, xertioN, FeTiSh, Fifflaren, frozen, jL, huNter- (photos) and Dignitas, Luminosity, AVANGAR, Renegades, Outsiders (logos).

## How results work

Team power = average (rating × role fit) + role balance (players on their main role) + a small chemistry bonus (teammates from the same lineup or organization, capped at +2). Each round is a weighted coin flip on the power gap plus match-day form and per-round swing. Qualification matches are Bo1; quarterfinal, semifinal and grand final are Bo3 on distinct maps from the Active Duty pool. Maps are MR12 to 13 with MR3 overtime. The MVP is the player with the best event rating, with highlight impact as a tiebreaker. Opponents get tougher each stage and never include anyone on your team. Real rosters get a small handicap (`OPP_HANDICAP`) so your dream team has an edge, and the semifinal and final get tougher (`STAGE_BOOST`).

All randomness goes through a seeded generator. Each case, opponent and match is seeded from the run seed plus the step, so a daily deals the same cases to everyone and reloading a run can't reroll it.

**Balance** (`npm run check`, 3,000 runs per drafter): a random drafter wins about 1% of Majors, a "fan" drafter who judges ratings with about ±4 error wins about 30%, and an expert who knows every hidden rating wins about 51%. The check fails if the fan drifts outside 20–40%, the expert goes above 65% or the random drafter above 8%.

## Files

- `src/data/rosters.ts` — the dataset (edit here to add rosters)
- `src/data/media.json` — cropped player photos and team logos (generated by `scripts/build-media.mjs`, git-ignored)
- `src/data/radars.json` — map radars (generated by `scripts/build-radars.mjs`, git-ignored)
- `src/game/logic.ts` — seeded randomness, draft rules, case offers, team power, match and Bo3 series sim, map callouts, player match ratings, bracket, draft review
- `src/game/state.ts` — run state, daily/free modes, save/load, the reducer
- `src/game/stats.ts`, `src/game/share.ts` — lifetime stats and the share text
- `src/game/*.test.ts` — unit tests
- `src/App.tsx` — the page shell; `src/screens/` — draft (case reel, teams, players), lobby, match found, live HUD and scoreboards, results, help, stats
- `src/ui/Board.tsx` — the tactics board; `src/ui/art.tsx` — role icons, team badges, player avatars, radars and positions per map
- `src/styles.css` — the CS2-style look and animations
- `scripts/` — `check.ts` (balance check), `e2e.mjs` (headless playthrough), `fetch-data.ts` (source refresh), `build-media.mjs` and `build-radars.mjs` (image pipeline), `sheet*.mjs` (contact sheets for checking photos by eye)
- `assets-src/` — raw image bundles and map radars used by the image pipeline

Code is ISC-licensed (see `LICENSE`); photos and logos are not covered by it. Fan project. Not affiliated with Valve, Liquipedia, bo3.gg or any team. Logos are trademarks of their teams and photos belong to their owners.
