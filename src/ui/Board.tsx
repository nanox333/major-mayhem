import React, { useEffect, useMemo, useState } from 'react';
import { ROLE_LABEL, ROLE_ORDER, ROLE_SHORT, Roster, Player } from '../data/rosters';
import * as G from '../game/logic';
import { Run } from '../game/state';
import { Avatar, MapArt, OPP_POS, RoleIcon, SLOT_POS, TeamBadge } from './art';
import { reduceMotion } from './util';

// ---------------- board (stays mounted across phases so tokens don't re-animate) ----------------

export function BoardHost({ s, mine }: { s: Run; mine: G.Lineup[] | null }) {
  const oppId = s.phase === 'preview' ? s.pending?.oppId : s.phase === 'live' ? s.current?.opponentId : undefined;
  const opp = useMemo(() => (oppId ? G.naturalLineup(G.rosterById.get(oppId)!) : undefined), [oppId]);
  const [concealed, setConcealed] = useState(true);
  useEffect(() => {
    if (!oppId) return;
    if (s.phase === 'live') { setConcealed(false); return; }
    setConcealed(true);
    const t = setTimeout(() => setConcealed(false), reduceMotion() ? 0 : 1500);
    return () => clearTimeout(t);
  }, [oppId, s.phase]);
  const [pulses, setPulses] = useState<Record<string, 'pos' | 'neg'>>({});
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as { id: string; good: boolean };
      setPulses({ [d.id]: d.good ? 'pos' : 'neg' });
      setTimeout(() => setPulses({}), 600);
    };
    window.addEventListener('mm-pulse', h);
    return () => window.removeEventListener('mm-pulse', h);
  }, []);
  const [map, setMap] = useState<string | null>(null);
  useEffect(() => {
    const h = (e: Event) => setMap((e as CustomEvent).detail as string | null);
    window.addEventListener('mm-map', h);
    return () => window.removeEventListener('mm-map', h);
  }, []);
  return <TacticalBoard picks={s.picks} mine={mine ?? undefined} opp={opp} concealed={concealed} pulses={pulses} playing={s.phase === 'live' ? map : null} />;
}

function MapToken({ l, pulse, opponent }: { l: { player: Player; roster: Roster }; pulse?: 'pos' | 'neg'; opponent?: boolean }) {
  return (
    <div className={`token ${opponent ? 'token--ct' : 'token--t'} ${pulse === 'pos' ? 'token--good' : pulse === 'neg' ? 'token--bad' : ''}`}>
      <div className="token__inner">
        <div className="token__face"><Avatar player={l.player} roster={l.roster} /></div>
        <div className="token__badge"><TeamBadge roster={l.roster} size={opponent ? 16 : 20} /></div>
        <div className="token__label">{l.player.nick}<small>{l.roster.year}</small></div>
      </div>
    </div>
  );
}

function TacticalBoard({ picks, mine, opp, concealed, pulses, playing }: {
  picks: G.Pick[]; mine?: G.Lineup[]; opp?: G.Lineup[]; concealed?: boolean; pulses?: Record<string, 'pos' | 'neg'>; playing?: string | null;
}) {
  const lineup: (G.Lineup | null)[] = mine ?? ROLE_ORDER.map((slot) => {
    const pk = picks.find((p) => p.slot === slot);
    if (!pk) return null;
    const roster = G.rosterById.get(pk.rosterId)!;
    return { slot, roster, player: roster.players.find((p) => p.id === pk.playerId)! };
  });
  return (
    <aside className="board" aria-label="Dust 2 positions">
      <div className="board__map">
        <MapArt />
        {ROLE_ORDER.map((slot, i) => {
          const l = lineup[i];
          const pos = SLOT_POS[slot];
          return (
            <div key={slot} className="board__spot" style={{ left: `${pos.x}%`, top: `${pos.y}%`, zIndex: Math.round(pos.y) }}>
              {l ? <MapToken key={l.player.id} l={l} pulse={pulses?.[l.player.id]} /> : (
                <div className="token token--empty" title={`${ROLE_LABEL[slot]} · ${pos.hint}`}>
                  <div className="token__inner">
                    <div className="token__face"><RoleIcon role={slot} size={18} /></div>
                    <div className="token__label">{ROLE_SHORT[slot]}<small>{pos.hint}</small></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {opp && OPP_POS.map((pos, i) => (
          <div key={`${i}-${concealed ? 'x' : opp[i].player.id}`} className="board__spot" style={{ left: `${pos.x}%`, top: `${pos.y}%`, zIndex: Math.round(pos.y) }}>
            {concealed ? (
              <div className="token token--ct token--mystery" style={{ ['--d' as string]: `${i * 110}ms` }}><div className="token__inner"><div className="token__face">?</div></div></div>
            ) : <MapToken l={opp[i]} opponent />}
          </div>
        ))}
      </div>
      <div className="board__caption"><span>{playing && playing !== 'Dust2' ? `Now on ${playing} · tactics on de_dust2` : 'de_dust2'}</span><span className="t">T · your team</span>{opp && <span className="ct">CT · opponent</span>}</div>
    </aside>
  );
}
