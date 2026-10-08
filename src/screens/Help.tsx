import React, { useEffect, useState } from 'react';
import { ROSTERS, CREDITS } from '../data/rosters';
import { Modal } from '../ui/Modal';
import { HowSteps, resetTips } from '../ui/tips';
import { SHORTCUTS } from '../ui/shortcuts';
import { PrivacyNotes } from './PrivacyNotes';
import { useT } from '../i18n';

export type HelpTab = 'play' | 'sources' | 'privacy';

/**
 * Two screens in one dialog (#21): how to play (three steps, then the details a player can open), and, kept apart from the
 * rules, the sources and credits.
 */
export function HelpModal({ onClose, tab: first = 'play', topic }: { onClose: () => void; tab?: HelpTab; /** A topic to open and scroll to, by its title ("Chemistry"). */ topic?: string }) {
  const [tab, setTab] = useState<HelpTab>(first);
  const t = useT();
  const TITLES: Record<HelpTab, [string, string]> = {
    play: [t('help.playTitle'), t('help.playLead')],
    sources: [t('help.sourcesTitle'), t('help.sourcesLead')],
    privacy: [t('help.privacyTitle'), t('help.privacyLead')],
  };
  useEffect(() => {
    if (!topic) return;
    const d = [...document.querySelectorAll<HTMLDetailsElement>('.modal__card details')].find((x) => x.querySelector('summary')?.textContent === topic);
    if (!d) return;
    d.open = true;
    d.scrollIntoView({ block: 'center' });
    d.querySelector('summary')?.focus();
  }, [topic]);
  return (
    <Modal label={TITLES[tab][0]} onClose={onClose} wide>
     <div className="hp">
      <header className="hp__head">
        <span className="hp__kick">{t('help.kicker')}</span>
        <h3 className="hp__title">{TITLES[tab][0]}</h3>
        <p>{TITLES[tab][1]}</p>
      </header>
      <div className="seg help__tabs" role="tablist" aria-label={t('help.tablist')}>
        <button role="tab" id="help-tab-play" aria-selected={tab === 'play'} aria-controls="help-panel" className={tab === 'play' ? 'is-on' : ''} onClick={() => setTab('play')}>{t('help.tabPlay')}</button>
        <button role="tab" id="help-tab-sources" aria-selected={tab === 'sources'} aria-controls="help-panel" className={tab === 'sources' ? 'is-on' : ''} onClick={() => setTab('sources')}>{t('help.tabSources')}</button>
        <button role="tab" id="help-tab-privacy" aria-selected={tab === 'privacy'} aria-controls="help-panel" className={tab === 'privacy' ? 'is-on' : ''} onClick={() => setTab('privacy')}>{t('help.tabPrivacy')}</button>
      </div>
      <div role="tabpanel" id="help-panel" aria-labelledby={`help-tab-${tab}`}>
        {tab === 'play' ? <HowToPlay /> : tab === 'sources' ? <Sources /> : <PrivacyNotes />}
      </div>
     </div>
    </Modal>
  );
}

