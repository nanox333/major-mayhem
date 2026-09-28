import React, { useEffect, useMemo, useState } from 'react';
import { ROLE_LABEL, ROLE_ORDER, ROLE_SHORT, Roster, Player } from '../data/rosters';
import * as G from '../game/logic';
import { Run } from '../game/state';
import { Avatar, MapArt, POSITIONS, RoleIcon, TeamBadge, boardMap } from './art';
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
  const [side, setSide] = useState<G.Side>('T');
  useEffect(() => {
    const h = (e: Event) => setSide((e as CustomEvent).detail as G.Side);
    window.addEventListener('mm-side', h);
    return () => window.removeEventListener('mm-side', h);
  }, []);
  const live = s.phase === 'live';
  return <TacticalBoard picks={s.picks} mine={mine ?? undefined} opp={opp} concealed={concealed} pulses={pulses} playing={live ? map : null} side={live ? side : 'T'} />;
}

function MapToken({ l, side, pulse, opponent }: { l: { player: Player; roster: Roster }; side: G.Side; pulse?: 'pos' | 'neg'; opponent?: boolean }) {
  return (
    <div className={`token token--${side === 'T' ? 't' : 'ct'} ${opponent ? 'token--opp' : ''} ${pulse === 'pos' ? 'token--good' : pulse === 'neg' ? 'token--bad' : ''}`}>
      <div className="token__inner">
        <div className="token__face"><Avatar player={l.player} roster={l.roster} /></div>
        <div className="token__badge"><TeamBadge roster={l.roster} size={opponent ? 16 : 20} /></div>
        <div className="token__label">{l.player.nick}<small>{l.roster.year}</small></div>
      </div>
    </div>
  );
}

function TacticalBoard({ picks, mine, opp, concealed, pulses, playing, side }: {
  picks: G.Pick[]; mine?: G.Lineup[]; opp?: G.Lineup[]; concealed?: boolean; pulses?: Record<string, 'pos' | 'neg'>; playing?: string | null; side: G.Side;
}) {
  const lineup: (G.Lineup | null)[] = mine ?? ROLE_ORDER.map((slot) => {
    const pk = picks.find((p) => p.slot === slot);
    if (!pk) return null;
    const roster = G.rosterById.get(pk.rosterId)!;
    return { slot, roster, player: roster.players.find((p) => p.id === pk.playerId)! };
  });
  const map = boardMap(playing);
  const { T, CT } = POSITIONS[map];
  // On T each role starts from its usual spot; on CT your five hold the defensive spots, and the opponent attacks.
  const ourPos = (slot: typeof ROLE_ORDER[number], i: number) => (side === 'T' ? T[slot] : CT[i]);
  const theirPos = (l: G.Lineup, i: number) => (side === 'T' ? CT[i] : T[l.slot]);
  const theirSide = G.otherSide(side);
  return (
    <aside className="board" aria-label={`${map} positions`}>
      <div className="board__map">
        <MapArt map={map} />
        {ROLE_ORDER.map((slot, i) => {
          const l = lineup[i];
          const pos = ourPos(slot, i);
          return (
            <div key={slot} className="board__spot" style={{ left: `${pos.x}%`, top: `${pos.y}%`, zIndex: Math.round(pos.y) }}>
              {l ? <MapToken key={l.player.id} l={l} side={side} pulse={pulses?.[l.player.id]} /> : (
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
        {opp && opp.map((l, i) => {
          const pos = theirPos(l, i);
          return (
            <div key={`${i}-${concealed ? 'x' : l.player.id}`} className="board__spot" style={{ left: `${pos.x}%`, top: `${pos.y}%`, zIndex: Math.round(pos.y) }}>
              {concealed ? (
                <div className="token token--ct token--opp token--mystery" style={{ ['--d' as string]: `${i * 110}ms` }}><div className="token__inner"><div className="token__face">?</div></div></div>
              ) : <MapToken l={l} side={theirSide} opponent />}
            </div>
          );
        })}
      </div>
      <div className="board__caption"><span>{playing && playing !== map ? `${playing} · shown on de_dust2` : `de_${map.toLowerCase()}`}</span><span className={side === 'T' ? 't' : 'ct'}>{side} · your team</span>{opp && <span className={theirSide === 'T' ? 't' : 'ct'}>{theirSide} · opponent</span>}</div>
    </aside>
  );
}
