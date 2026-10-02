import React from 'react';
import { Action, MIN_POOL, Opts, Run, poolCheck } from '../game/state';
import { ArrowRightIcon, CaseIcon } from '../ui/icons';

/** The free-play options, one group each, with what each choice means and how many rosters it leaves. A choice that leaves too few can't be picked (#63). */
const GROUPS: { key: 'era' | 'pool' | 'hard'; title: string; note: string; options: { value: Opts[keyof Opts]; label: string; desc: string }[] }[] = [
  { key: 'era', title: 'Era', note: 'Which Majors the cases draw from.', options: [
    { value: undefined, label: 'All eras', desc: 'Every Major in the archive.' },
    { value: 'csgo', label: 'CS:GO', desc: 'The Global Offensive years.' },
    { value: 'cs2', label: 'CS2', desc: 'Counter-Strike 2 Majors only.' },
  ] },
  { key: 'pool', title: 'Teams', note: 'Which rosters can show up.', options: [
    { value: undefined, label: 'All teams', desc: 'Champions to early exits.' },
    { value: 'champions', label: 'Champions', desc: 'Only rosters that won a Major.' },
    { value: 'underdogs', label: 'Underdogs', desc: 'Rosters that did not reach the final.' },
  ] },
  { key: 'hard', title: 'Hard mode', note: 'How much the game tells you.', options: [
    { value: undefined, label: 'Normal', desc: 'Roles and fit are shown.' },
    { value: true, label: 'No role labels', desc: 'You choose slots blind.' },
  ] },
];

/** The page between "Start free play" and the first case: pick the pool, then start the draft. */
export function SetupScreen({ s, dispatch, onStart, onBack }: { s: Run; dispatch: React.Dispatch<Action>; onStart: () => void; onBack: () => void }) {
  const opts = s.opts ?? {};
  const set = (o: Opts) => dispatch({ type: 'opts', opts: { ...opts, ...o } });
  const now = poolCheck(opts);
  return (
    <main className="console sp su">
      <header className="sp-hero">
        <span className="sp-hero__icon" aria-hidden="true"><CaseIcon size={34} /></span>
        <div>
          <p className="sp-kicker">Free play</p>
          <h3>Set up your draft</h3>
          <p>Choose what the cases draw from. You can change this before you open the first case.</p>
        </div>
      </header>

      {GROUPS.map((g) => (
        <section key={g.key} className="su-group" aria-labelledby={`su-${g.key}`}>
          <div className="su-group__head"><h4 id={`su-${g.key}`}>{g.title}</h4><span>{g.note}</span></div>
          <div className="su-opts" role="group" aria-label={g.title}>
            {g.options.map((o) => {
              const on = (opts as Record<string, unknown>)[g.key] === o.value;
              const check = g.key === 'hard' ? { n: 0, ok: true } : poolCheck({ ...opts, [g.key]: o.value });
              const why = check.ok ? undefined : `Only ${check.n} team${check.n === 1 ? '' : 's'} match with your other settings; a full draft needs ${MIN_POOL}.`;
              return (
                <button key={o.label} type="button" className={`su-opt ${on ? 'is-on' : ''}`} aria-pressed={on} disabled={!check.ok} title={why} aria-description={why} onClick={() => set({ [g.key]: o.value } as Opts)}>
                  <b>{o.label}</b>
                  <small>{o.desc}</small>
                  {g.key !== 'hard' && <em>{check.n} roster{check.n === 1 ? '' : 's'}</em>}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <footer className="su-foot">
        <p className="su-foot__sum"><b>{now.n}</b> roster{now.n === 1 ? '' : 's'} in the pool{opts.hard ? ' · hard mode' : ''}</p>
        <div className="su-foot__btns">
          <button type="button" className="su-back" onClick={onBack}>Back</button>
          <button type="button" className="cta cta--orange su-start" data-sfx="open" onClick={onStart}>Start draft<ArrowRightIcon size={20} /></button>
        </div>
      </footer>
    </main>
  );
}