function HowToPlay() {
  const [reset, setReset] = useState(false);
  return (
    <>
      <HowSteps />
      <div className="hpflow" aria-label="A run at a glance">
        {['Draft seven', 'Lobby', 'Swiss stage', 'Playoffs', 'Results'].map((x, i) => <React.Fragment key={x}>{i > 0 && <i aria-hidden="true">›</i>}<span>{x}</span></React.Fragment>)}
      </div>
      <p className="hp__lead">Seven picks build your team: <b>five starters</b> (one each of IGL, AWPer, Entry, Lurker and Support / Anchor), <b>a coach</b> and <b>a bench player</b>. Then you play the Major with them. The game explains each part the first time it comes up; everything is here too. Open a section below.</p>

      <h4 className="hpg">Drafting <small>Rounds 1 to 7</small></h4>
      <div className="details">
        <details>
          <summary>Cases, cards and spins</summary>
          <div className="hps">
            <p>Each round you open a case: three real rosters from Major history. You pick one player from one of them.</p>
            <dl className="hpl">
              <dt>Card colour</dt><dd>Shows how that roster finished its Major: gold for champions, red for runners-up, pink for semifinalists, purple for quarterfinalists.</dd>
              <dt>Spins</dt><dd>Don't like the case? Spin again for a new one. You get two spins for the whole draft, not per round.</dd>
              <dt>No repeats</dt><dd>You can't draft the same person twice, even from two different years.</dd>
              <dt>Seven rounds</dt><dd>Rounds 1 to 5 are your starters, round 6 your coach, round 7 your bench player.</dd>
            </dl>
            <p className="hpx"><b>Example.</b> A case shows Heroic 2021, The MongolZ 2024 and Ninjas in Pyjamas 2015. You pick stavn from Heroic: he joins your lineup, and the next round opens a new case.</p>
          </div>
        </details>
        <details>
          <summary>Roles and fit</summary>
          <div className="hps">
            <p>Every player has a main role, and each of your five slots takes one player: IGL, AWPer, Entry, Lurker or Support / Anchor. A player can also cover roles close to their own, at a cost.</p>
            <dl className="hpl">
              <dt>Main role</dt><dd>The slot is their own role. No penalty.</dd>
              <dt>Secondary role</dt><dd>A role close to their own. A small penalty.</dd>
              <dt>Off-role</dt><dd>Anything else. A big penalty.</dd>
              <dt>Taken slots</dt><dd>When a player's main slot is already filled, their row says so and shows the role they would play instead. The Draft button always names the slot and how well they fit it.</dd>
              <dt>Hard mode</dt><dd>Hides the role labels, fit, chemistry and card colours. You choose the slot yourself and draft on knowledge alone.</dd>
            </dl>
            <p className="hpx"><b>Example.</b> Snappi is an IGL. If your IGL slot is full, his row reads "IGL taken" with Support as his second role. You can still draft him there, with a small penalty.</p>
          </div>
        </details>
        <details>
          <summary>Chemistry</summary>
          <div className="chemg">
            <p>Chemistry is the bonus for a team that fits together. Each link below adds a little, the links add up, and the total shows as one word: <b>None yet</b>, <b>Some</b>, <b>Good</b> or <b>Strong</b>, or <b>Clashing</b> when penalties win. Hidden ratings never come into it.</p>
            <p className="chemg__legend" aria-label="How big a link is"><span className="chemg__chip">+</span> small <span className="chemg__chip">++</span> solid <span className="chemg__chip">+++</span> big <span className="chemg__chip is-bad">−</span> a penalty</p>
            <ul className="chemg__list">
              <li><h5>Same country</h5><p>Three or more players from one country make a core, and a bigger core is worth more. The CIS (Russia, Ukraine, Kazakhstan, Belarus) counts as one.</p>
                <p className="chemg__ex"><span>3 Danes <b className="chemg__chip">++</b></span><span>4 Danes <b className="chemg__chip">+++</b></span></p></li>
              <li><h5>Shared history</h5><p>Players from the same roster work best together, then the same organisation in another year, then rosters a year apart.</p>
                <p className="chemg__ex"><span>Two from Astralis 2018 <b className="chemg__chip">++</b></span><span>Astralis 2017 and 2018 <b className="chemg__chip">+</b></span><span>Different teams, 2018 and 2019 <b className="chemg__chip">+</b></span></p></li>
              <li><h5>Famous duos</h5><p>Pairs who won, or nearly won, together.</p>
                <p className="chemg__ex"><span>dupreeh + xyp9x, Astralis mainstays <b className="chemg__chip">++</b></span></p></li>
              <li><h5>One era</h5><p>Every player from CS:GO rosters, or every player from CS2 rosters.</p>
                <p className="chemg__ex"><span>All CS:GO era <b className="chemg__chip">+</b></span></p></li>
              <li><h5>Your coach</h5><p>A coach who has coached players you drafted adds a link for each, up to a limit.</p>
                <p className="chemg__ex"><span>Coached one of your players <b className="chemg__chip">+</b></span><span>Coached two <b className="chemg__chip">++</b></span></p></li>
              <li className="is-bad"><h5>Two AWPers</h5><p>There is one AWP. A second main AWPer costs you, and each extra one costs more.</p>
                <p className="chemg__ex"><span>2 AWPers, one AWP <b className="chemg__chip is-bad">−</b></span></p></li>
            </ul>
            <h5 className="chemg__sub">How it adds up</h5>
            <p>Bonuses stack up to a cap, so once you are at <b>Strong</b> more links add nothing. Penalties have no cap. The word is only a summary: the list behind it is what counts.</p>
            <p className="chemg__eg"><b>Example.</b> You hold two Danish players. A third Dane makes a Danish core (3) <span className="chemg__chip">++</span>, and if he played on the same roster as one of them it also adds Shared history <span className="chemg__chip">++</span>. Your chemistry goes from <b>None yet</b> to <b>Good</b>.</p>
            <h5 className="chemg__sub">Where you see it</h5>
            <p>While you draft, the line above the cases shows your word and your biggest links. Point at a player and "Why pick" lists what they would add or break before you commit. The lobby lists every link once the team is set.</p>
          </div>
        </details>
        <details>
          <summary>Coach and bench</summary>
          <div className="hps">
            <dl className="hpl">
              <dt>Coach (round 6)</dt><dd>A better coach lifts the whole team and makes your timeouts count for more. A coach who has coached one of your players also adds a chemistry link.</dd>
              <dt>Bench (round 7)</dt><dd>Anyone, in any role.</dd>
              <dt>Subbing in</dt><dd>Before each match you can swap your bench player in for one starter, for that match only. They play that starter's role, and the fit is shown before you accept. Your starters are back for the next match.</dd>
            </dl>
            <p className="hpx"><b>Example.</b> One of your starters shows ▼ cold form today. Swap your bench player in for him, and check the fit note first: a bench player who is off-role in that slot may cost more than the cold form does.</p>
          </div>
        </details>
      </div>

      <h4 className="hpg">Playing the Major <small>Matches, maps and sides</small></h4>
      <div className="details">
        <details>
          <summary>The Major</summary>
          <div className="hps">
            <dl className="hpl">
              <dt>Swiss stage</dt><dd>Three wins and you reach the playoffs; three losses and you're out. Matches that can send you through or out are best of three, the rest are a single map.</dd>
              <dt>Playoffs</dt><dd>A best-of-three quarterfinal, semifinal and grand final.</dd>
              <dt>Opponents</dt><dd>Real rosters from Major history, picked so they don't share players with your team where possible.</dd>
              <dt>How you finish</dt><dd>Swiss stage exit, quarterfinal, semifinal, runner-up or Major champions.</dd>
            </dl>
          </div>
        </details>
        <details>
          <summary>Match-day form</summary>
          <div className="hps">
            <p>Before each match everyone, your bench player included, is rolled a form for the day. It nudges how well they play by a few rating points.</p>
            <p className="hpf"><span><b>▲▲</b> hot</span><span><b>▲</b> good</span><span><b>·</b> normal</span><span><b>▼</b> cold</span></p>
            <p>The arrows show next to each player before you accept the match. That is when to decide on a substitution.</p>
          </div>
        </details>
        <details>
          <summary>Map veto</summary>
          <div className="hps">
            <p>Every match opens with a veto. Each roster has maps it is more comfortable on (game values, like the ratings). Your team's comfort is the average of each player's original lineup.</p>
            <dl className="hpl">
              <dt>Best of three</dt><dd>Ban, ban, pick, pick, ban, ban. The map left over is the decider.</dd>
              <dt>Single map</dt><dd>Six bans, taking turns. The map left over is played.</dd>
              <dt>Reading it</dt><dd>Each map shows comfort pips for both teams and who has the edge. Ban their best maps and keep yours.</dd>
            </dl>
            <p className="hpx"><b>Example.</b> They have 5 pips on Nuke and you have 2: ban Nuke. You have 5 on Train and they have 2: pick it. An edge is one input among many, not a win chance.</p>
          </div>
        </details>
        <details>
          <summary>Knife round, sides and pistols</summary>
          <div className="hps">
            <dl className="hpl">
              <dt>Who chooses sides</dt><dd>On a map one team picked, the other team chooses its starting side. On the decider, and in a single-map match, a knife round decides.</dd>
              <dt>T and CT</dt><dd>T attacks and CT defends. Some maps favour one side. Entry fraggers and lurkers shine on T; AWPers and anchors shine on CT.</dd>
              <dt>Halftime</dt><dd>Sides swap, and the team leading at the half carries momentum into the second.</dd>
              <dt>Pistol rounds</dt><dd>Rounds 1 and 13. The team that loses one is on an eco for the next two rounds.</dd>
            </dl>
          </div>
        </details>
        <details>
          <summary>Tactical calls</summary>
          <div className="hps">
            <dl className="hpl">
              <dt>Timeout</dt><dd>One per half (one in overtime). It stops the opponent's run and lifts your next three rounds, more with a better coach. Press T, or use the button.</dd>
              <dt>Save or force</dt><dd>After a lost pistol you choose: save for a full buy, or force buy for a better next round, at the price of being broke the round after if it fails.</dd>
              <dt>Playback</dt><dd>Pause, step one round at a time, and slow the match to its tactical speed whenever you like.</dd>
            </dl>
            <p className="muted small">A draft duel's showmatch has no tactical calls for either team.</p>
          </div>
        </details>
        <details>
          <summary>Ratings and results</summary>
          <div className="hps">
            <p>Player strength is hidden, so trust your Counter-Strike knowledge. Results depend on role fit, chemistry, the coach, form and luck as well as the players.</p>
            <dl className="hpl">
              <dt>Scoreboard</dt><dd>After every map: kills, deaths and a match rating, where 1.00 is average. Stronger players tend to post better ratings, but anyone can have a bad map.</dd>
              <dt>Pick strength</dt><dd>When the run ends it reveals the hidden ratings and shows the strongest option you passed up each round.</dd>
              <dt>Team review</dt><dd>Covers roles, chemistry, maps and calls.</dd>
              <dt>Saved here</dt><dd>Your run, lifetime stats and achievements are kept in this browser.</dd>
            </dl>
          </div>
        </details>
      </div>

      <h4 className="hpg">Modes <small>Ways to play</small></h4>
      <div className="details">
        <details>
          <summary>Daily and free play</summary>
          <div className="hps">
            <dl className="hpl">
              <dt>Daily</dt><dd>Everyone gets the same cases that day, and it resets at your local midnight. Copy your result or share a result card at the end to compare with friends.</dd>
              <dt>Free play</dt><dd>Play as often as you like. You can limit it to one era (CS:GO or CS2), to champions only or underdogs only, or switch on hard mode.</dd>
              <dt>Guess the pro</dt><dd>A second daily: find the day's pro in eight guesses.</dd>
            </dl>
          </div>
        </details>
        <details>
          <summary>Draft duels</summary>
          <div className="hps">
            <p>Challenge a friend from your results screen. The link carries your team and every case you saw.</p>
            <dl className="hpl">
              <dt>Same cases</dt><dd>Your friend is dealt the cases you were, in the same order, and can spin only where you did.</dd>
              <dt>Equal terms</dt><dd>Then the two teams play a best of three with no match-day form, substitutions or tactical calls for either side. Maps and sides are chosen by the same rule for both, and a coin flip decides who vetoes first.</dd>
              <dt>Older links</dt><dd>A link made before this existed is a challenge to beat a saved team instead, and says so.</dd>
            </dl>
          </div>
        </details>
        <details>
          <summary>Twitch</summary>
          <div className="hps">
            <p>Streamers can let chat vote on every pick, the coach, map bans and sides. Open it from the Twitch button in the header or the menu.</p>
          </div>
        </details>
        <details>
          <summary>Keyboard</summary>
          <div className="hps">
            <p className="muted small">Single keys never fire while you are typing, and you can turn them off in Settings.</p>
            <ul className="hpk">{SHORTCUTS.map((k) => <li key={k.keys}><kbd>{k.keys}</kbd><span>{k.does}</span><small>{k.where}</small></li>)}</ul>
          </div>
        </details>
      </div>
      <div className="help__foot">
        <button className="st-btn" onClick={() => { resetTips(); setReset(true); }}>{reset ? '✓ The first-time tips will show again' : 'Show the first-time tips again'}</button>
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
      <p>Rosters, event dates and placements come from the “Final standings” tables on English Wikipedia's Major pages, retrieved 28 September and 4 October 2026. Each roster links to Liquipedia. Roles are assigned for the game and player strength is a hidden game rating, not a real statistic; so are coach ratings, nationalities as used for synergies, and map comfort (used in the veto). Events marked “unverified” were added from knowledge while Wikipedia couldn't be reached, and still need checking against their pages. Players' real names come from the titles of their bo3.gg player pages, kept only when the page is for the same nick; a name is left blank rather than guessed, and Guess the pro never shows them. The radars for all seven maps were supplied by the player; the map screenshots in the veto and the knife round come from the public repository neustcs/cs2mapsthumbnails on GitHub, and bo3.gg's map pages for Train (the artwork belongs to Valve). A new daily only draws on rosters that were in the game when it started.</p>
      <ul className="sources">
        {events.map((r) => (
          <li key={r.event}><span>{r.event}{r.unverified ? ' (unverified)' : ''}</span> <a href={r.sourceUrl} target="_blank" rel="noreferrer">Wikipedia</a> <a href={r.liquipediaUrl} target="_blank" rel="noreferrer">Liquipedia</a></li>
        ))}
      </ul>
      <h3>Icons and art</h3>
      <p>The interface icons, the logo mark and the arena on the home screen are drawn for this game and share its licence. They don't copy any other game's or team's artwork, and the game is not affiliated with Valve.</p>
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
