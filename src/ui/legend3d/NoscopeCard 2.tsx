import React from 'react';
import type { Lineup } from '../../game/lineup';
import { Avatar, TeamBadge } from '../art';
import { endcard } from '../endcard';
import { BrushMark } from '../BrushMark';
import { Title3D } from '../endcard/Title3D';

/** The closing card, laid out like the ace: the brush-cut title high on the screen (NO over SCOPE) and the player's plate under it.
 *  `--reveal` and `--title-pop` come from the clock (timeline.ts), set by whoever hosts the card. */
export function NoscopeCard({ who, map, round }: { who?: Lineup; map?: string; round?: number }) {
  return (
    <div className="noscope-card">
      <img className="endcard-hud" src={endcard('hud-orange')} alt="" />
      <Title3D name="noscope" fallback={<div className="noscope-card__mark"><BrushMark label="NO SCOPE" lines={[{ text: 'NO', size: 190, width: 250 }, { text: 'SCOPE', size: 160, width: 470 }]} /></div>} />
      {who && <div className="ace-person">
        <div className="ace-person__portrait"><Avatar player={who.player} roster={who.roster} /></div>
        <div className="ace-person__info"><span className="ace-person__kicker">Never looked through the scope.</span><strong>{who.player.nick}</strong>
          <span className="ace-person__team"><TeamBadge roster={who.roster} size={20} />{who.roster.org} · {who.roster.year}</span>
          {map && <span className="ace-person__round">{map}{round != null ? ` · Round ${round}` : ''}</span>}
        </div>
        <span className="ace-person__kills" aria-hidden="true"><i /></span>
      </div>}
    </div>
  );
}
