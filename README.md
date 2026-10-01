<div align="center">

# Major Mayhem

**Draft a dream team from Counter-Strike Major history, then play it through a simulated Major.**

[**Play it**](https://nanox333.github.io/major-mayhem/) · [Dev log](DEVLOG.md) · [Open issues](https://github.com/nanox333/major-mayhem/issues) · [How it works](docs/HOW-IT-WORKS.md)

[![CI](https://github.com/nanox333/major-mayhem/actions/workflows/ci.yml/badge.svg)](https://github.com/nanox333/major-mayhem/actions/workflows/ci.yml)
[![CodeQL](https://github.com/nanox333/major-mayhem/actions/workflows/codeql.yml/badge.svg)](https://github.com/nanox333/major-mayhem/actions/workflows/codeql.yml)
[![Release](https://img.shields.io/github/v/release/nanox333/major-mayhem?sort=semver)](https://github.com/nanox333/major-mayhem/releases)

</div>

A Counter-Strike take on LoLdle's *Worlds Mayhem*. You get three historical Major rosters, pick one player from them, and repeat until you have a full team. Then you find out how far it goes.

## How a run goes

1. **Spin** for three rosters from Major history (2014 to 2026).
2. **Draft** one player per round into a role: IGL, AWPer, Entry, Lurker, Support/Anchor. Then a coach and a bench player.
3. **Play** a Swiss stage (three wins to advance, three losses and you're out), then quarterfinal, semifinal and grand final.
4. **Call it** during the match: take a timeout when the other side is on a run, or force buy after a lost pistol.
5. **Share** a spoiler-light result card.

## Ways to play

| Mode | What it is |
| --- | --- |
| **Daily challenge** | Everyone gets the same cases each day. Copy your result to share it. |
| **Free play** | Any time. Limit it to CS:GO or CS2, champions or underdogs, or turn on hard mode (no role labels). |
| **Draft duels** | Send a friend your challenge link. They draft from the same cases and the two teams play a best-of-three. |
| **Twitch chat votes** | A streamer's chat picks teams, players, the coach, map bans and sides. Read-only, no login. |
| **Guess the pro** | A second daily: everyone hunts the same pro in eight guesses. |

There are also 21 achievements, lifetime stats, and sound (on by default, starts after your first click; the speaker button mutes it).

## Run it yourself

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests
npm run check    # balance check: 9,000 simulated runs
npm run build    # typecheck + single-file build in dist/
npm run e2e:smoke # quick desktop/phone browser check
npm run e2e      # full playthrough in headless Chromium (needs: npx playwright install chromium)
```

The build is one self-contained HTML file with React and the fonts inside, so it works offline and makes no third-party requests. Built with React 18, TypeScript and Vite. Routine CI runs unit tests, the typecheck/build and a short desktop/phone browser check, then deploys that build on `main`. The full browser suites and 9,000 balance simulations run weekly or manually through the **Extended checks** workflow.

## What to know

- **Ratings are made up.** Rosters, dates and placements come from Wikipedia's Major standings. The strength ratings, roles and map comfort are game values written for balance, not real statistics.
- **Photos and logos** come from bo3.gg's public pages: 168 of 190 players and all 34 teams. Players without a photo show a silhouette in their team's colours.
- **Known gaps** are tracked as [issues](https://github.com/nanox333/major-mayhem/issues). The [dev log](DEVLOG.md) says what changed lately and why.

More detail is in [How it works](docs/HOW-IT-WORKS.md) (data sources, how a result is worked out, every file) and [HOSTING.md](HOSTING.md) (domain, analytics, moving hosts).

## Contributing

Bug reports, roster corrections and pull requests are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md), the [roadmap](docs/ROADMAP.md) and the [changelog](CHANGELOG.md). Questions and ideas go in [Discussions](https://github.com/nanox333/major-mayhem/discussions). Security problems: [SECURITY.md](SECURITY.md). This is a one-person fan project, built with [Claude Code](https://claude.ai/code).

## Licence

Code is ISC-licensed (see [`LICENSE`](LICENSE)); photos and logos are not covered by it. Fan project, not affiliated with Valve, Liquipedia, bo3.gg or any team. Logos are trademarks of their teams and photos belong to their owners. Get permission before sharing the game publicly.
