import React, { useId } from 'react';
import { Chemistry, Preview, draftHint, liveChemistry, majorsOf } from '../game/draftui';
import * as G from '../game/logic';
import { Run } from '../game/state';
import { strength } from '../game/synergy';
import { Sr } from './art';
import { Tip } from './tips';

/** The sidebar beside the case while you draft (#107, #108, #109): the mode, live chemistry, and a hint. All of it is built from your picks and the open slots, never from ratings. */
export function DraftSidebar({ s, onChemistryHelp, preview }: { s: Run; /** Opens the help on its Chemistry topic. */ onChemistryHelp: () => void; preview?: Preview | null }) {
  const hint_h = useId();
  const chem = liveChemistry(s.picks, s.coach, !!s.opts?.hard);
  return (
    <aside className="draft-side" aria-label="Draft details">
      {/* The hint is steady; the chemistry preview below it changes height as you point at players, so nothing sits under the part that moves. */}
      <section className="side-card hint-card" aria-labelledby={hint_h}>
        <h3 id={hint_h}>Draft hint</h3>
        <p>{draftHint(s)}</p>
      </section>
      <ChemistryCard chem={chem} onHelp={onChemistryHelp} preview={preview ?? null} />
      {!s.opts?.hard && <Tip id="chem" title="Team chemistry" anchor="up" short="Same country, team or era works better together.">Players from the same country, team or era work better together. Point at a player to see what they would add before you draft.</Tip>}
    </aside>
  );
}

/**
 * The draft's status line (#107 to #109, reworked): one quiet row between the lineup and the cases, so it is on screen without scrolling. What the lineup still
 * needs is plain muted text; chemistry is its word, its pips and the links behind it as small chips. What a player you point at would add is already in the
 * decision panel's "Why pick", so it isn't repeated here. Still built only from your picks and the open slots, never from ratings.
 */
export function DraftStatus({ s, onChemistryHelp }: { s: Run; onChemistryHelp: () => void }) {
  const chem = liveChemistry(s.picks, s.coach, !!s.opts?.hard);
  const shown = chem.rows.slice(0, 3);
  return (
    <div className="dstat" role="group" aria-label="Draft status">
      <p className="dstat__hint">{draftHint(s)}</p>
      <div className="dstat__chem">
        <span className="dstat__label">Chemistry</span>
        <b className="dstat__word">{chem.word}</b>
        <span className="pips" aria-hidden="true">{[1, 2, 3].map((i) => <i key={i} className={i <= chem.pips ? 'on' : ''} />)}</span>
        <span className="sr" role="status">Chemistry: {chem.word}</span>
        {shown.map((x) => <span key={x.label} className={`dstat__link ${x.value < 0 ? 'is-bad' : ''}`}><b>{strength(x.value)}</b>{x.label}</span>)}
        {chem.rows.length > shown.length && <span className="dstat__more">+{chem.rows.length - shown.length} more</span>}
        <button type="button" className="info-btn" onClick={onChemistryHelp} aria-label="What is team chemistry? Opens the help" title="What is this?" data-sfx="none">?</button>
      </div>
      {!s.opts?.hard && <Tip id="chem" title="Team chemistry" anchor="up" short="Same country, team or era works better together.">Players from the same country, team or era work better together. Point at a player to see what they would add before you draft.</Tip>}
    </div>
  );
}

/** Chemistry as the list of links behind it, with one word for the total. The pips are decoration; the word and the list carry it. */
function ChemistryCard({ chem, onHelp, preview }: { chem: Chemistry; onHelp: () => void; preview: Preview | null }) {
  const chem_h = useId();
  return (
    <section className="side-card chem" aria-labelledby={chem_h}>
      <h3 id={chem_h}>Team chemistry <button type="button" className="info-btn" onClick={onHelp} aria-label="What is team chemistry? Opens the help" title="What is this?" data-sfx="none">?</button></h3>
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
      ) : <p className="muted small">Same country, org or era builds links.</p>}
      <ChemIf preview={preview} />
    </section>
  );
}

/**
 * What the player you are pointing at would add (#143): the word before and after, and the links behind the change, as text with a mark.
 * The current consequence stays visible; longer historical context is available on demand.
 */
function ChemIf({ preview }: { preview: Preview | null }) {
  const pv = preview?.chem ?? null;
  const roster = preview ? G.rosterById.get(preview.rosterId) : undefined;
  const who = roster && preview ? (preview.coach ?? roster.players.find((p) => p.id === preview.playerId)?.nick ?? '') : '';
  return (
    <div className="chem__if">
      {!pv ? <p className="muted small">Point at a player to see what they would add.</p> : (
        <>
          <h4>If you draft {who}</h4>
          {preview?.playerId && <details className="chem__history"><summary>Major history</summary><Majors id={preview.playerId} /></details>}
          <p className="chem__total chem__total--if">
            {pv.before === pv.after
              ? <><b>{pv.after}</b><span className="muted small"> no change</span></>
              : <><b>{pv.before}</b><span aria-hidden="true"> → </span><Sr> to </Sr><b>{pv.after}</b></>}
          </p>
          {pv.added.length + pv.removed.length > 0 && (
            <ul className="synergies">
              {pv.added.map((x) => <li key={x.label} className={`syn syn--${x.kind} ${x.value < 0 ? 'is-bad' : ''}`}><b>{strength(x.value)}</b><span>{x.label}</span></li>)}
              {pv.removed.map((x) => <li key={`-${x.label}`} className="syn is-bad"><b>−</b><span>Loses {x.label}</span></li>)}
            </ul>
          )}
          {pv.capped && <p className="muted small">Already at maximum: this link adds nothing more.</p>}
          {!pv.added.length && !pv.removed.length && <p className="muted small">No new links.</p>}
        </>
      )}
    </div>
  );
}

/** The Majors the previewed player attended and how far their team got (#48): "2016 SF · 2018 1st". Text, so it reads the same without colour. */
function Majors({ id }: { id: string }) {
  const list = majorsOf(id);
  if (!list.length) return null;
  return <p className="chem__majors"><b>Majors</b> {list.map((m, i) => <React.Fragment key={i}>{i > 0 && ' · '}<span>{m.year} {m.result}</span></React.Fragment>)}</p>;
}
