# Contributing to Major Mayhem

Thanks for wanting to help. Major Mayhem is a small fan project with one maintainer ([@nanox333](https://github.com/nanox333)), and much of the code is written with [Claude Code](https://claude.ai/code). Pull requests, bug reports and roster corrections are all welcome.

## Before you start

- **Bugs:** open an issue with the *Bug report* form. Include the daily number or a share code if you have one; runs are seeded, so that's often enough to reproduce.
- **Roster or role corrections:** use the *Roster data* form and link a source (a Major's Wikipedia "Final standings" table or a Liquipedia page).
- **Ideas:** start in [Discussions](https://github.com/nanox333/major-mayhem/discussions) (category *Ideas*) if they're enabled, or open a *Feature request*. Anything that changes balance or how dailies are generated needs a short design note first.
- **Security problems:** don't open a public issue. See [SECURITY.md](SECURITY.md).

## Setting up

```bash
npm install
npm run dev          # local dev server (generates src/data/*.json from assets-src/ first)
npm test             # unit tests (vitest)
npm run check        # balance check: seeded simulations with pass/fail targets
npm run build        # typecheck + single-file build in dist/
npx playwright install chromium
npm run e2e:smoke    # quick Home → draft → Guess check at desktop and phone width
npm run e2e          # full headless playthrough at desktop and phone width
npm run e2e:ui       # responsive UI flows against dist/ (starts its own local preview)
```

For the UI checks against an existing dev server, set `UI_BASE_URL` (for example
`http://127.0.0.1:5173`). All browser scripts honor `CHROMIUM_PATH` when using a
locally installed Chromium. Run `npm run build` before checking production output.

The **Extended checks** workflow runs the full playthrough, responsive UI suite
and all 9,000 balance simulations weekly. You can also run it on a selected branch
from GitHub Actions → Extended checks → Run workflow. It runs independently of
routine CI and deployment. The smoke test uses installed Playwright Chromium
locally (`CHROMIUM_PATH` is supported), and the Ubuntu runner's preinstalled Chrome
in CI, avoiding a browser download and system-package installation on each change.

## Making a change

1. Branch from `main`. Keep a PR to one topic.
2. Run `npm test`, `npm run build` and `npm run e2e:smoke` before pushing. Routine CI runs these checks and deploys their exact build on `main`. For gameplay or rules changes, also run `npm run check` and the full browser suites.
3. Fill in the PR template. Link the issue it closes (`Closes #123`).
4. Changes that affect players get a line in [CHANGELOG.md](CHANGELOG.md) under *Unreleased*.

### Rules that keep dailies fair

Everyone plays the same daily, so data changes must not change a daily that has already started:

- New rosters get `{ since: '<tomorrow>' }` in `src/data/rosters.ts`. A unit test fails if the launch set changes.
- Retire a roster with `{ until: '<today>' }`; never delete one (old saves and past dailies point at it).
- Balance changes must keep `npm run check` inside its targets. Say in the PR how the numbers moved.
- **Anything that changes how a seed plays out** (the simulation, draft offers, roles, coaches, ratings) goes behind a **rules version**. Add one to `RULES` in `src/data/rosters.ts` starting tomorrow, name each behaviour it changes in `RULE_SINCE` (same file) and read it with `G.hasRule('name')` instead of comparing version numbers, and keep old data values next to the new ones (like `rolesV1` / `coachV1`). A daily plays under its date's rules, and a saved run keeps its own. `src/game/rules.test.ts` replays every earlier version against fingerprints recorded from the code that shipped it, and fails until the version you are replacing has its fingerprints pinned. If a pinned one fails, your change leaked into an old version: don't update the fingerprints.
- The daily date is the player's local calendar day (`today()` in `src/game/state.ts`). Use it everywhere, never UTC.

### Images

Player photos and team logos are fetched and name-checked by `scripts/fetch-bo3-photos.mjs`, or come from Wikimedia Commons with their licence recorded. Don't add images you can't credit. Logos are trademarks of their teams and photos belong to their owners.

## Labels

| Label | Meaning |
| --- | --- |
| `bug` | Something is wrong or broken |
| `correctness` | Data or narration contradicts what really happened |
| `enhancement` | New feature or improvement |
| `gameplay`, `ui`, `accessibility`, `data`, `engineering` | Area of the game or codebase |
| `priority: P1`…`P4` | P1 fix first; P4 nice to have |
| `good first issue` | Small and well-scoped |
| `design question` | Needs a decision before code |

## Code of conduct

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
