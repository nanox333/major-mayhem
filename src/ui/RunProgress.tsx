import React from 'react';
import { Sr } from './art';
import { FlagIcon } from './icons';

// Where you are in a run (#140): Draft, Lobby, Major, Results. It sits in the head of the console, with the run it describes, and not in the top bar.
// It shows progress and is not a set of links (a draft has no undo). Never colour alone: the current step is bold and underlined, finished steps carry a check.

export function RunProgress({ steps, stepIdx }: { steps: string[]; stepIdx: number }) {
  return (
    <ol className="progress" role="list" aria-label="Progress">
      {steps.map((label, i) => (
        <li key={label} className={`pstep ${i === steps.length - 1 ? 'pstep--finish' : ''} ${i === stepIdx ? 'is-on' : ''} ${i < stepIdx ? 'is-done' : ''}`} aria-current={i === stepIdx ? 'step' : undefined}>
          <span className="pstep__label">{i < stepIdx && <span className="pstep__tick" aria-hidden="true">✓</span>}{i === steps.length - 1 && i >= stepIdx && <FlagIcon size={13} />}{label}</span>
          {i < stepIdx && <Sr> (done)</Sr>}{i > stepIdx && <Sr> (not yet)</Sr>}
        </li>
      ))}
    </ol>
  );
}
