import React from 'react';
import { Chemistry, draftHint, liveChemistry } from '../game/draftui';
import { Run, dailyDate, dailyNumber, optsLabel } from '../game/state';
import { strength } from '../game/synergy';
import { CheckIcon } from './icons';

/** The sidebar beside the case while you draft (#107, #108, #109): the mode, live chemistry, and a hint. All of it is built from your picks and the open slots, never from ratings. */
export function DraftSidebar({ s, onChemistryHelp }: { s: Run; /** Opens the help on its Chemistry topic. */ onChemistryHelp: () => void }) {
  const chem = liveChemistry(s.picks, s.coach, !!s.opts?.hard);
  return (
    <aside className="draft-side" aria-label="Draft details">
      <ModeCard s={s} />
      <ChemistryCard chem={chem} onHelp={onChemistryHelp} />
      <section className="side-card hint-card" aria-labelledby="hint-h">
        <h3 id="hint-h">Draft hint</h3>
        <p>{draftHint(s)}</p>
      </section>
    </aside>
  );
}

/** The current mode, read only: switching restarts the run, so it goes through New run in the menu. */
function ModeCard({ s }: { s: Run }) {
  const date = dailyDate(s);
  const tags = optsLabel(s.opts);
  const [name, note] = s.duel ? ['Draft duel', `Against ${s.duel.name}. You open the same cases they did.`]
    : date ? ['Daily Challenge', `Daily #${dailyNumber(date)}: one draft a day, and everyone gets the same cases.`]
      : ['Free play', tags.length ? tags.join(' · ') : 'Any era, any team, as many drafts as you like.'];
  return (
    <section className="side-card" aria-labelledby="mode-h">
      <h3 id="mode-h">Game mode</h3>
      <p className="mode-now"><CheckIcon size={16} /> <b>{name}</b></p>
      <p className="muted small">{note}</p>
      <p className="muted small">To change it, start a new run from the menu.</p>
    </section>
  );
}

/** Chemistry as the list of links behind it, with one word for the total. The pips are decoration; the word and the list carry it. */
function ChemistryCard({ chem, onHelp }: { chem: Chemistry; onHelp: () => void }) {
  return (
    <section className="side-card chem" aria-labelledby="chem-h">
      <h3 id="chem-h">Team chemistry <button type="button" className="info-btn" onClick={onHelp} aria-label="What is team chemistry? Opens the help" title="What is this?" data-sfx="none">?</button></h3>
      <p className="chem__total">
        <b>{chem.word}</b>
        <span className="pips" aria-hidden="true">{[1, 2, 3].map((i) => <i key={i} className={i <= chem.pips ? 'on' : ''} />)}</span>
      </p>
      <span className="sr" role="status">Chemistry: {chem.word}</span>
      {chem.rows.length ? (
        <ul className="synergies">
          {chem.rows.map((x) => (
            <li key={x.label} className={`syn syn--${x.kind} ${x.value < 0 ? 'is-bad' : ''}`}><b>{strength(x.value)}</b><span>{x.label}</span></li>
          ))}
        </ul>
      ) : <p className="muted small">No links yet. Players from the same country, org or era build chemistry.</p>}
    </section>
  );
}
