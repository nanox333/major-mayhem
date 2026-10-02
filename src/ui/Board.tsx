import React, { useEffect, useMemo, useState } from 'react';
import { ROLE_LABEL, ROLE_ORDER, ROLE_SHORT, Roster, Player } from '../data/rosters';
import * as G from '../game/logic';
import { Run } from '../game/state';
import { Avatar, MapArt, POSITIONS, RoleIcon, TeamBadge, boardMap, radarSrc } from './art';
import { reduceMotion } from './util';

const sideCls = (side: G.Side) => side === 'T' ? 't' : 'ct';

// ---------------- which spots are on the map ----------------
// The radar pictures are transparent where there is nothing to walk on. A coarse grid of their opaque pixels says whether a marker sits on the map, so a marker that has to
// move aside (two are too close) moves to somewhere that is still on the map, near where it was, instead of onto a fixed grid.
const GRID = 160;
type OnMap = (x: number, y: number) => boolean;
const masks = new Map<string, Promise<OnMap | null>>();
function loadMask(map: string): Promise<OnMap | null> {
  let p = masks.get(map);
  if (!p) {
    p = new Promise<OnMap | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = GRID; c.height = GRID;
          const x = c.getContext('2d'); if (!x) return resolve(null);
          x.drawImage(img, 0, 0, GRID, GRID);
          const a = x.getImageData(0, 0, GRID, GRID).data;
          const solid = (i: number, j: number) => i >= 0 && j >= 0 && i < GRID && j < GRID && a[(j * GRID + i) * 4 + 3] > 128;
          resolve((px, py) => { const i = Math.floor(px / 100 * GRID), j = Math.floor(py / 100 * GRID); return solid(i, j) && solid(i - 1, j) && solid(i + 1, j) && solid(i, j - 1) && solid(i, j + 1); });
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = radarSrc(map);
    });
    masks.set(map, p);
  }
  return p;
}
function useOnMap(map: string): OnMap | null {
  const [fn, setFn] = useState<OnMap | null>(null);
  useEffect(() => { let live = true; setFn(null); loadMask(map).then((f) => { if (live) setFn(() => f); }); return () => { live = false; }; }, [map]);
  return fn;
}

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
  const [side, setSide] = useState<G.Side | null>(null);
  useEffect(() => {
    const h = (e: Event) => setSide((e as CustomEvent).detail as G.Side);
    window.addEventListener('mm-side', h);
    return () => window.removeEventListener('mm-side', h);
  }, []);
  const live = s.phase === 'live';
  // The map being played comes from the match itself, so the radar is right from the first frame (the event only says which map you are looking at in a series).
  const m = s.current;
  const inPlay = m ? (m.next?.map ?? m.maps[m.maps.length - 1]?.map ?? null) : null;
  const startSide = m && !m.next ? (m.maps[m.maps.length - 1]?.start ?? null) : null;
  return <TacticalBoard picks={s.picks} mine={mine ?? undefined} opp={opp} concealed={concealed} pulses={pulses} playing={live ? (map || inPlay) : null} side={live ? (side ?? startSide ?? 'T') : 'T'} compact={live} />;
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

function TacticalBoard({ picks, mine, opp, concealed, pulses, playing, side, compact = false }: {
  picks: G.Pick[]; mine?: G.Lineup[]; opp?: G.Lineup[]; concealed?: boolean; pulses?: Record<string, 'pos' | 'neg'>; playing?: string | null; side: G.Side; compact?: boolean;
}) {
  const lineup: (G.Lineup | null)[] = mine ?? ROLE_ORDER.map((slot) => {
    const pk = picks.find((p) => p.slot === slot);
    if (!pk) return null;
    const roster = G.rosterById.get(pk.rosterId)!;
    return { slot, roster, player: roster.players.find((p) => p.id === pk.playerId)! };
  });
  const [selected, setSelected] = useState<string | null>(null);
  const map = boardMap(playing);
  const { T, CT } = POSITIONS[map];
  // On T each role starts from its usual spot; on CT your five hold the defensive spots, and the opponent attacks.
  const ourPos = (slot: typeof ROLE_ORDER[number], i: number) => (side === 'T' ? T[slot] : CT[i]);
  const theirPos = (l: G.Lineup, i: number) => (side === 'T' ? CT[i] : T[l.slot]);
  const theirSide = G.otherSide(side);
  const markers = [
    ...lineup.flatMap((l, i) => l ? [{ l, code: `Y${i + 1}`, side, pos: ourPos(l.slot, i), team: 'Your team' }] : []),
    ...(opp ?? []).map((l, i) => ({ l, code: `O${i + 1}`, side: theirSide, pos: theirPos(l, i), team: 'Opponent' })),
  ];
  // Static illustrative spots are separated for touch access, never presented as positional telemetry. A marker stays at its own spot unless another is on top of it; then it
  // steps aside to the nearest free spot that is still on the map.
  const onMap = useOnMap(map);
  const MIN = 12;
  const clamp = (v: number) => Math.max(7, Math.min(93, v));
  const placed: { x: number; y: number }[] = [];
  const spots = markers.map(({ pos }) => {
    const free = (q: { x: number; y: number }) => placed.every((p) => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) >= MIN);
    const usable = (q: { x: number; y: number }) => free(q) && (!onMap || onMap(q.x, q.y));
    let point = { x: clamp(pos.x), y: clamp(pos.y) };
    if (!usable(point)) {
      search: for (const r of [4, 8, 12, 16, 20, 25, 30]) {
        for (let k = 0; k < 16; k++) {
          const ang = (k * 22.5 + (placed.length * 7)) * Math.PI / 180;
          const q = { x: clamp(point.x + Math.cos(ang) * r), y: clamp(point.y + Math.sin(ang) * r) };
          if (usable(q)) { point = q; break search; }
        }
      }
    }
    placed.push(point);
    return point;
  });
  const active = markers.find(x => x.code === selected);
  if (compact) return <aside className="board board--broadcast" aria-label={`${map} illustrative radar`}>
    <div className="board__map"><MapArt map={map} />{markers.map((x, i) => <button key={x.code}
      className={`radar-marker radar-marker--${sideCls(x.side)} ${selected === x.code ? 'is-selected' : ''} ${pulses?.[x.l.player.id] ? `radar-marker--${pulses[x.l.player.id]}` : ''}`}
      style={{ left: `${spots[i].x}%`, top: `${spots[i].y}%` }} aria-pressed={selected === x.code}
      aria-label={`${x.code}: ${x.team}, ${x.l.player.nick}, ${ROLE_LABEL[x.l.slot]}, ${x.side}, illustrative ${x.pos.hint}`}
      onClick={() => setSelected(x.code)}><span><Avatar player={x.l.player} roster={x.l.roster} /></span></button>)}</div>
    <p className="radar-disclosure">Illustrative positions · not a live tactical simulation{playing && playing !== map ? ` · ${playing} shown on Dust2` : ''}</p>
    <div className="radar-detail" role="status">{active ? <><b>{active.l.player.nick}</b><span>{active.team} · {active.side} · {ROLE_LABEL[active.l.slot]} · {active.pos.hint}</span></> : <span>Select a marker for player and role.</span>}</div>
    <details className="radar-lineups"><summary>Both fielded fives</summary><div>{markers.map(x => <div key={x.code}><b className={sideCls(x.side)}>{x.side}</b><span>{x.l.player.nick}<small>{x.team} · {ROLE_SHORT[x.l.slot]} · {x.l.roster.org} {x.l.roster.year}</small></span></div>)}</div></details>
  </aside>;
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
