import React from 'react';
import { Run, draftRounds, roundNumber, roundOf } from '../game/state';
import { RoleIcon } from './art';
import { ArrowRightIcon, BenchIcon, CaseIcon, CoachIcon } from './icons';
import { slotsOf } from './TeamStrip';
import { HowSteps, dismissTip, setTipsOn, useTipSeen } from './tips';

/**
 * The case before it is opened (#225): three sealed bays in the footprint the reels and then the roster cards will fill, so opening one changes nothing but what
 * is inside them. Below, a panel in the decision strip's place says what this round is, what is still to fill, and holds the one button that matters.
 * It shows no roster and no probability: the offer is drawn only when the button is pressed. The bays are decoration, hidden from assistive technology.
 */
export function CaseReady({ s, onOpen }: { s: Run; onOpen: () => void }) {
  const round = roundOf(s);
  const coach = round === 'coach';
  const left = slotsOf(s).filter((x) => !x.who);
  const total = draftRounds(s);
  const note = coach ? 'A coach from Major history' : 'A roster from Major history';
  const help = coach ? 'This case holds three coaches from Major history. A better coach lifts the team and makes your timeouts count for more, and knowing your players helps.'
    : round === 'bench' ? "Pick anyone from the case, any role. Before each match you can sub them in for a starter who's off form."
      : s.picks.length === 0 ? 'Each case holds three real rosters from a Major. Pick a team, then one player from it.'
        : 'Pick a team from the case, then one player from it.';
  return (
    <>
      <div className="teams-col ready__lanes" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <div key={i} className="lane lane--sealed">
            <p className="lane__label">Roster {i}</p>
            <div className="lane__window">
              <i className="lane__fade lane__fade--top" />
              <i className="lane__fade lane__fade--bottom" />
              <i className="lane__marker" />
              <div className="sealed">
                <span className="sealed__badge"><CaseIcon size={26} /></span>
                <span className="sealed__text"><strong>Sealed</strong><small>{note}</small></span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="ready-strip">
        <div className="ready-strip__id">
          <p className="ready-strip__eyebrow">Round {roundNumber(s)} of {total}{coach ? ' · Coach' : round === 'bench' ? ' · Bench' : ''}</p>
          <h3>{coach ? 'Three coaches are waiting' : 'Three rosters are waiting'}</h3>
          <p className="ready-strip__help">{help}</p>
        </div>
        {left.length > 0 && (
          <div className="ready-strip__fill">
            <p className="ready-strip__label" id="ready-fill">Still to fill</p>
            <ul aria-labelledby="ready-fill">
              {left.map((x) => (
                <li key={x.key} className={x.key === round ? 'is-now' : ''}>
                  {x.role ? <RoleIcon role={x.role} size={14} /> : x.key === 'coach' ? <CoachIcon size={14} /> : <BenchIcon size={14} />}
                  {x.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="action-bar ready-strip__action">
          <button type="button" className="cta cta--orange" data-sfx="open" onClick={onOpen}>Open case<ArrowRightIcon size={22} /></button>
          <small>Opening a case never spends a spin.</small>
        </div>
      </div>
    </>
  );
}

/**
 * The first-visit explanation of the game, as a quiet strip under the Open case panel instead of a boxed tip above it: four numbered steps in a row, a hairline
 * above them, and the same dismissal as every tip (Got it for this one, Skip tips for all). The button stays the first thing on the screen.
 */
export function HowStrip() {
  const done = useTipSeen('intro');
  if (done) return null;
  return (
    <section className="how-strip" aria-label="How Major Mayhem works">
      <div className="how-strip__head">
        <h3>How it works</h3>
        <span className="how-strip__btns">
          <button type="button" className="link-btn" onClick={() => setTipsOn(false)}>Skip tips</button>
          <button type="button" className="ghost-btn" onClick={() => dismissTip('intro')}>Got it</button>
        </span>
      </div>
      <HowSteps compact />
    </section>
  );
}
