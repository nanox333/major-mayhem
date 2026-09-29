# Roadmap

The plan is tracked in GitHub [milestones](https://github.com/nanox333/major-mayhem/milestones) and issues; this page summarises it. Priorities come from the review in issues #12–#28: correctness first, then decisions, then presentation, then retention.

## v1.1: Correct and trustworthy
Players compare dailies, so what the game says has to be right.
- Impossible scoreboards: deaths can exceed rounds played (#12)
- Historical roles (IGL, primary AWPer) on roster cards (#13)
- *Guess the pro* clues describe the dataset, not careers (#14)
- Narration contradicts choices after a force buy (#15)
- Three champion rosters still marked "unverified" (#25)
- Validate duel-link options (#27)

## v1.2: Clearer decisions
- Match playback: pause, next round, a slower tactical speed (#16)
- Draft cards that say what a pick will do before you make it (#17)
- Results: "Pick strength" plus a team review (#18)

## v1.3: Presentation and accessibility
- Phone layout: primary actions above the fold, bigger touch targets (#19)
- Desktop layout, navigation and typography (#20)
- A shorter three-step onboarding (#21)
- Trivia colours with symbols and descriptions; an empty search state (#22)

## v1.4: Retention
- A prominent daily entry, clearer friend challenges, beginner achievements, drop-off measurement (#23)

## Engineering and open questions
- Version dailies with the dataset and rules; measure load time before splitting assets (#24)
- CI on every branch runs the whole suite, including Chromium; trim that (#28)
- Should the daily roll over at local midnight or one global moment? (#26)
