import React from 'react';
import { Sr } from './art';
import { CaseIcon, FlagIcon, RosterIcon, TrophyIcon } from './icons';

// Where you are in a run (#140): Draft, Lobby, Major, Results. It sits in the head of the console, with the run it describes, and not in the top bar.
// It shows progress and is not a set of links (a draft has no undo). Never colour alone: the current step is filled and underlined, finished steps carry a check.

const STEP_ICONS = [CaseIcon, RosterIcon, TrophyIcon, FlagIcon];

export function RunProgress({ steps, stepIdx }: { steps: string[]; stepIdx: number }) {
  return (
    <ol className="progress" role="list" aria-label="Progress">
      {steps.map((label, i) => {
        const Icon = STEP_ICONS[i];
        return (
          <li key={label} className={`pstep ${i === stepIdx ? 'is-on' : ''} ${i < stepIdx ? 'is-done' : ''}`} aria-current={i === stepIdx ? 'step' : undefined}>
            <span className="pstep__icon"><Icon size={18} />{i < stepIdx && <span className="pstep__tick" aria-hidden="true">✓</span>}</span>
            <span className="pstep__label">{label}</span>
            {i < stepIdx && <Sr> (done)</Sr>}{i > stepIdx && <Sr> (not yet)</Sr>}
          </li>
        );
      })}
    </ol>
  );
}
