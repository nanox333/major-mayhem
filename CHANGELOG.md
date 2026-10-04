# Changelog

All notable changes to Major Mayhem. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). Every merge to `main` deploys to https://nanox333.github.io/major-mayhem/; tagged versions are listed on the [Releases](https://github.com/nanox333/major-mayhem/releases) page.

## [Unreleased]

### Removed
- **The light theme.** The game is dark only: the Theme setting (System, Dark, Light) is gone, nothing follows a light system any more, and a theme saved by an earlier version is ignored. High contrast remains.

### Added
- **Pages have addresses (#222):** Guess the pro, the Roster archive, Stats, Free play setup and the draft are `#/guess`, `#/archive`, `#/stats`, `#/setup` and `#/play`, and the Home is `#/`. Switching page on purpose adds a history entry, so Back and Forward move between pages, a reload on Guess, the archive, Stats or setup stays there, and a link to one of them can be shared or bookmarked. The draft adds one entry when you start it and none per pick, Back from it returns to the Home with the run kept, and a reload on it opens the Home with the run one Continue away, as before. An unknown address opens the Home, and challenge links (`#duel=…`) work as they did. A draft duel under way can now be continued from the Home like a free run, so Back from it no longer strands it.

### Changed
- **Draft duels are an equal-conditions comparison (rules v5, #172, #171):** the link now carries every case the challenger saw, spins included, so your friend is dealt exactly those cases whatever they pick, and can spin only where the challenger spun and no more often than they did. If none of three cases fits a slot you have left, any open slot takes any player (off-role costs rating) instead of leaving a dead end. The showmatch gives neither team match-day form, substitutions or tactical calls (the bench players sit it out), both teams ban, pick and take sides by one rule, and a seeded coin flip says who vetoes first. The invite, the lobby and the send button say what the link promises. Links made before this change stay valid, play under the rules they were made with, and say plainly that they are a challenge to beat a saved team, not an equal match. Every other mode plays as before.

### Fixed
- **The draft art pass is finished** (#225): evidence for every state in `docs/design/draft-evidence` (hard, coach, bench, secondary role, light, high contrast, effects off, 200% zoom, phone, missing art), the size and asset record, and a radar fix: markers keep a full 52px apart at any radar width, so each can be tapped. The weekly UI and full e2e suites run again (they had fallen behind the restyle) and `scripts/draft-evidence.ts` regenerates the captures. A Skip map button that covered the buy question on phones (a bug in the phone pass) is fixed, and the live match's footer is no longer hidden by the control dock. Sharper portraits are tracked in #267.
- The sideways tilt of the outer reels during the case roll now also plays in lite mode, so browsers that report few cores no longer lose it, and it eases in from flat when the roll starts (#264).

### Changed
- **Results page in the broadcast style:** a cut-corner outcome panel, green and red W/L blocks, a gold MVP card, a restyled ledger, share-image card and collapsible sections, and an orange Copy result button. Clicking the share image copies it to the clipboard, the match report opened from the ledger is a full broadcast-style panel, and roster, team review and pick strength are restyled. The Results step in the progress tabs is now a finish-line flag with a chequered edge.
- The debug menu is hidden in every build unless `?debug` is in the address or Ctrl+Shift+D was pressed.

### Changed
- **Timeouts matter more (rules v4):** a timeout now lifts the next three rounds about twice as much, those rounds are tagged "Timeout boost" in the round log, and an "After the timeout" card shows how they went. Runs on earlier rules (including dailies up to 3 October) play exactly as before.

### Fixed
- **A phone pass over the whole site** (#250 to #262): the match HUD no longer sits 52px low and under the banner, and the Home progress dots show again (a veto animation had taken their class name); the live match leads with the radar, keeps its controls to two short rows and brings a buy question into view; the map-complete and Accept/Find match buttons are solid, full-width bars that do not cover the scoreboard; the knife result is a full-width strip; the match report shows its score; the Results ledger is two lines a match; Guess rows wrap to two lines of cells and clear the entry bar; the Roster archive keeps its filters in view, loads 20 at a time and has a way back to the top (its cards had lost their team names); Home, Guess and the Roster archive are tabs under the logo instead of hiding in the menu; the How to play tabs share the width; controls are at least 44px and text at least 12px (11px for small caps labels) under 640px wide. `scripts/ui-e2e.ts` now checks horizontal overflow, target and text size, and bars covering the page end on every screen at 360 and 375px (#263).
- Skipped case openings retain a static rarity edge; hard-mode cases omit it (#74).
- **Nothing resizes under you:** every screen now uses the same content column (the map veto, knife round and live match were wider, and the results narrower), and the scrollbar keeps its space while a dialog is open, so opening settings or a roster no longer nudges the page. In the draft, the lineup rows keep one height, the chemistry preview no longer moves the hint, the decision panel holds its height from empty to chosen, and picking a substitute no longer moves the Accept button.
- Match pause and answered buy choices survive reloads; dialogs and hidden tabs suspend playback without changing pause intent.
- Result ratings keep shared duel players separate by side, include played bench contributors, and distinguish stronger role placements. Hard-mode pick strength uses its legal options consistently in the screen and exports.
- Dialogs render above sticky controls and suppress draft shortcuts; roster/lineup sheets preserve the selection and restore focus.

### Added
- **A flat, angular broadcast look across the app:** square dark panels with one cut corner, slanted orange ticks and buttons with a striped arrow block, in a redesigned header (flat logo, Home / Guess the pro / Roster archive, a Stats icon, How to play moved into the "..." menu), Home (a "Build your five" poster, a result band with MVP and daily-streak cells), Stats, Roster archive and Guess the pro as their own pages, a free-play setup page, and restyled Settings, How to play and Guess guide dialogs. A streak of eight days or more makes the Home streak cell burn. A debug menu (Ctrl+Shift+D) clears data and loads dummy stats. See `docs/design/editorial-system.md`.
- An arena-backed Home hero with a compact daily action/clock cluster and a five-starter diagram; light and high-contrast themes retain an art-free treatment (#214).
- Home mode cards use original traced equipment-case and anonymous pro artwork beside the copy, with visible stateful actions (#215).
- Guess autocomplete previews the next unsubmitted player without consuming a guess (#123).
- A mobile lineup sheet with selected-pick chemistry beside confirmation, and a searchable roster reference with contextual event/source links (#191, #192).
- Radar-backed veto cards and ordered series previews; a stable live-match layout with reachable tactical controls and expandable round history (#193, #194).
- Results sections that keep the outcome and sharing first, with detailed analysis collapsed on phones (#195).
- Skippable case openings and a remembered Fast case reveals preference (#196).

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
- **A new draft starts on a sealed case** (#225): starting a daily or free-play draft shows three sealed bays, in the place the reels and then the roster cards use, with the round, what is still to fill and an Open case button; nothing is drawn until you press it. Spin again now plays the reels again for the new three, spending one spin as before. Home's free-play button reads Start draft.
- **Your lineup is one row above the case at every desktop width** (#225): seven slots with photo, nick, role and team (open slots show their role and a "+"), and a ghost in the slot of the player you point at. It replaces the left column from 1280 px, so the three rosters take the full width, and on shorter windows (1366x768, 1440x900) the strip and cards tighten so the Draft button and Spin again stay on screen.
- A compact header, illustrated archive strip, icon-led Home stats and three-part credits footer; enlarged text and narrow stats tiles wrap cleanly (#217, #218).
- **Finishing the redesign:** the lobby, match-ready, map veto, knife round and map scoreboard follow the same flat, orange-led look (no more green buttons or panels; green and red only mark outcomes). The run's progress is plain text steps with no overlapping badges, every disclosure shares one chevron instead of the browser's triangle, the live controls stay on screen, the reroll sits in the draft's decision panel, and "How it works" is four numbered steps. Playback and share buttons use drawn icons instead of emoji glyphs.
- Home, draft, match and results share a charcoal/chalk visual system with readable body text, quieter surfaces and clear action priority (#200–#204). The home groups the daily action and countdown; phone drafting uses a roster selector; live radar markers have an accessible player key; results lead with the outcome and sharing.
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
- **The case is the focus of the draft** ([#144], [#145], [#143], [#146]): from 1280 px wide your lineup and the chemistry stack in a narrow column and the three team cards take the rest (about 316 px each at 1440, more on bigger windows). The cards are always the same size: player rows are one fixed height, the event line always leaves room for two lines, and selecting never changes a card's size. A player whose main role is already filled but who can still play another slot now says so: the taken role is struck through ("IGL taken") and the role they would play has a dashed outline and "2nd role", and the confirm panel lists the taken role too, disabled ("already filled"). **Point at a player** (mouse or keyboard) and a ghost row appears in the lineup slot they would take, with "If you draft …" in the chemistry panel: the word before and after ("None yet → Some") and the links it adds; pressing a player keeps the preview until you draft or pick someone else. Coaches preview the same way. The Game mode panel is gone (the heading already says "Daily #3"). Polish: fewer boxes (players are a list with hairlines), orange kept for the button, the selection and the preview, coach and bench slots have icons instead of C and B, calmer weights for names, and a proportionate Draft button.
- **Guess the pro, redesigned** ([#125], [#126], [#127], [#128], [#129]): a title and a ? button that opens the legend (off the page, so the grid has the room), a search box with a **Guess** button and "5 guesses left", and always eight rows: the ones you've used, oldest first, then faint empty ones with their number. Each row shows a **flag** with the country code, up to three **team badges** (the ones shared with the answer first and ticked, "No shared team" when there are none), first year, role, Majors and best finish; the flags are drawn for the game, offline, one for every country in the data. The tiles **turn over one at a time**, left to right, with a note as each one shows its result; the name pops in first; a bad guess shakes the box; a win makes the row bounce, then the answer card rises. Enter while a row is turning finishes it at once, a reload shows rows as they were with no replay, and with reduced motion nothing moves and the rows appear complete. Each guess is also announced once as a sentence. On a phone each guess is two lines, so all eight fit on one screen with the search box in a bar at the bottom. The end shows "Got it in 4" (or "Today's pro was"), the answer with flag and teams, share, your streak, the countdown to the next daily and one next step (today's draft, continuing it, or free play).
- **Settings, a light theme, high contrast and keyboard shortcuts** ([#110], [#75], [#77]): a gear in the top bar (an item in the menu on a phone) opens one dialog for sound, the theme (System, Dark or Light; with nothing saved it follows your device), high contrast, first-time tips (turning them on shows them all again), single-key shortcuts, chat votes and a new run. The light palette is a full set of the same colours, and high contrast makes borders stronger, text brighter and the focus ring thicker; a test checks every text and outline pair for each of the four palettes (dark and light, each with and without high contrast). The hero and the map stay dark in both. **Shortcuts:** `1` `2` `3` go to the first player in a team, choosing a player from the keyboard moves focus to the Draft button so `Enter` drafts, `Space` pauses, `→` steps a round while paused, `T` calls a timeout, `M` mutes and `?` lists them. They never fire while you type or with a dialog open, and there is an off switch because single-key shortcuts need one (WCAG 2.1.4).
- **First-time tips in the new look** ([#130]): every tip is one callout, a rounded panel with an accent rule on its left edge, a "Tip" label, a title, "Got it" and a quiet **Skip tips** that turns them all off (they come back from Settings). Only one tip shows at a time. The Roles and fit tip now sits over the case where you choose a player (it described a screen that no longer existed), with new wording about the "2nd role" mark, and a new **Team chemistry** tip sits under the chemistry panel. The hard-mode tip still names no roles, and someone who has finished a run still sees none of it.
- **Match: momentum and economy; results: the path** ([#71], [#72]): under the score, a **momentum bar** shows your share of the last six rounds with one sentence ("FaZe are on a 4-round run"), and **economy** says what each side is buying this round (full buy, force buy or eco, with $ marks), read from the rounds already played and your calls; the Timeout button pulses when the other side has won three in a row and a timeout would help. The results screen shows the **path through the Major**: the Swiss stage with its record and how it ended, the playoffs on a rail from quarterfinal to final, and where the run finished; every match still opens its report.
- **Stats: finishes over time** ([#76]): a **Last 14 dailies** chart, a column per day as tall as how far you got (gold for a title), with the finish written under it and the day of the month below that, and gaps for days you didn't play or abandoned. "Most drafted" is a numbered list. Plain CSS, no chart library.
- **Your maps before the veto, and a player's Majors** ([#49], [#48]): the lobby now has **Your maps**, the seven maps ranked by how at home your five are (pips and a word: strong, average, weak), the same comfort the veto compares with your opponent's. When you point at a player in the draft, the preview lists the Majors they attended and how far their team got ("2016 SF · 2018 1st").
- **Saves, records and links are checked, and you can back them up** ([#162], [#163], [#164], [#165], [#166], [#170], [#189]): only the first attempt at a daily is scored, and a replay (of a finished or an abandoned one) is labelled **practice** and changes no tally, streak or achievement, and is shared as practice. Every run has its own attempt identity and a result counts once, even across a reload or two tabs; a second tab that moves your run on is followed and not overwritten. A saved run is only resumed when everything in it is valid (the state machine, counters, people, matches), old saves still resume, and a damaged record or Guess history keeps the parts that are valid and drops the rest, so the game no longer gets stuck on an error screen. The error screen now offers a backup of exactly what is saved, clearing only the open run, and (confirmed) clearing everything. After a failed write to the browser the page says so ("Not saved on this device") with a backup button, and the totals stay consistent for the session. Settings has **Your data**: download a backup (a versioned file with your record, Guess history and open run) and restore one after a preview; restoring replaces, never merges, and changes nothing if the file is bad. Challenge links with a coach name like "constructor" or an impossible date are rejected.
- **Fairer opponents and sturdier choices** ([#167], [#169], [#174], [#175], [#176]): **rules v3 (from 1 October 2026):** an opponent who shares nobody with your team is used for as long as one is left, instead of switching to ones that do once fewer than eight remain; older dailies and saved runs keep their own rules, which a test pins to the recorded fingerprints of v1 and v2. Coach chemistry now reads the roster data of the rules a run started under, so a coach corrected later doesn't change an old daily or challenge. The Guess clue order is defined once, so the grid, the reveal sounds, the spoken row and the copied emoji row agree. A quick double click on Spin again spends one reroll, and in hard mode a Twitch vote picks the player but waits for the host to choose the role.
- **Focus, run guards and an earlier day's daily** ([#180], [#182], [#183], [#185]): playing the draft from the keyboard no longer loses your place: after you draft someone focus goes to Open case, then to the first player (or coach) of the next case, then to Find match in the lobby, and each round is announced ("Round 3 of 7: pick a player"). Starting any run that would replace one under way (today's or an earlier daily, or a free run) asks first, with the same wording everywhere, and the Guess next-step button continues a run under way instead of replacing it. A daily left unfinished from an earlier day is shown as that day's ("Daily #4 (2026-10-01) is unfinished") next to today's, never as today's. On a phone each collapsed roster card says how many of its players fit what you still need.
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
[#180]: https://github.com/nanox333/major-mayhem/issues/180
[#182]: https://github.com/nanox333/major-mayhem/issues/182
[#183]: https://github.com/nanox333/major-mayhem/issues/183
[#185]: https://github.com/nanox333/major-mayhem/issues/185
[#167]: https://github.com/nanox333/major-mayhem/issues/167
[#168]: https://github.com/nanox333/major-mayhem/issues/168
[#169]: https://github.com/nanox333/major-mayhem/issues/169
[#173]: https://github.com/nanox333/major-mayhem/issues/173
[#174]: https://github.com/nanox333/major-mayhem/issues/174
[#175]: https://github.com/nanox333/major-mayhem/issues/175
[#176]: https://github.com/nanox333/major-mayhem/issues/176
[#177]: https://github.com/nanox333/major-mayhem/issues/177
[#178]: https://github.com/nanox333/major-mayhem/issues/178
[#162]: https://github.com/nanox333/major-mayhem/issues/162
[#163]: https://github.com/nanox333/major-mayhem/issues/163
[#164]: https://github.com/nanox333/major-mayhem/issues/164
[#165]: https://github.com/nanox333/major-mayhem/issues/165
[#166]: https://github.com/nanox333/major-mayhem/issues/166
[#170]: https://github.com/nanox333/major-mayhem/issues/170
[#189]: https://github.com/nanox333/major-mayhem/issues/189
[#48]: https://github.com/nanox333/major-mayhem/issues/48
[#49]: https://github.com/nanox333/major-mayhem/issues/49
[#76]: https://github.com/nanox333/major-mayhem/issues/76
[#71]: https://github.com/nanox333/major-mayhem/issues/71
[#72]: https://github.com/nanox333/major-mayhem/issues/72
[#130]: https://github.com/nanox333/major-mayhem/issues/130
[#75]: https://github.com/nanox333/major-mayhem/issues/75
[#77]: https://github.com/nanox333/major-mayhem/issues/77
[#110]: https://github.com/nanox333/major-mayhem/issues/110
[#125]: https://github.com/nanox333/major-mayhem/issues/125
[#126]: https://github.com/nanox333/major-mayhem/issues/126
[#127]: https://github.com/nanox333/major-mayhem/issues/127
[#128]: https://github.com/nanox333/major-mayhem/issues/128
[#129]: https://github.com/nanox333/major-mayhem/issues/129
[#143]: https://github.com/nanox333/major-mayhem/issues/143
[#144]: https://github.com/nanox333/major-mayhem/issues/144
[#145]: https://github.com/nanox333/major-mayhem/issues/145
[#146]: https://github.com/nanox333/major-mayhem/issues/146
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
