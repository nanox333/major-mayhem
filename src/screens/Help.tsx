import React, { useState } from 'react';
import { ROSTERS, CREDITS } from '../data/rosters';
import { Modal } from '../ui/Modal';
import { ThreeSteps, resetTips } from '../ui/tips';

export type HelpTab = 'play' | 'sources';

/**
 * Two screens in one dialog (#21): how to play (three steps, then the details a player can open), and, kept apart from the
 * rules, the sources and credits.
 */
export function HelpModal({ onClose, tab: first = 'play' }: { onClose: () => void; tab?: HelpTab }) {
  const [tab, setTab] = useState<HelpTab>(first);
  return (
    <Modal label={tab === 'play' ? 'How to play' : 'Sources and credits'} onClose={onClose}>
      <div className="seg help__tabs" role="tablist" aria-label="Help">
        <button role="tab" id="help-tab-play" aria-selected={tab === 'play'} aria-controls="help-panel" className={tab === 'play' ? 'is-on' : ''} onClick={() => setTab('play')}>How to play</button>
        <button role="tab" id="help-tab-sources" aria-selected={tab === 'sources'} aria-controls="help-panel" className={tab === 'sources' ? 'is-on' : ''} onClick={() => setTab('sources')}>Sources and credits</button>
      </div>
      <div role="tabpanel" id="help-panel" aria-labelledby={`help-tab-${tab}`}>
        {tab === 'play' ? <HowToPlay /> : <Sources />}
      </div>
    </Modal>
  );
}

function HowToPlay() {
  const [reset, setReset] = useState(false);
  return (
    <>
      <h3>How to play</h3>
      <ThreeSteps />
      <h3>The details</h3>
      <p className="muted small">The game explains each of these the first time it comes up. They're all here as well.</p>
      <div className="details">
        <details>
          <summary>Cases, cards and rerolls</summary>
          <p>A case holds three real rosters. The colour of a card, and the label beside it, show how that roster finished its Major: gold for champions, red for runners-up, pink for semifinalists, purple for quarterfinalists. You get two rerolls for the whole draft, and you can't draft the same person twice.</p>
        </details>
        <details>
          <summary>Roles and fit</summary>
          <p>Every player has a main role: IGL, AWPer, Entry, Lurker or Support / Anchor. Players can cover roles close to their own. Each Draft button says how well the player fits that slot: main role, secondary role (small penalty) or off-role (big penalty). Hard mode hides the role labels.</p>
        </details>
        <details>
          <summary>Chemistry</summary>
          <p>Synergies add up: three or more players from one country (or the CIS), famous duos, a lineup from one era, teammates from the same roster or organization. Two main AWPers on one team costs you. Player cards show what a pick would add; the lobby lists your synergies.</p>
        </details>
        <details>
          <summary>Coach and bench</summary>
          <p>Round 6 is the coach: a better coach lifts the team and makes timeouts count for more, and a coach who coached one of your players adds chemistry. Round 7 is the bench: anyone, any role. Before each match you can sub the bench player in for one starter.</p>
        </details>
        <details>
          <summary>The Major</summary>
          <p>The Swiss stage is three wins to reach the playoffs, three losses and you're out, with best-of-threes for the matches that can send you through or out. Then come the best-of-three quarterfinal, semifinal and grand final.</p>
        </details>
        <details>
          <summary>Match-day form</summary>
          <p>Before each match everyone has form: ▲▲ hot, ▲ good, ▼ cold. The bench player can sub in for one match and plays the starter's role, with the fit shown before you accept.</p>
        </details>
        <details>
          <summary>Map veto</summary>
          <p>Every match opens with a map veto. Each roster has maps it was comfortable on (game values, like the ratings); your team's comfort is the average of each player's original lineup. Ban their best maps and keep yours. Comfort is one input among many, so an edge is not a win chance.</p>
        </details>
        <details>
          <summary>Knife round, sides and pistols</summary>
          <p>Before each map there's a knife round (on a picked map, the other team chooses sides instead). Win it and you pick your starting side: T attacks, CT defends. Some maps favour one side, entry fraggers and lurkers shine on T, and AWPers and anchors shine on CT. Sides swap at halftime, and the team leading at the half carries momentum into the second half. Pistol rounds (1 and 13) put the losers on an eco for the next two rounds.</p>
        </details>
        <details>
          <summary>Tactical calls</summary>
          <p>During a map you have one timeout per half, which stops the opponent's run and lifts your next three rounds. After a lost pistol you choose to save or force buy. You can pause, step a round at a time and slow the playback to a Tactical speed.</p>
        </details>
        <details>
          <summary>Ratings and results</summary>
          <p>Player strength is hidden, so trust your CS knowledge. After every map you get a scoreboard with kills, deaths and a match rating (1.00 is average). Stronger players tend to post better ratings, but anyone can have a bad map. Results also depend on role fit, synergies, the coach, form and luck. When the run ends, Pick strength reveals the hidden ratings and shows the strongest individual option you passed up each round, and the team review covers roles, chemistry, maps and calls. Your run, lifetime stats and achievements save in this browser.</p>
        </details>
        <details>
          <summary>Daily, free play, duels and Twitch</summary>
          <p>The daily challenge deals everyone the same cases that day; copy your result or share a result card at the end. Guess the pro is a second daily: find the day's pro in eight guesses. Free play has modes: one era, champions only, underdogs only, or hard mode without role labels. Challenge a friend from the results screen: they draft from the same cases, then your teams play a best-of-three. Streamers can let Twitch chat vote on every pick (the Twitch button in the header).</p>
        </details>
        <details>
          <summary>Keyboard</summary>
          <p>Space pauses and resumes a match, and the right arrow plays one round while it's paused.</p>
        </details>
      </div>
      <div className="help__foot">
        <button className="ghost-btn" onClick={() => { resetTips(); setReset(true); }}>{reset ? '✓ The first-time tips will show again' : 'Show the first-time tips again'}</button>
      </div>
    </>
  );
}

