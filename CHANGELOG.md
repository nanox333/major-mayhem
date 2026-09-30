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
- **Desktop layout:** the page is wider, the three teams in a case sit side by side with their whole rosters, and the radar is small while you draft and large during a match. A **team strip** above the choices shows your seven slots filling up: a photo and name once drafted, an icon while open, and on a phone seven icons you can tap to see the pick ([#20], [#69]).
- **A shorter way in:** a three-step introduction (draft your team, win the Major, compare and share) on the first screen, then a short tip the first time each mechanic comes up: roles and fit, match-day form, the knife round, timeouts and buys, and match ratings. A dismissed tip stays dismissed, anyone who has already finished a run or a daily isn't shown them, and "Show the first-time tips again" in the help brings them back ([#21]).
- **The help is two screens:** *How to play* (the three steps, then twelve short topics you can open) and *Sources and credits*, kept apart from the rules ([#21]).
- **Navigation:** the game switch (Draft a Major / Guess the pro) is a row of buttons, clearly apart from the numbered progress trail (Draft, Lobby, Major, Results), and the header buttons carry words on wide screens ([#20]).
- **Typography:** small labels and buttons use a plain, sentence-case face instead of tiny wide-spaced capitals; paragraphs use the system font at a comfortable size; decision text (teams, players, buttons) is larger; the striped texture behind text is gone ([#20]).
- **A new look:** near-black navy panels with one orange accent, flat fills with thin borders and small rounded corners instead of chamfered gradients. Every colour is a named value in one place, inputs have an outline you can see, and a test checks the text and outline colours against WCAG contrast ([#100]).
- **One slim top bar** replaces the big logo, the row of labelled buttons and the game switch: the mark and wordmark, Guess the pro, help, sound and a menu that holds Stats, Twitch chat votes and New run. It is one row at every width, and on a phone Guess the pro moves into the menu ([#101]).
- **The four steps (Draft, Lobby, Major, Results) sit in the head of the game panel**, beside the title, and not in the top bar: the current step is filled and underlined, finished steps are ticked, and on a phone only the current step keeps its name on screen ([#140]).
- **A new home screen:** a hero with an original arena illustration, a live countdown to the next daily (to the second; the page moves on to the new daily at local midnight), three cards for Daily Challenge, Free Play and Guess the Pro, your stats (best finish, streak, runs, achievements) and how it works in four steps. Nothing on it needs a login: it all comes from this browser ([#113], [#116], [#117], [#118], [#119], [#120]).
- **The home is a place you can come back to.** Click the logo from anywhere; a run in progress is never touched. It says "Continue today's run · round 4 of 7", shows today's result once the daily is done, and asks before starting free play would abandon a daily that has started ([#115]). On a phone the Play Daily button is in the first screen in every state ([#121]).
- **The home screen fits the window and says things once** ([#148], [#149], [#150], [#151], [#152], [#153]): the top bar, hero, cards and every other screen share one container that grows from 1200 to 1720 px on big monitors, and the type scales up a little with the window. The daily is on the page twice on purpose, with two jobs: the card is the action ("Start", "Continue · Round 3 of 7" or a quiet "Replay") and the panel is the status (a countdown, progress dots, or "Next daily" with your result once it's done). The three mode cards line up their buttons, the secondary buttons have a visible outline, and copy is one voice. **How it works** is the four steps for a first visit and one slim row for anyone who has played, so there is no empty box. Your stats show the number first and are one sentence until you have a record. Links use the accent instead of the browser's blue, the smallest text is 14 px, and the footer is two readable columns. The hero puts the trophy under the light beams with three rows of crowd, and its tagline is one short sentence.
- **Icons:** one set of line icons drawn for the game replaces the scattered glyphs and inline drawings ([#114]).
- **The draft screen has three columns on wide screens:** your lineup on the left (photo, nick, team and year, the team's logo, and "Add player" where a slot is still open), the case in the middle, and a sidebar with the game mode, live team chemistry and a draft hint. The radar no longer takes room while you draft; the lobby and the match still have it ([#102], [#107]).
- **One line says where you are and what to do** ("Daily #2 · Draft · Round 3 of 7 · Choose your player"), an "Opened case" bar sits over the cards, and the reroll is "Spin again · 2 spins left" ([#103]).
- **The case shows all fifteen players at once.** Each team card has its logo, a placement in words and an icon ("1st place", "5th–8th place"), and a row per player with photo, nick, country, main role and any chemistry bonus. Pick a player, see which slot they fill and what that means, then Draft: no more choosing a team blind and finding out on the next screen. Hard mode still shows no roles and gives no default slot. A seed plays out exactly as before, and on a phone one card is open at a time ([#104], [#105]).
- **Twitch chat votes once, on a player,** instead of on the team and then the player ([#105]).
- **Live team chemistry** lists the links your picks make (same country, same org, famous duos, one era) with one word for the total: None yet, Some, Good or Strong. An info button opens the help on Chemistry. **The draft hint** says which slots you still need, from the open slots only ([#108], [#109]).
- Achievement dates use the same local day as the daily, not UTC ([#26]).
- **Draft cards:** one "Draft as …" button per slot, with the role fit written underneath; the name no longer doubles as the Liquipedia link; unavailable players say exactly why; subs show the role they take and the fit ([#17]).
- "Draft review" is now **Pick strength**, with a note on what it does and doesn't measure ([#18]).
- **Your stats:** duels and abandoned dailies show without a finished Major; achievements are always listed; "Win rate" is now **Title rate** with its count, and new runs are also counted by mode ([#64], [#67]).

### Fixed
- **Scoreboards add up:** a player dies at most once per round, kills always equal the other side's deaths, and a clutch leaves the clutcher as the only survivor ([#12]).
- **Narration follows your buy:** a lost pistol no longer says "You're saving" before you choose, and force-buy or anti-eco lines only appear when that's happening ([#15]).
- **Free-play filters stay true:** a filter that leaves too few teams (today, CS2 + Champions) can't be chosen, instead of quietly drafting from the whole era ([#63]).
- **The first-time introduction shows on the first screen again.** It had stopped showing once the start screen became the Play Daily page. It is the home's "How it works" now ([#21], [#101], [#120]).
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
[#69]: https://github.com/nanox333/major-mayhem/issues/69
[#65]: https://github.com/nanox333/major-mayhem/issues/65
[#66]: https://github.com/nanox333/major-mayhem/issues/66
[#67]: https://github.com/nanox333/major-mayhem/issues/67
[#13]: https://github.com/nanox333/major-mayhem/issues/13
[#14]: https://github.com/nanox333/major-mayhem/issues/14
[#15]: https://github.com/nanox333/major-mayhem/issues/15
[#24]: https://github.com/nanox333/major-mayhem/issues/24
[#19]: https://github.com/nanox333/major-mayhem/issues/19
[#20]: https://github.com/nanox333/major-mayhem/issues/20
[#21]: https://github.com/nanox333/major-mayhem/issues/21
[#22]: https://github.com/nanox333/major-mayhem/issues/22
[#25]: https://github.com/nanox333/major-mayhem/issues/25
[#26]: https://github.com/nanox333/major-mayhem/issues/26
[#27]: https://github.com/nanox333/major-mayhem/issues/27
[#38]: https://github.com/nanox333/major-mayhem/issues/38
[#100]: https://github.com/nanox333/major-mayhem/issues/100
[#101]: https://github.com/nanox333/major-mayhem/issues/101
[#140]: https://github.com/nanox333/major-mayhem/issues/140
[#102]: https://github.com/nanox333/major-mayhem/issues/102
[#103]: https://github.com/nanox333/major-mayhem/issues/103
[#104]: https://github.com/nanox333/major-mayhem/issues/104
[#105]: https://github.com/nanox333/major-mayhem/issues/105
[#107]: https://github.com/nanox333/major-mayhem/issues/107
[#108]: https://github.com/nanox333/major-mayhem/issues/108
[#109]: https://github.com/nanox333/major-mayhem/issues/109
[#113]: https://github.com/nanox333/major-mayhem/issues/113
[#148]: https://github.com/nanox333/major-mayhem/issues/148
[#149]: https://github.com/nanox333/major-mayhem/issues/149
[#150]: https://github.com/nanox333/major-mayhem/issues/150
[#151]: https://github.com/nanox333/major-mayhem/issues/151
[#152]: https://github.com/nanox333/major-mayhem/issues/152
[#153]: https://github.com/nanox333/major-mayhem/issues/153
[#114]: https://github.com/nanox333/major-mayhem/issues/114
[#115]: https://github.com/nanox333/major-mayhem/issues/115
[#116]: https://github.com/nanox333/major-mayhem/issues/116
[#117]: https://github.com/nanox333/major-mayhem/issues/117
[#118]: https://github.com/nanox333/major-mayhem/issues/118
[#119]: https://github.com/nanox333/major-mayhem/issues/119
[#120]: https://github.com/nanox333/major-mayhem/issues/120
[#121]: https://github.com/nanox333/major-mayhem/issues/121
[#63]: https://github.com/nanox333/major-mayhem/issues/63
