import React, { useEffect, useMemo } from 'react';
import type * as G from '../game/logic';
import { Avatar, TeamBadge } from './art';
import { reduceMotion } from './util';

/** What each legendary moment is called on screen, and the line under it. */
export const LEGEND_TITLE: Record<G.LegendKind, { title: string; tag: string }> = {
  ace: { title: 'Ace', tag: 'Five kills. One player.' },
  clutch5: { title: '1v5 clutch', tag: 'Five of them. One player.' },
  flawless: { title: 'Flawless victory', tag: '13–0. Not one round dropped.' },
  miracle: { title: 'Miracle comeback', tag: 'Down by eight or more, and still won.' },
};

/** The same four, for lists and the collection: a short name and how it happens. */
export const LEGEND_INFO: Record<G.LegendKind, { title: string; how: string }> = {
  ace: { title: 'Ace', how: 'One of your players takes all five kills in a round.' },
  clutch5: { title: '1v5 clutch', how: 'The last player alive wins the round against five.' },
  flawless: { title: 'Flawless victory', how: 'A map won 13–0 against a side that was not far weaker.' },
  miracle: { title: 'Miracle comeback', how: 'A map won after trailing by eight or more rounds.' },
};

/** How long the cinematic holds before it hands the match back. A still card for reduced motion holds just as long. */
export const LEGEND_MS = 3200;

/**
 * A legendary moment (#292, #293): the match pauses and a gold card takes the screen. It never changes a result; it only presents a
 * round the simulation already played. Any key, a tap or the button dismisses it. Reduced motion gets the same card without movement.
 */
export function LegendOverlay({ e, mine, map, onDone }: { e: G.MatchEvent; mine: G.Lineup[]; map: string; onDone: () => void }) {
  const kind = e.legend ?? 'ace';
  const who = mine.find((l) => l.player.id === e.playerId);
  const still = reduceMotion();
  // The sparks: fixed positions per card, so the effect is the same each time it plays.
  const sparks = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ x: (i * 47) % 100, d: ((i * 13) % 9) / 10, s: 4 + (i % 4) * 2, t: 2.2 + ((i * 7) % 8) / 10 })), []);
  useEffect(() => {
    const done = setTimeout(onDone, LEGEND_MS);
    const key = (ev: KeyboardEvent) => { ev.preventDefault(); ev.stopPropagation(); onDone(); };
    window.addEventListener('keydown', key, true);
    return () => { clearTimeout(done); window.removeEventListener('keydown', key, true); };
  }, []);
  return (
    <div className={`legend legend--${kind} ${still ? 'is-still' : ''}`} role="status" aria-live="assertive" aria-label={`Legendary moment: ${LEGEND_TITLE[kind].title}. ${e.text}`} onClick={onDone}>
      <div className="legend__wash" aria-hidden="true" />
      <div className="legend__sparks" aria-hidden="true">{sparks.map((p, i) => <i key={i} style={{ left: `${p.x}%`, width: p.s, height: p.s, animationDelay: `${p.d}s`, animationDuration: `${p.t}s` }} />)}</div>
      <div className="legend__sweep" aria-hidden="true" />
      <div className="legend__card">
        <span className="legend__ring" aria-hidden="true" />
        <p className="legend__kicker"><b>Legendary moment</b><span>{map} · Round {e.round}</span></p>
        <div className="legend__body">
          <span className="legend__pic" aria-hidden="true">{who ? <Avatar player={who.player} roster={who.roster} /> : <span className="legend__crest">★</span>}</span>
          <div className="legend__says">
            <strong className="legend__title">{LEGEND_TITLE[kind].title}</strong>
            <span className="legend__tag">{LEGEND_TITLE[kind].tag}</span>
            {who && <span className="legend__who"><TeamBadge roster={who.roster} size={22} /><b>{who.player.nick}</b><i>{who.roster.org} {who.roster.year}</i></span>}
          </div>
        </div>
        <span className="legend__bar" aria-hidden="true"><i style={{ animationDuration: `${LEGEND_MS}ms` }} /></span>
      </div>
      <button type="button" className="legend__skip" onClick={(ev) => { ev.stopPropagation(); onDone(); }}>Continue</button>
    </div>
  );
}
