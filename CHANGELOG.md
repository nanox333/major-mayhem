# Changelog

All notable changes to Major Mayhem. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). Every merge to `main` deploys to https://nanox333.github.io/major-mayhem/; tagged versions are listed on the [Releases](https://github.com/nanox333/major-mayhem/releases) page.

## [Unreleased]

### Added
- Community files: contributing guide, code of conduct, security policy, support page, roadmap.
- Issue forms (bug, feature, roster data), a pull request template and discussion templates.
- Dependabot updates for npm and GitHub Actions, CodeQL code scanning, label and milestone setup, and a release workflow.

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
