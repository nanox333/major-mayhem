# Major Mayhem dev log

A running diary of what changed, what went wrong, and what we decided. Newest entry first. It's for people, so it skips the commit-message shorthand. The technical details live in the pull requests and issues it links to.

---

## 29 September 2026 (later): making the numbers trustworthy

**Where we started.** The v1.1 milestone is "correct and trustworthy": a daily people compare can't show a player dying 30 times in 24 rounds. This session worked through every v1.1 issue on one branch, one commit per issue.

**The scoreboard ([#12](https://github.com/nanox333/major-mayhem/issues/12)).** Deaths were handed out with replacement, so the same player could die several times in one round. Each round is now tallied as a whole: deaths are picked without replacement, kills equal the other side's deaths, the winner keeps someone alive, and a 1vN clutch leaves exactly one survivor. That tally is a small pure function, which made it easy to test hundreds of rounds directly.

**Narration ([#15](https://github.com/nanox333/major-mayhem/issues/15)).** "You're saving" was written the moment the pistol was lost, before the player had chosen. Two random flavour lines also mentioned force buys in rounds with no force buy. Both are fixed.

**Filters that lied ([#63](https://github.com/nanox333/major-mayhem/issues/63)).** CS2 + Champions has only four teams, so the draft quietly fell back to the whole CS2 era. Now that option is struck through with a reason, and the other combinations are tested with full drafts.

**Data ([#25](https://github.com/nanox333/major-mayhem/issues/25), [#13](https://github.com/nanox333/major-mayhem/issues/13)).** `npm run fetch-data` got rate-limited by Wikipedia (HTTP 429), so we fetched the three pages we needed slowly, with a proper User-Agent. The three "unverified" lineups turned out to be right. The coach wasn't: Vitality won Paris 2023 under zonic, not XTQZZZ. For roles, some Wikipedia pages say the in-game leader is listed first. That gave us a real source for 23 rosters and three corrections. One page broke its own rule (Renegades 2019 lists jkaem first, but AZR led), so we left that one alone. Rather than trusting either blindly, we added a **Report incorrect data** link.

**Smaller things.** Guess the pro now says its counts are from the game's data, not careers ([#14](https://github.com/nanox333/major-mayhem/issues/14)). Duel links reject unknown options ([#27](https://github.com/nanox333/major-mayhem/issues/27)). `npm run media` no longer builds `C:\C:\…` paths on Windows.

**A caveat.** The simulation and role changes alter results for the same seed, so a daily that's already in progress would play out differently after deploy. Merging just after the daily rolls over avoids that. [#24](https://github.com/nanox333/major-mayhem/issues/24) (versioning dailies with their rules) is the proper fix.

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
