import React from 'react';
import { Chemistry, Preview, draftHint, liveChemistry, majorsOf } from '../game/draftui';
import * as G from '../game/logic';
import { Run } from '../game/state';
import { strength } from '../game/synergy';
import { Sr } from './art';
import { Tip } from './tips';

/** The sidebar beside the case while you draft (#107, #108, #109): the mode, live chemistry, and a hint. All of it is built from your picks and the open slots, never from ratings. */
export function DraftSidebar({ s, onChemistryHelp, preview }: { s: Run; /** Opens the help on its Chemistry topic. */ onChemistryHelp: () => void; preview?: Preview | null }) {
  const chem = liveChemistry(s.picks, s.coach, !!s.opts?.hard);
  return (
    <aside className="draft-side" aria-label="Draft details">
      <ChemistryCard chem={chem} onHelp={onChemistryHelp} preview={preview ?? null} />
      {!s.opts?.hard && <Tip id="chem" title="Team chemistry" anchor="up">Players from the same country, team or era work better together. Point at a player to see what they would add before you draft.</Tip>}
      <section className="side-card hint-card" aria-labelledby="hint-h">
        <h3 id="hint-h">Draft hint</h3>
        <p>{draftHint(s)}</p>
      </section>
    </aside>
  );
}

/** Chemistry as the list of links behind it, with one word for the total. The pips are decoration; the word and the list carry it. */
function ChemistryCard({ chem, onHelp, preview }: { chem: Chemistry; onHelp: () => void; preview: Preview | null }) {
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
      <ChemIf preview={preview} />
    </section>
  );
}

/**
 * What the player you are pointing at would add (#143): the word before and after, and the links behind the change, as text with a mark.
 * The panel keeps its height whether or not you are pointing at anyone, so nothing below it moves.
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
          {preview?.playerId && <Majors id={preview.playerId} />}
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
  return <p className="chem__majors"><b>Majors</b> {list.map((m) => `${m.year} ${m.result}`).join(' · ')}</p>;
}