function Sources() {
  const events = Array.from(new Map(ROSTERS.map((r) => [r.event, r])).values());
  const players = new Set(ROSTERS.flatMap((r) => r.players.map((p) => p.id))).size;
  const orgs = new Set(ROSTERS.map((r) => r.org)).size;
  return (
    <>
      <h3>Data</h3>
      <p>Rosters, event dates and placements come from the “Final standings” tables on English Wikipedia's Major pages, retrieved 28 September 2026. Each roster links to Liquipedia. Roles are assigned for the game and player strength is a hidden game rating, not a real statistic; so are coach ratings, nationalities as used for synergies, and map comfort (used in the veto). Events marked “unverified” were added from knowledge while Wikipedia couldn't be reached, and still need checking against their pages. The radars for all seven maps were supplied by the player. A new daily only draws on rosters that were in the game when it started.</p>
      <ul className="sources">
        {events.map((r) => (
          <li key={r.event}><span>{r.event}{r.unverified ? ' (unverified)' : ''}</span> <a href={r.sourceUrl} target="_blank" rel="noreferrer">Wikipedia</a> <a href={r.liquipediaUrl} target="_blank" rel="noreferrer">Liquipedia</a></li>
        ))}
      </ul>
      <h3>Sounds</h3>
      <p>Sound effects are recordings from four CC0 packs by <a href="https://kenney.nl" target="_blank" rel="noreferrer">Kenney</a>: Interface Sounds, Impact Sounds, Casino Audio and Sci-fi Sounds. Layered and levelled for the game; the Sound button in the header mutes them.</p>
      <h3>Photos and logos</h3>
      <p>Player photos and team logos come mainly from bo3.gg's public player and team pages, with a few freely licensed Wikimedia Commons files filling gaps. Logos are trademarks of their teams and photos belong to their owners; they're used only to identify players and teams in a personal fan project. {CREDITS.photos.length} of {players} players have a photo and {CREDITS.logos.length} of {orgs} teams have a logo.</p>
      <ul className="sources credits">
        {[...CREDITS.logos, ...CREDITS.photos].map((c) => (
          <li key={c.id}><span>{c.file}</span> <span className="muted">{c.source === 'bo3.gg' ? 'bo3.gg' : `${c.author} · ${c.license}`}</span> <a href={c.page} target="_blank" rel="noreferrer">{c.source === 'bo3.gg' ? 'bo3.gg' : 'Commons'}</a></li>
        ))}
      </ul>
    </>
  );
}
