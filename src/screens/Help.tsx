import React, { useEffect } from 'react';
import { ROSTERS, CREDITS } from '../data/rosters';

export function HelpModal({ onClose }: { onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  const events = Array.from(new Map(ROSTERS.map((r) => [r.event, r])).values());
  const players = new Set(ROSTERS.flatMap((r) => r.players.map((p) => p.id))).size;
  const orgs = new Set(ROSTERS.map((r) => r.org)).size;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="How to play" onClick={onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="Close">×</button>
        <h3>How to play</h3>
        <ol>
          <li><b>Open a case</b> to reveal three real rosters from Counter-Strike Major history. The card color shows how that roster finished: gold for champions, red for runner-up, pink for semifinalists, purple for quarterfinalists.</li>
          <li>Pick a team, then draft one player into an open slot: IGL, AWPer, Entry, Lurker or Support/Anchor. Players can cover roles close to their own, and you can't draft the same person twice. You get two rerolls.</li>
          <li>After five rounds, <b>find a match</b>. Win two Bo1 qualification matches, then the Bo3 quarterfinal, semifinal and grand final.</li>
          <li>Try the <b>daily challenge</b>: everyone gets the same cases that day. Copy your result at the end to compare with friends.</li>
        </ol>
        <p>Player strength is hidden, so trust your CS knowledge. After every map you get a scoreboard with kills, deaths and a match rating (1.00 is average). Stronger players tend to post better ratings, but anyone can have a bad map. Results also depend on role fit, a small chemistry bonus for teammates who share a lineup or organization, and luck. When the run ends, the draft review reveals the hidden ratings and shows the best pick you passed up each round. Your run and lifetime stats save in this browser.</p>
        <h3>Data</h3>
        <p>Rosters, event dates and placements come from the “Final standings” tables on English Wikipedia's Major pages, retrieved 28 September 2026. Each roster links to Liquipedia. Roles are assigned for the game and player strength is a hidden game rating, not a real statistic. The Dust 2 radar was supplied by the player.</p>
        <ul className="sources">
          {events.map((r) => (
            <li key={r.event}><span>{r.event}</span> <a href={r.sourceUrl} target="_blank" rel="noreferrer">Wikipedia</a> <a href={r.liquipediaUrl} target="_blank" rel="noreferrer">Liquipedia</a></li>
          ))}
        </ul>
        <h3>Photos and logos</h3>
        <p>Player photos and team logos come mainly from bo3.gg's public player and team pages, with a few freely licensed Wikimedia Commons files filling gaps. Logos are trademarks of their teams and photos belong to their owners; they're used only to identify players and teams in a personal fan project. {CREDITS.photos.length} of {players} players have a photo and {CREDITS.logos.length} of {orgs} teams have a logo.</p>
        <ul className="sources credits">
          {[...CREDITS.logos, ...CREDITS.photos].map((c) => (
            <li key={c.id}><span>{c.file}</span> <span className="muted">{c.source === 'bo3.gg' ? 'bo3.gg' : `${c.author} · ${c.license}`}</span> <a href={c.page} target="_blank" rel="noreferrer">{c.source === 'bo3.gg' ? 'bo3.gg' : 'Commons'}</a></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
