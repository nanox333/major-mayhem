# Changelog

All notable changes to Major Mayhem. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). Every merge to `main` deploys to https://nanox333.github.io/major-mayhem/; tagged versions are listed on the [Releases](https://github.com/nanox333/major-mayhem/releases) page.

## [Unreleased]

### Added
- Community files: contributing guide, code of conduct, security policy, support page, roadmap.
- Issue forms (bug, feature, roster data), a pull request template and discussion templates.
- Dependabot updates for npm and GitHub Actions, CodeQL code scanning, label and milestone setup, and a release workflow.
- A **Report incorrect data** link on every team in the draft, opening the roster-data form with the team filled in ([#13]).
- **Rules versions:** each daily plays under the rules of its date, and saved runs and duel links keep theirs, so fixes never change a challenge already in progress. The fixes below start with Daily #3 (30 Sep 2026) ([#24]).

- **Playback controls:** Pause, Next round and a slow **Tactical** speed; Space and → work on desktop ([#16]).
- **Match reports:** every match in your results opens a report with map scores, a round-by-round strip (timeouts, force buys, clutches) and both scoreboards ([#66]).
- **Team review** on the results screen: role fit, chemistry, who stood out, maps, calls and one suggestion for next time ([#18]).
- The map veto shows who has the **comfort edge** on each map, what your click does and whose turn is next, the veto so far and the final map order ([#65]).
- **Guess the pro without relying on colour:** every clue has a mark (✓ match, ≈ close, ✗ no match) and a description for screen readers ("Nation: Sweden. Same region."), with a legend above the guesses. Searching for a player who isn't there says "No players found", and one you already guessed says so ([#22]).
- **Symbols next to colours** on won and lost maps and matches, above- and below-average ratings, killfeed lines, draft bonuses and penalties, and the round strip in match reports (lost rounds are striped) ([#22], [#38]).

### Changed
- **On a phone, the main button stays in reach:** Open case, Find match, Accept, Next map and Play again are pinned to the bottom of the screen instead of sitting a screen or two down. Players are rows with their Draft buttons beside the face, both teams show side by side before a match, the header is smaller, the map veto is about a third shorter with the note on comfort under the list, and every button is at least 44 px tall. Guess the pro shows each guess as a card of labelled clues rather than a table that scrolls sideways ([#19]).
- Achievement dates use the same local day as the daily, not UTC ([#26]).
- **Draft cards:** one "Draft as …" button per slot, with the role fit written underneath; the name no longer doubles as the Liquipedia link; unavailable players say exactly why; subs show the role they take and the fit ([#17]).
- "Draft review" is now **Pick strength**, with a note on what it does and doesn't measure ([#18]).
- **Your stats:** duels and abandoned dailies show without a finished Major; achievements are always listed; "Win rate" is now **Title rate** with its count, and new runs are also counted by mode ([#64], [#67]).

### Fixed
- **Scoreboards add up:** a player dies at most once per round, kills always equal the other side's deaths, and a clutch leaves the clutcher as the only survivor ([#12]).
- **Narration follows your buy:** a lost pistol no longer says "You're saving" before you choose, and force-buy or anti-eco lines only appear when that's happening ([#15]).
- **Free-play filters stay true:** a filter that leaves too few teams (today, CS2 + Champions) can't be chosen, instead of quietly drafting from the whole era ([#63]).
- **Guess the pro** labels Majors, best finish and first year as counts from this game, not careers ([#14]).
- **Roster data:** Vitality's coach at Paris 2023 is zonic; Fnatic 2013 and LDLC 2014 get their coaches; the three "unverified" champions are checked against Wikipedia ([#25]). IGL labels corrected for Liquid 2024 (Twistzz), G2 2018 (shox) and AVANGAR 2019 ([#13]).
- Duel links accept only known free-play options ([#27]).
- `npm run media` works on Windows.

## [1.0.0] - 2026-09-29

The first tagged release, covering everything since the initial draft game.

### Added
- **Daily challenge** with seeded cases, a share card, streaks and a countdown ([#2], [#3]).
- **Draft review**, lifetime stats and a finished-daily card ([#2], [#3]).
- **Radars for all seven maps**; the tactics board follows the map being played ([#2]).
- **Knife rounds, side picks and halftime swaps**; map lean and role strength make the side choice matter ([#4]).
- **Map veto** (Bo1 bans; Bo3 ban-ban-pick-pick-ban-ban-decider), pistol rounds and eco rounds, clutches ([#5]).
- Shareable result cards and analytics ([#7]).
- **Swiss stage**, coach and bench picks, synergies, calls, extra modes, draft duels, Twitch votes and *Guess the pro* ([#8]).
- Sound effects (recorded CC0 samples) and bundled fonts ([#9], [#10]).
- Player photos and team logos from bo3.gg, name-checked: 168/190 players, 34/34 teams ([#11]).

### Changed
- Rebalanced so a knowledgeable fan wins about a third of Majors ([#2]).
- A steadier live match layout that works at phone width ([#9]).
- Deploys now run only after unit tests, balance check, build and e2e pass on `main` ([#6]).

### Fixed
- Saves that point at a removed player or team no longer crash the page; an error screen offers *Reset run* ([#6]).
- Adding a roster no longer changes dailies that have already been played ([#6]).
- Resetting a started daily records it as abandoned instead of allowing a replay with hindsight ([#6]).

[Unreleased]: https://github.com/nanox333/major-mayhem/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/nanox333/major-mayhem/releases/tag/v1.0.0
[#2]: https://github.com/nanox333/major-mayhem/pull/2
[#3]: https://github.com/nanox333/major-mayhem/pull/3
[#4]: https://github.com/nanox333/major-mayhem/pull/4
[#5]: https://github.com/nanox333/major-mayhem/pull/5
[#6]: https://github.com/nanox333/major-mayhem/pull/6
[#7]: https://github.com/nanox333/major-mayhem/pull/7
[#8]: https://github.com/nanox333/major-mayhem/pull/8
[#9]: https://github.com/nanox333/major-mayhem/pull/9
[#10]: https://github.com/nanox333/major-mayhem/pull/10
[#11]: https://github.com/nanox333/major-mayhem/pull/11
[#12]: https://github.com/nanox333/major-mayhem/issues/12
[#16]: https://github.com/nanox333/major-mayhem/issues/16
[#17]: https://github.com/nanox333/major-mayhem/issues/17
[#18]: https://github.com/nanox333/major-mayhem/issues/18
[#64]: https://github.com/nanox333/major-mayhem/issues/64
[#65]: https://github.com/nanox333/major-mayhem/issues/65
[#66]: https://github.com/nanox333/major-mayhem/issues/66
[#67]: https://github.com/nanox333/major-mayhem/issues/67
[#13]: https://github.com/nanox333/major-mayhem/issues/13
[#14]: https://github.com/nanox333/major-mayhem/issues/14
[#15]: https://github.com/nanox333/major-mayhem/issues/15
[#24]: https://github.com/nanox333/major-mayhem/issues/24
[#19]: https://github.com/nanox333/major-mayhem/issues/19
[#22]: https://github.com/nanox333/major-mayhem/issues/22
[#25]: https://github.com/nanox333/major-mayhem/issues/25
[#26]: https://github.com/nanox333/major-mayhem/issues/26
[#27]: https://github.com/nanox333/major-mayhem/issues/27
[#38]: https://github.com/nanox333/major-mayhem/issues/38
[#63]: https://github.com/nanox333/major-mayhem/issues/63
