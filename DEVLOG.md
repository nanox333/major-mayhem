# Major Mayhem dev log

A running diary of what changed, what went wrong, and what we decided. Newest entry first. It's for people, so it skips the commit-message shorthand. The technical details live in the pull requests and issues it links to.

---

## 30 September 2026: a new look starts with the colours and one slim bar

**Where we started.** v1.3 was merged, and v1.5 is the new look, drawn from three target mockups (the draft screen, the home screen, Guess the pro). Before any screen is rebuilt, two things have to exist that everything else inherits: a palette and a top bar. Those are [#100](https://github.com/nanox333/major-mayhem/issues/100) and [#101](https://github.com/nanox333/major-mayhem/issues/101). The design questions were answered first (#98, #99): the introduction stays but is presented better, the tabs replace the numbered trail, the radar leaves the draft screen, and live chemistry replaces a seven-segment meter.

**The palette (#100).** The old look was gold on charcoal with chamfered corners cut with `clip-path` and gradients on most panels; the colours were written straight into about 300 rules. Now every colour is a token on `:root`: five surfaces, three text colours, one orange accent, the side and result colours, three radii, one shadow and one glow. I picked the accent by contrast, not by eye from the mockup: `#ff8a1f` is 7.6:1 on a panel, and the dark text on it is 8.1:1. The corners are small radii now. `clip-path` also clipped focus outlines, so that is a small accessibility win as well as a look. The rarity stripe on a team card used to be a 4px left border; on a rounded card that curves badly, so it is an inset shadow that follows the corner. Gradients stay only where they do a job: the fade at the edges of the case reel, the photo fade, the bar that sticks to the bottom of the screen, and the stripes on lost rounds. A new test, `contrast.test.ts`, reads the palette from `styles.css` and checks the pairs the game uses (4.5:1 for text, 3:1 for the outline of an input and for the focus ring), so a later palette change that fails contrast fails the build. The lowest text pair is 5.8:1. The share card, the icons and the link preview use the same palette.

**The top bar (#101).** The old header was a large logo and tagline, five labelled buttons, a game switch and a numbered trail: about 200 px tall on a phone. It is now one bar of 64 px on desktop and two rows of about 107 px on a phone. The mark and wordmark are on the left (a shield, the game's own badge shape and the same one the favicon uses, with a stencil M, until the brand work in #112). The four steps are icon tabs that show progress and are not links, because a draft has no undo; the current one is underlined and has `aria-current="step"`, finished ones carry a ✓ and a "(done)" for screen readers, and steps still to come say "(not yet)". Guess the pro is a separate link after the steps, and while you are in it the steps give way to a single "Back to the draft". Help and sound stay in the bar; Stats, Twitch chat votes and New run moved into a More menu, because a bar with five icons doesn't fit beside the wordmark on a phone. The settings panel (#110) will replace that menu. Chat votes stay in the bar once you have connected, so the connection state stays visible.

**What went wrong.** Two things. First, my phone layout wrapped the steps onto the first row at some widths (at 979 px the wordmark shrank to 52 px), because a flex line takes any item that still fits; a zero-height full-width item now forces the line break. Second, I found that the first-time introduction from v1.3 no longer showed on the first screen at all. The Play Daily home screen ([#93](https://github.com/nanox333/major-mayhem/pull/93)) and the introduction landed in the same week, and only the duel path still rendered it. It shows again, under the daily button, and it now opens with the tagline that used to sit under the logo.

— Claude

---

## 29 September 2026 (night): a game you can use on a phone

**Where we started.** v1.2 was merged, so v1.3 was about presentation and accessibility. On a 375×812 phone the Accept button sat at y=1169, 357 px below the fold; the first Draft button was around y=690; the map list started past y=1000. Guess the pro told you how close you were with green and yellow and nothing else. The help was ten dense points followed by every credit. On a desktop the radar took half the workspace while the player cards were squeezed into the other half.

**Phones ([#19](https://github.com/nanox333/major-mayhem/issues/19)).** The main button of each screen (Open case, Find match, Accept, Next map, Play again) now lives in an action bar that sticks to the bottom of the screen at tablet and phone widths. Accept is at y=750. Getting it to stick meant changing the console panel from `overflow: hidden` to `overflow: clip`, because a hidden overflow quietly makes the panel a scroll container and sticky positioning then has nothing to stick to. Players are rows with their Draft buttons beside the face, so three of them fit in the first screen. Both teams sit side by side before a match. The veto is a two-line row per map, hides its empty 0:0 scoreboard, and moves the long note about comfort under the list, so the maps start at y=446 instead of past 1000. Everything you can press is at least 44 px tall. I was told the veto list "scrolls inside a fixed-height box"; I couldn't reproduce that at 375 px (there was no inner scroller, the veto was just 910 px tall), so I shortened it instead.

**Desktop ([#20](https://github.com/nanox333/major-mayhem/issues/20)).** The page is wider. While you draft, the radar shrinks to 300 px and the three teams of a case sit side by side with their whole rosters; in a match the radar grows from 470 to 540 px. A team strip above the choices shows your seven slots filling up ([#69](https://github.com/nanox333/major-mayhem/issues/69)): photo and name once drafted, an icon while open, and on a phone seven icons you can tap. It shows the slot you chose, never a player's own role, so hard mode reveals nothing. The game switch is now a row of buttons, clearly apart from a numbered progress trail, and the header buttons have words on wide screens. Small labels and buttons moved off the tiny wide-spaced condensed capitals onto the body face in sentence case (33 rules, changed by script and read through), paragraphs use the system font, and the striped textures are gone.

**A shorter way in ([#21](https://github.com/nanox333/major-mayhem/issues/21)).** A first-time visitor sees a three-step introduction (draft, win the Major, compare and share) above the first case, and then a short tip the first time each mechanic appears: roles and fit, match-day form, the knife round, timeouts and buys, and match ratings. Dismissed tips stay dismissed, and anyone who has already finished a run, a daily or a duel isn't shown any of them. The help is now two screens: how to play (the three steps, then twelve short topics you can open) and sources and credits, so the rules and the credits are no longer one long scroll.

**Trivia and colour ([#22](https://github.com/nanox333/major-mayhem/issues/22)).** Every Guess the pro clue has a mark (✓ match, ≈ close, ✗ no match) and a written description ("Nation: Sweden. Same region."), a legend explains them, and a near match also gets a dashed border. Searching for a player who isn't there says "No players found", and the guess box is a proper combobox. On a phone each guess is a card of labelled clues instead of a table you scroll sideways. While I was there I went through everything else that leaned on colour alone: won and lost maps, ratings, killfeed lines, draft bonuses and penalties, lost rounds in match reports (now striped), form tags and the Twitch button.

**What went wrong.** The dev server served stale code more than once: its file watcher missed some edits on this path, and the browser kept cached module URLs, so a few "nothing changed" screenshots were really the old build. Polling in the watcher and a fresh port fixed it. A flex quirk made the phone tab row 60 px tall until it became a grid. I considered adding more single-key shortcuts ([#77](https://github.com/nanox333/major-mayhem/issues/77)) and stopped: single-character shortcuts need a way to turn them off (WCAG 2.1.4), which is a design of its own, so only the existing Space and → are documented. Also not taken: the big Play Daily button ([#68](https://github.com/nanox333/major-mayhem/issues/68), v1.4 territory), the emoji share grid ([#73](https://github.com/nanox333/major-mayhem/issues/73)), and a theme or high-contrast mode ([#75](https://github.com/nanox333/major-mayhem/issues/75)); only its "no colour-only states" half is done.

**How we checked.** Each screen was loaded from runs generated by the reducer (start, teams, players, coach, ready, preview, veto, knife, live, final, hard mode) at 320, 360, 375, 768, 880, 1024, 1280 and 1440 px, with no horizontal overflow in any of them and no touch target under 44 px on a phone. There are 117 unit tests, the balance check passes, and the rules-version test is untouched, so this needed no new rules version. Not checked: a real phone or a screen reader.

**Next up.** v1.4 retention ([#23](https://github.com/nanox333/major-mayhem/issues/23)): a prominent daily entry, clearer friend challenges, beginner achievements. A high-contrast setting and a switch for keyboard shortcuts would suit that milestone too.

— Claude

---

## 29 September 2026 (evening): decisions you can understand

**Where we started.** With the numbers right (see below), v1.2 was about the moments where the game asks you to decide something but doesn't help you decide.

**The draft ([#17](https://github.com/nanox333/major-mayhem/issues/17)).** The player's name was the Liquipedia link, and the small role chips were the real draft buttons. Now each card has one "Draft as IGL" button per slot, with the fit written underneath: *main role*, *secondary role, small penalty* or *off-role, big penalty*. That wording comes from the same function the simulation uses. Unavailable players get their exact reason, and picking a sub now tells you which role the bench player takes and how well it fits. Hard mode still hides all of it.

**The veto ([#65](https://github.com/nanox333/major-mayhem/issues/65)).** Comfort pips made you do the maths. Each map now says who has the edge ("▲ Your edge", "▼ FUR edge", "= Even"), worked out from the underlying values rather than the rounded pips. A note says plainly that comfort is a game value, not a win chance. The veto also shows what your click does, whose turn is next, and the final map order.

**Watching a match ([#16](https://github.com/nanox333/major-mayhem/issues/16)).** Pause, Next round, and a Tactical speed of about 0.65 s a round, slow enough to read the feed and call a timeout on purpose.

**After the run ([#18](https://github.com/nanox333/major-mayhem/issues/18), [#66](https://github.com/nanox333/major-mayhem/issues/66)).** A 93% "draft review" followed by a 0–3 exit looked like a contradiction. It wasn't: the number only ever measured each pick on its own. It's now called **Pick strength** and says so. Next to it, a **team review** covers what that number misses: roles, chemistry, who stood out, maps, calls, and one suggestion. Every match in the results also opens a **report** built from the saved record, with a round strip, both scoreboards and your calls. Nothing is re-simulated.

**Stats ([#64](https://github.com/nanox333/major-mayhem/issues/64), [#67](https://github.com/nanox333/major-mayhem/issues/67)).** A duel or an abandoned daily no longer waits for a finished Major before it shows up. "Win rate" was titles per run, so it's now called **Title rate** and shows its count. New runs are also counted by mode, so a hard-mode CS2 run isn't averaged in with easy ones.

**How we checked.** Each screen was checked at phone width in the dev server, with runs generated by the reducer and loaded straight into the page: a veto in progress, a paused map, a finished run. There are 110 unit tests, and the balance check and build still pass.

**Next up.** v1.3 presentation: the phone layout ([#19](https://github.com/nanox333/major-mayhem/issues/19)), onboarding ([#21](https://github.com/nanox333/major-mayhem/issues/21)), and trivia colours with symbols ([#22](https://github.com/nanox333/major-mayhem/issues/22)).

— Claude

---

## 29 September 2026 (later): making the numbers trustworthy

**Where we started.** The v1.1 milestone is "correct and trustworthy": a daily people compare can't show a player dying 30 times in 24 rounds. This session worked through every v1.1 issue on one branch, one commit per issue.

**The scoreboard ([#12](https://github.com/nanox333/major-mayhem/issues/12)).** Deaths were handed out with replacement, so the same player could die several times in one round. Each round is now tallied as a whole: deaths are picked without replacement, kills equal the other side's deaths, the winner keeps someone alive, and a 1vN clutch leaves exactly one survivor. That tally is a small pure function, which made it easy to test hundreds of rounds directly.

**Narration ([#15](https://github.com/nanox333/major-mayhem/issues/15)).** "You're saving" was written the moment the pistol was lost, before the player had chosen. Two random flavour lines also mentioned force buys in rounds with no force buy. Both are fixed.

**Filters that lied ([#63](https://github.com/nanox333/major-mayhem/issues/63)).** CS2 + Champions has only four teams, so the draft quietly fell back to the whole CS2 era. Now that option is struck through with a reason, and the other combinations are tested with full drafts.

**Data ([#25](https://github.com/nanox333/major-mayhem/issues/25), [#13](https://github.com/nanox333/major-mayhem/issues/13)).** `npm run fetch-data` got rate-limited by Wikipedia (HTTP 429), so we fetched the three pages we needed slowly, with a proper User-Agent. The three "unverified" lineups turned out to be right. The coach wasn't: Vitality won Paris 2023 under zonic, not XTQZZZ. For roles, some Wikipedia pages say the in-game leader is listed first. That gave us a real source for 23 rosters and three corrections. One page broke its own rule (Renegades 2019 lists jkaem first, but AZR led), so we left that one alone. Rather than trusting either blindly, we added a **Report incorrect data** link.

**Smaller things.** Guess the pro now says its counts are from the game's data, not careers ([#14](https://github.com/nanox333/major-mayhem/issues/14)). Duel links reject unknown options ([#27](https://github.com/nanox333/major-mayhem/issues/27)). `npm run media` no longer builds `C:\C:\…` paths on Windows.

**Then we fixed the thing that made all this risky ([#24](https://github.com/nanox333/major-mayhem/issues/24)).** Every fix above changes what a seed produces, so deploying mid-day would have changed a daily people were already playing. Now there are **rules versions**. A daily plays under the version in force on its date, a saved run keeps the version it started with, and duel links carry theirs. v1 is launch; v2 starts tomorrow with this session's fixes. The old code paths stay behind the version check, and so do the old data values (`rolesV1`, `coachV1`).

How do we know v1 really is untouched? We played Daily #1, Daily #2, four free runs, every roster's lineup and both Guess the pro answers on the original launch commit, and recorded fingerprints. A test now replays them under v1 with the new code, and they match exactly. The first attempt didn't: the corrected coaches had leaked into free play, and the test caught it. The only v1 difference left is text: the pistol line no longer says "You're saving" before you choose.

**One daily date ([#26](https://github.com/nanox333/major-mayhem/issues/26)).** Dailies use the local calendar day, but achievements were stamped in UTC. Both use the local day now. We kept local midnight rather than switching to UTC, because switching would make some players skip or repeat a day.

**Load time, measured before touching it.** The single-file build is 2.4 MB, 1.6 MB compressed. Images are 60% of it, sounds 15%, fonts 7%. Once the file has arrived, it parses and starts in about 50 ms, so load time is really download time: roughly a second on good 4G, several seconds on slow mobile. Numbers and a recommendation are on #24.

**Next up.** v1.2, clearer decisions: stats visibility ([#64](https://github.com/nanox333/major-mayhem/issues/64)), veto explanations ([#65](https://github.com/nanox333/major-mayhem/issues/65)), playback controls ([#16](https://github.com/nanox333/major-mayhem/issues/16)).

— Claude

---

## 29 September 2026: faces for (almost) everyone

**Where we started.** The game worked, but 56 players had no photo and 9 teams had no logo, so half the draft cards showed a grey silhouette. An earlier session had stopped after adding three logos. It had switched off certificate checking to get a headless browser through this environment's proxy, which was the wrong call, and it was rightly blocked from going further.

**What we did.** We went back to it with the rule that certificate checking stays on. That took a few wrong turns:

- Headless Chromium kept refusing the connection because it didn't trust the environment's proxy certificate authority, so it needed that authority added properly instead of bypassed.
- Once that was fixed, bo3.gg answered the browser with a 403. Plain `curl` got the full server-rendered page, including the player's real name in the title, so the final script needs no browser at all.
- A few slugs didn't follow the pattern (`get_right` keeps its underscore, `saffe`, `xertionic`, `player-910`, `kngv`), so we added a small override list and used the URLs you sent for those.

**Guarding against wrong faces.** A photo is only kept when the page title names the player, and the page shows exactly one player image. Anything else goes into a review list instead of the game. We also looked at every new photo and logo on a contact sheet before committing. Team pages show opponents' logos too, so the script takes the logo that appears most often on the page.

**Result.** 168 of 190 players have photos now (was 134) and all 34 teams have logos (was 22). Pull request [#11](https://github.com/nanox333/major-mayhem/pull/11).

**What's still missing.** 22 players, mostly the older ones. Their bo3.gg pages have no photo, or don't exist. One page (huNter-) shows a different person, so we left it out on purpose. They keep the silhouette and everything still works. Details are in the closing comment on [#1](https://github.com/nanox333/major-mayhem/issues/1).

**A mistake worth owning.** We first counted 169 photos and 21 gaps. That was wrong: two different players share the nickname adreN and one of them has no photo. The README's 168 was right all along.

**Also this session.** We reviewed the game more broadly and wrote up what to fix as issues [#12](https://github.com/nanox333/major-mayhem/issues/12) to [#28](https://github.com/nanox333/major-mayhem/issues/28). The most important one is [#12](https://github.com/nanox333/major-mayhem/issues/12): a match can currently show more deaths than the rounds allow, which undermines everything built on the numbers.

**Next up.** Fix the death counts and the misleading labels first, then make matches slower and pauseable so the tactical calls actually matter.

---

*How to add an entry:* put the newest one at the top, under a dated heading. Say what happened, what went wrong, what we decided and why, and link the PR or issue. Short is fine.
