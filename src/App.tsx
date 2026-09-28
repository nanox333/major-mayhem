import React, { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ROLE_LABEL, ROLE_ORDER, ROLE_SHORT, Role, Roster, Player, ROSTERS, CREDITS, playerLiquipedia } from './data/rosters';
import * as G from './game/logic';
import { Avatar, MapArt, OPP_POS, RoleIcon, SLOT_POS, TeamBadge } from './ui/art';

// ---------------- state ----------------

type Phase = 'draft' | 'ready' | 'preview' | 'live' | 'final';
interface Pending { stage: G.StageKey; oppId: string }
interface Run {
  v: 2;
  phase: Phase;
  step: 'spin' | 'teams' | 'players';
  offer: string[];
  offerKey: number;
  rerollKey: number;
  seen: string[];
  team: string | null;
  picks: G.Pick[];
  rerolls: number;
  t: G.Tournament;
  pending: Pending | null;
  current: G.Match | null;
}

const KEY = 'major-mayhem-run-v2';
const fresh = (): Run => ({ v: 2, phase: 'draft', step: 'spin', offer: [], offerKey: 0, rerollKey: 0, seen: [], team: null, picks: [], rerolls: 2, t: G.newTournament(), pending: null, current: null });

function load(): Run {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const r = JSON.parse(raw) as Run;
    const ok = r.v === 2 && r.picks.every((p) => G.rosterById.has(p.rosterId)) && r.offer.every((id) => G.rosterById.has(id));
    return ok ? r : fresh();
  } catch { return fresh(); }
}
const save = (r: Run) => { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* storage unavailable: play on */ } };

type Action =
  | { type: 'spin' } | { type: 'reroll' } | { type: 'team'; id: string } | { type: 'back' }
  | { type: 'draft'; player: Player; slot: Role } | { type: 'play' } | { type: 'start' }
  | { type: 'next' } | { type: 'reset' };

function reducer(s: Run, a: Action): Run {
  switch (a.type) {
    case 'spin': {
      const offer = G.makeOffer(s.picks, s.seen);
      return { ...s, step: 'teams', offer, seen: [...s.seen, ...offer], offerKey: s.offerKey + 1, team: null };
    }
    case 'reroll': {
      if (s.rerolls <= 0 || s.step !== 'teams') return s;
      const offer = G.makeOffer(s.picks, s.seen);
      return { ...s, offer, seen: [...s.seen, ...offer], rerolls: s.rerolls - 1, rerollKey: s.rerollKey + 1 };
    }
    case 'team': return { ...s, step: 'players', team: a.id };
    case 'back': return { ...s, step: 'teams', team: null };
    case 'draft': {
      if (!s.team || !G.eligibleSlots(a.player, s.picks).includes(a.slot)) return s;
      const picks = [...s.picks, { slot: a.slot, rosterId: s.team, playerId: a.player.id }];
      return { ...s, picks, team: null, offer: [], step: 'spin', phase: picks.length === 5 ? 'ready' : 'draft' };
    }
    case 'play': {
      const mine = G.lineupFromPicks(s.picks);
      const stage = G.nextStage(s.t)!;
      return { ...s, phase: 'preview', pending: { stage, oppId: G.pickOpponent(s.t, stage, mine) } };
    }
    case 'start': {
      if (!s.pending) return s;
      const mine = G.lineupFromPicks(s.picks);
      const m = G.playMatch(s.pending.stage, mine, s.pending.oppId, G.STAGE_BOOST[s.pending.stage]);
      return { ...s, phase: 'live', current: m };
    }
    case 'next': {
      if (!s.current) return s;
      const t = G.applyResult(s.t, s.current);
      const stage = G.nextStage(t);
      if (!stage) return { ...s, t, current: null, pending: null, phase: 'final' };
      const mine = G.lineupFromPicks(s.picks);
      return { ...s, t, current: null, phase: 'preview', pending: { stage, oppId: G.pickOpponent(t, stage, mine) } };
    }
    case 'reset': return fresh();
  }
}

const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const fmt = (r: number) => r.toFixed(2);
const RARITY: Record<string, string> = { Champions: 'gold', 'Runner-up': 'covert', Semifinalist: 'classified', Quarterfinalist: 'restricted' };
const rarity = (r: Roster) => RARITY[r.result] ?? 'milspec';

// ---------------- app ----------------

export default function App() {
  const [s, dispatch] = useReducer(reducer, undefined, load);
  const [help, setHelp] = useState(false);
  const [reelFor, setReelFor] = useState<number | null>(null);
  useEffect(() => save(s), [s]);

  const mine = useMemo(() => (s.picks.length === 5 ? G.lineupFromPicks(s.picks) : null), [s.picks]);
  const round = Math.min(5, s.picks.length + 1);
  const stageNow = (s.pending ?? s.current)?.stage;

  const steps: { k: Phase[]; label: string }[] = [
    { k: ['draft'], label: 'Draft' }, { k: ['ready'], label: 'Lobby' }, { k: ['preview', 'live'], label: 'Major' }, { k: ['final'], label: 'Results' },
  ];
  const stepIdx = steps.findIndex((x) => x.k.includes(s.phase));

  let title = s.step === 'players' ? 'Choose your player' : s.step === 'teams' ? 'Pick a team' : 'Open a case';
  let kicker = `Draft · Round ${round} of 5`;
  if (s.phase === 'ready') { title = 'Ready to rumble'; kicker = 'Lobby · 5 of 5 drafted'; }
  if (s.phase === 'preview' || s.phase === 'live') { title = G.STAGE_NAME[stageNow!]; kicker = `Major · Best of ${G.BEST_OF[stageNow!]}`; }
  if (s.phase === 'final') { title = 'Tournament over'; kicker = 'Results'; }

  const showBoard = s.phase !== 'final';

  return (
    <div className="page">
      <header className="masthead">
        <button className="hud-btn" onClick={() => setHelp(true)} aria-label="How to play and data sources">?</button>
        <div className="brand">
          <h1 className="logo">Major Mayhem</h1>
          <p className="tagline">Draft a five-man dream team from Counter-Strike Major history, then win the Major.</p>
        </div>
        <NewRunButton onConfirm={() => { setReelFor(null); dispatch({ type: 'reset' }); }} />
      </header>

      <nav className="stepper" aria-label="Progress">
        {steps.map((x, i) => (
          <span key={x.label} className={`stepper__item ${i === stepIdx ? 'is-on' : ''} ${i < stepIdx ? 'is-done' : ''}`}>{x.label}</span>
        ))}
      </nav>

      <main className="console">
        <div className="console__head">
          {s.phase === 'draft' && s.step === 'players' && (
            <button className="back-btn" onClick={() => dispatch({ type: 'back' })} aria-label="Back to teams">‹ Teams</button>
          )}
          <div className="console__titles">
            <span className="kicker">{kicker}</span>
            <h2 className="console__title">{title}</h2>
          </div>
          {s.phase === 'draft' && <DraftPips picks={s.picks} />}
        </div>

        <div className={`console__body ${showBoard ? 'has-board' : ''} phase-${s.phase}`}>
          <section className="console__main">
            {s.phase === 'draft' && <DraftScreen s={s} dispatch={dispatch} reelFor={reelFor} setReelFor={setReelFor} />}
            {s.phase === 'ready' && mine && <ReadyScreen mine={mine} dispatch={dispatch} />}
            {s.phase === 'preview' && mine && s.pending && <PreviewScreen mine={mine} pending={s.pending} t={s.t} dispatch={dispatch} />}
            {s.phase === 'live' && mine && s.current && <LiveScreen key={s.t.matches.length} mine={mine} m={s.current} t={s.t} dispatch={dispatch} />}
            {s.phase === 'final' && mine && <FinalScreen mine={mine} s={s} dispatch={dispatch} />}
          </section>
          {showBoard && <BoardHost s={s} mine={mine} />}
        </div>
      </main>

      <footer className="foot">
        Rosters and placements from Wikipedia's Major final standings (retrieved 28 Sep 2026); every roster links to Liquipedia. Photos and logos from bo3.gg and Wikimedia Commons, credited under “?”. Logos are trademarks of their teams.
        Player strength is hidden; match ratings are simulated. Fan project, not affiliated with Valve or any team.
      </footer>

      {help && <HelpModal onClose={() => setHelp(false)} />}
    </div>
  );
}

function DraftPips({ picks }: { picks: G.Pick[] }) {
  return (
    <div className="pips" aria-label={`${picks.length} of 5 slots filled`}>
      {ROLE_ORDER.map((r) => (
        <span key={r} className={`pip ${picks.some((p) => p.slot === r) ? 'is-full' : ''}`} title={ROLE_LABEL[r]}><RoleIcon role={r} size={13} /></span>
      ))}
    </div>
  );
}

function NewRunButton({ onConfirm }: { onConfirm: () => void }) {
  const [ask, setAsk] = useState(false);
  useEffect(() => { if (!ask) return; const t = setTimeout(() => setAsk(false), 3000); return () => clearTimeout(t); }, [ask]);
  return ask ? (
    <button className="hud-btn hud-btn--wide" onClick={() => { setAsk(false); onConfirm(); }}>New run?</button>
  ) : (
    <button className="hud-btn" onClick={() => setAsk(true)} aria-label="Start a new run">↺</button>
  );
}

// ---------------- board (stays mounted across phases so tokens don't re-animate) ----------------

function BoardHost({ s, mine }: { s: Run; mine: G.Lineup[] | null }) {
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
  return <TacticalBoard picks={s.picks} mine={mine ?? undefined} opp={opp} concealed={concealed} pulses={pulses} />;
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

function TacticalBoard({ picks, mine, opp, concealed, pulses }: {
  picks: G.Pick[]; mine?: G.Lineup[]; opp?: G.Lineup[]; concealed?: boolean; pulses?: Record<string, 'pos' | 'neg'>;
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
      <div className="board__caption"><span>de_dust2</span><span className="t">T · your team</span>{opp && <span className="ct">CT · opponent</span>}</div>
    </aside>
  );
}

// ---------------- draft ----------------

function DraftScreen({ s, dispatch, reelFor, setReelFor }: { s: Run; dispatch: React.Dispatch<Action>; reelFor: number | null; setReelFor: (n: number | null) => void }) {
  if (s.step === 'spin') {
    const open = G.openSlots(s.picks);
    return (
      <div className="spin-stage anim-in" key={`spin-${s.picks.length}`}>
        <div className="case-art" aria-hidden="true"><span /></div>
        <p className="spin-stage__hint">
          {s.picks.length === 0 ? 'Each case holds three real rosters from a Major. Pick a team, then one player from it.' : `Still to fill: ${open.map((r) => ROLE_LABEL[r]).join(', ')}.`}
        </p>
        <button className="cta cta--orange" onClick={() => { setReelFor(s.offerKey + 1); dispatch({ type: 'spin' }); }}>Open case</button>
      </div>
    );
  }
  if (s.step === 'teams') {
    if (reelFor === s.offerKey && !reduceMotion()) return <CaseReel land={s.offer[0]} onDone={() => setReelFor(null)} />;
    return <TeamChoices s={s} dispatch={dispatch} />;
  }
  return s.team ? <PlayerChoices roster={G.rosterById.get(s.team)!} picks={s.picks} dispatch={dispatch} /> : null;
}

/** CS-style case roulette: a strip of teams slides past a marker and stops on the first team in the offer. */
function CaseReel({ land, onDone }: { land: string; onDone: () => void }) {
  const STEP = 112, LAND = 32;
  const items = useMemo(() => {
    const pool = G.shuffle(ROSTERS);
    const arr = Array.from({ length: LAND + 5 }, (_, i) => pool[i % pool.length]);
    arr[LAND] = G.rosterById.get(land)!;
    return arr;
  }, [land]);
  const box = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const w = box.current?.clientWidth ?? 600;
    const target = LAND * STEP + STEP / 2 - w / 2 + (Math.random() - 0.5) * (STEP * 0.6);
    const el = strip.current!;
    el.style.transform = 'translateX(0)';
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'transform 2.4s cubic-bezier(.08,.75,.16,1)';
      el.style.transform = `translateX(${-target}px)`;
    }));
    const t = setTimeout(onDone, 2900);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [items]);
  return (
    <div className="reel anim-in" ref={box} aria-label="Opening case">
      <div className="reel__strip" ref={strip}>
        {items.map((r, i) => (
          <div key={i} className={`reel__item rar-${rarity(r)}`}>
            <TeamBadge roster={r} size={44} />
            <strong>{r.tag}</strong>
            <small>{r.year}</small>
          </div>
        ))}
      </div>
      <div className="reel__marker" />
    </div>
  );
}

function TeamChoices({ s, dispatch }: { s: Run; dispatch: React.Dispatch<Action> }) {
  const [out, setOut] = useState(false);
  const reroll = () => {
    if (reduceMotion()) return dispatch({ type: 'reroll' });
    setOut(true);
    setTimeout(() => { dispatch({ type: 'reroll' }); setOut(false); }, 160);
  };
  return (
    <div className={`teams-col ${out ? 'is-out' : ''}`}>
      {s.offer.map((id, i) => {
        const r = G.rosterById.get(id)!;
        return (
          <button key={`${id}-${s.rerollKey}`} className={`case-item rar-${rarity(r)} anim-in`} style={{ animationDelay: `${i * 70}ms` }} onClick={() => dispatch({ type: 'team', id })}>
            <div className="case-item__top">
              <TeamBadge roster={r} size={44} />
              <div className="case-item__id">
                <div className="case-item__name">{r.org}</div>
                <div className="case-item__meta"><span>{r.year}</span><span className="grade">{r.result}</span></div>
              </div>
            </div>
            <ul className="case-item__roster">
              {r.players.map((p) => {
                const ok = G.eligibleSlots(p, s.picks).length > 0;
                return <li key={p.id} className={ok ? '' : 'is-off'}><RoleIcon role={p.roles[0]} size={11} />{p.nick}</li>;
              })}
            </ul>
            <div className="case-item__event">{r.event}</div>
          </button>
        );
      })}
      <div className="reroll-row anim-in" style={{ animationDelay: '220ms' }}>
        <button className="ghost-btn" onClick={reroll} disabled={s.rerolls <= 0}>⟳ Reroll case <b>{s.rerolls}</b></button>
      </div>
    </div>
  );
}

function PlayerChoices({ roster, picks, dispatch }: { roster: Roster; picks: G.Pick[]; dispatch: React.Dispatch<Action> }) {
  const players = roster.players.filter((p) => G.eligibleSlots(p, picks).length > 0);
  const taken = roster.players.filter((p) => G.eligibleSlots(p, picks).length === 0);
  return (
    <div className="players-col">
      <div className={`team-heading rar-${rarity(roster)}`}>
        <TeamBadge roster={roster} size={40} />
        <div>
          <div className="team-heading__name">{roster.org} <span>{roster.year}</span></div>
          <div className="team-heading__event">{roster.result} · {roster.event}</div>
          <div className="src-links">
            <a href={roster.liquipediaUrl} target="_blank" rel="noreferrer">Liquipedia</a>
            <a href={roster.sourceUrl} target="_blank" rel="noreferrer">Source: Wikipedia</a>
          </div>
        </div>
      </div>
      <div className="players-grid">
        {players.map((p, i) => {
          const slots = G.eligibleSlots(p, picks);
          return (
            <div className="agent anim-in" style={{ animationDelay: `${i * 55}ms` }} key={p.id} role="group" aria-label={p.nick}>
              <div className="agent__photo">
                <Avatar player={p} roster={roster} className="agent__img" />
                <span className="agent__main" title="Main role"><RoleIcon role={p.roles[0]} size={12} /> {ROLE_SHORT[p.roles[0]]}</span>
              </div>
              <div className="agent__body">
                <a className="agent__name" href={playerLiquipedia(p.nick)} target="_blank" rel="noreferrer" title={`${p.nick} on Liquipedia`}>{p.nick}</a>
                <div className="agent__slots">
                  {slots.map((slot) => (
                    <button key={slot} className={`slot-chip ${p.roles[0] === slot ? 'slot-chip--main' : ''}`} onClick={() => dispatch({ type: 'draft', player: p, slot })}>
                      <RoleIcon role={slot} size={12} /> {ROLE_SHORT[slot]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {taken.length > 0 && <p className="muted small">Unavailable: {taken.map((p) => p.nick).join(', ')} (already drafted or no open slot).</p>}
    </div>
  );
}

// ---------------- lobby ----------------

function RosterList({ mine, stats, mvpId }: { mine: G.Lineup[]; stats?: Record<string, { k: number; d: number; rating: number }>; mvpId?: string }) {
  return (
    <ul className="lobby">
      {mine.map((l, i) => {
        const main = l.player.roles[0] === l.slot;
        const st = stats?.[l.player.id];
        return (
          <li key={l.player.id} className={`lobby__row anim-in ${mvpId === l.player.id ? 'is-mvp' : ''}`} style={{ animationDelay: `${i * 55}ms` }}>
            <span className="lobby__avatar"><Avatar player={l.player} roster={l.roster} /></span>
            <span className="lobby__who">
              <strong>{l.player.nick}{mvpId === l.player.id && <em className="mvp-tag">★ MVP</em>}</strong>
              <small><TeamBadge roster={l.roster} size={14} /> {l.roster.org} {l.roster.year}</small>
            </span>
            <span className="lobby__slot" title={main ? 'Main role' : 'Playing an off-role (small penalty)'}>
              <RoleIcon role={l.slot} size={14} /> {ROLE_LABEL[l.slot]}{!main && <i className="offrole">off-role</i>}
            </span>
            {st && <span className="lobby__stat"><small>{st.k}–{st.d}</small><b className={st.rating >= 1.1 ? 'hi' : st.rating < 0.9 ? 'lo' : ''}>{fmt(st.rating)}</b></span>}
          </li>
        );
      })}
    </ul>
  );
}

function ReadyScreen({ mine, dispatch }: { mine: G.Lineup[]; dispatch: React.Dispatch<Action> }) {
  const orgs = new Set(mine.map((x) => x.roster.org));
  const offRoles = mine.filter((x) => x.player.roles[0] !== x.slot).length;
  return (
    <div className="stack">
      <RosterList mine={mine} />
      <div className="notes">
        <span>{offRoles === 0 ? 'Everyone on their main role' : `${offRoles} player${offRoles > 1 ? 's' : ''} off their main role`}</span>
        <span>{orgs.size < 5 ? 'Shared history: small chemistry bonus' : 'Five different organizations'}</span>
      </div>
      <p className="muted small">Qualification: two Bo1 wins to reach the playoffs, two losses and you're out. Quarterfinal, semifinal and grand final are best of three.</p>
      <button className="cta cta--go" onClick={() => dispatch({ type: 'play' })}>Find match</button>
    </div>
  );
}

// ---------------- match ----------------

function StageTrack({ t, current }: { t: G.Tournament; current?: G.StageKey }) {
  const q = t.qual;
  const playoffs = t.matches.filter((m) => m.stage !== 'QUAL');
  const nodes: { k: G.StageKey; label: string }[] = [{ k: 'QUAL', label: 'Qual' }, { k: 'QF', label: 'Quarter' }, { k: 'SF', label: 'Semi' }, { k: 'F', label: 'Final' }];
  return (
    <div className="track">
      {nodes.map((n) => {
        const done = n.k === 'QUAL' ? q.w >= 2 : playoffs.some((m) => m.stage === n.k && m.won);
        const lost = n.k === 'QUAL' ? q.l >= 2 : playoffs.some((m) => m.stage === n.k && !m.won);
        return (
          <div key={n.k} className={`track__node ${done ? 'is-done' : ''} ${lost ? 'is-lost' : ''} ${current === n.k ? 'is-current' : ''}`}>
            <i>{done ? '✓' : lost ? '✗' : n.k === 'QUAL' ? `${q.w}-${q.l}` : `Bo${G.BEST_OF[n.k]}`}</i>
            <span>{n.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function PreviewScreen({ mine, pending, t, dispatch }: { mine: G.Lineup[]; pending: Pending; t: G.Tournament; dispatch: React.Dispatch<Action> }) {
  const opp = G.rosterById.get(pending.oppId)!;
  const oppL = useMemo(() => G.naturalLineup(opp), [opp]);
  const [found, setFound] = useState(false);
  useEffect(() => { setFound(false); const tm = setTimeout(() => setFound(true), reduceMotion() ? 0 : 1500); return () => clearTimeout(tm); }, [pending.oppId]);
  return (
    <div className="stack">
      <StageTrack t={t} current={pending.stage} />
      {!found ? (
        <div className="searching anim-in">
          <span className="searching__ring" />
          <strong>Searching for opponent</strong>
          <small>{G.STAGE_NAME[pending.stage]} · Best of {G.BEST_OF[pending.stage]}</small>
        </div>
      ) : (
        <div className="match-found anim-in">
          <div className="match-found__title">Your match is ready!</div>
          <div className="versus">
            <div className="versus__side versus__side--t">
              <small>T · Your team</small>
              <ul>{mine.map((l) => <li key={l.player.id}><RoleIcon role={l.slot} size={12} />{l.player.nick}</li>)}</ul>
            </div>
            <div className="versus__vs">VS</div>
            <div className="versus__side versus__side--ct">
              <small>CT · Opponent</small>
              <div className="versus__team"><TeamBadge roster={opp} size={28} /><span><b>{opp.org}</b> {opp.year}</span></div>
              <div className="versus__sub">{opp.result} at {opp.event}</div>
              <ul>{oppL.map((l) => <li key={l.player.id}><RoleIcon role={l.slot} size={12} />{l.player.nick}</li>)}</ul>
            </div>
          </div>
          <div className="accept-bar"><span /></div>
          <button className="cta cta--go" onClick={() => dispatch({ type: 'start' })}>Accept</button>
        </div>
      )}
    </div>
  );
}

function Scoreboard({ game, opp, mine }: { game: G.MapGame; opp: Roster; mine: G.Lineup[] }) {
  const rows = (list: G.PlayerStat[]) => [...list].sort((a, b) => b.rating - a.rating);
  const teamOf = (id: string) => mine.find((x) => x.player.id === id)?.roster;
  return (
    <div className="sb anim-in">
      <div className="sb__head"><span>{game.map}</span><b className={game.won ? 'w' : 'l'}>{game.score[0]}–{game.score[1]}</b></div>
      <table>
        <thead><tr><th>Your team</th><th>K</th><th>D</th><th>Rating</th></tr></thead>
        <tbody>{rows(game.stats.mine).map((p) => (
          <tr key={p.id}><td><span className="sb__tag">{teamOf(p.id)?.tag}</span>{p.nick}</td><td>{p.k}</td><td>{p.d}</td><td className={p.rating >= 1.1 ? 'hi' : p.rating < 0.9 ? 'lo' : ''}>{fmt(p.rating)}</td></tr>
        ))}</tbody>
        <thead><tr className="ct"><th>{opp.org} {opp.year}</th><th>K</th><th>D</th><th>Rating</th></tr></thead>
        <tbody>{rows(game.stats.opp).map((p) => (
          <tr key={p.id} className="ct"><td>{p.nick}</td><td>{p.k}</td><td>{p.d}</td><td className={p.rating >= 1.1 ? 'hi' : p.rating < 0.9 ? 'lo' : ''}>{fmt(p.rating)}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function LiveScreen({ mine, m, t, dispatch }: { mine: G.Lineup[]; m: G.Match; t: G.Tournament; dispatch: React.Dispatch<Action> }) {
  const opp = G.rosterById.get(m.opponentId)!;
  const [mapIdx, setMapIdx] = useState(0);
  const [n, setN] = useState(0);
  const game = m.maps[mapIdx];
  const total = game.rounds.length;
  const mapDone = n >= total;
  const seriesDone = mapDone && mapIdx === m.maps.length - 1;

  useEffect(() => {
    if (mapDone) return;
    const tm = setTimeout(() => setN((x) => x + 1), n === 0 ? 650 : reduceMotion() ? 40 : 230);
    return () => clearTimeout(tm);
  }, [n, mapDone, mapIdx]);

  // pulse the map token of whoever made the highlight this round
  const shown = game.events.filter((e) => e.round <= n);
  useEffect(() => {
    const e = game.events.find((x) => x.round === n);
    if (e?.playerId) window.dispatchEvent(new CustomEvent('mm-pulse', { detail: { id: e.playerId, good: e.good } }));
  }, [n, mapIdx]);

  const a = game.rounds.slice(0, n).filter(Boolean).length;
  const b = n - a;
  const mapsWon = m.maps.slice(0, mapIdx + (mapDone ? 1 : 0)).filter((g) => g.won).length;
  const mapsLost = mapIdx + (mapDone ? 1 : 0) - mapsWon;
  const next = G.nextStage(G.applyResult(t, m));
  const series = G.seriesRatings(m.maps);

  return (
    <div className="stack">
      <div className="hud">
        <div className="hud__meta">{G.STAGE_NAME[m.stage]} · Bo{m.bestOf}{m.bestOf === 3 ? ` · Map ${mapIdx + 1}` : ''} · {game.map}{total > 24 && mapDone ? ' · OT' : ''}</div>
        <div className="hud__score">
          <div className="hud__team hud__team--t"><span>Your team</span>{m.bestOf === 3 && <em>{mapsWon}</em>}</div>
          <div className="hud__nums">
            <b key={`a${a}`} className={`t ${a ? 'pop' : ''}`}>{a}</b>
            <i>:</i>
            <b key={`b${b}`} className={`ct ${b ? 'pop' : ''}`}>{b}</b>
          </div>
          <div className="hud__team hud__team--ct">{m.bestOf === 3 && <em>{mapsLost}</em>}<TeamBadge roster={opp} size={20} /><span>{opp.org} {opp.year}</span></div>
        </div>
        <div className="rounds" aria-hidden="true">
          {Array.from({ length: Math.max(24, total) }, (_, i) => <i key={i} className={i < n ? (game.rounds[i] ? 'w' : 'l') : ''} />)}
        </div>
        {m.bestOf === 3 && (
          <div className="maps">
            {[0, 1, 2].map((i) => {
              const g = m.maps[i];
              const played = g && (i < mapIdx || (i === mapIdx && mapDone));
              return (
                <span key={i} className={`maps__pill ${i === mapIdx ? 'is-now' : ''} ${played ? (g.won ? 'w' : 'l') : ''}`}>
                  {g ? g.map : 'Decider'}{played ? ` ${g.score[0]}–${g.score[1]}` : ''}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {!mapDone ? (
        <>
          <div className="killfeed">
            {shown.slice(-3).reverse().map((e) => (
              <div key={`${mapIdx}-${e.round}-${e.text}`} className={`kf ${e.good ? 'kf--t' : 'kf--ct'}`}><small>R{e.round}</small>{e.text}</div>
            ))}
            {shown.length === 0 && <div className="kf kf--idle"><small>Pistol</small>Both teams buy and head out.</div>}
          </div>
          <button className="ghost-btn" onClick={() => setN(total)}>Skip to end of map</button>
        </>
      ) : (
        <>
          {seriesDone && (
            <div className={`result-stamp ${m.won ? 'w' : 'l'}`}>{m.won ? 'Victory' : 'Defeat'} {m.score[0]}–{m.score[1]}</div>
          )}
          <Scoreboard game={game} opp={opp} mine={mine} />
          {seriesDone && m.bestOf === 3 && (
            <p className="muted small">Series ratings: {mine.map((x) => `${x.player.nick} ${fmt(series[x.player.id].rating)}`).join(' · ')}</p>
          )}
          {seriesDone ? (
            <button className="cta cta--orange" onClick={() => dispatch({ type: 'next' })}>{next ? 'Next match' : 'See results'}</button>
          ) : (
            <button className="cta cta--orange" onClick={() => { setMapIdx((i) => i + 1); setN(0); }}>Next map</button>
          )}
        </>
      )}
    </div>
  );
}

// ---------------- final ----------------

function FinalScreen({ mine, s, dispatch }: { mine: G.Lineup[]; s: Run; dispatch: React.Dispatch<Action> }) {
  const pl = G.placement(s.t);
  const star = G.mvp(s.t, mine);
  const champ = pl.key === 'CHAMP';
  const stats = G.seriesRatings(s.t.matches.flatMap((m) => m.maps));
  return (
    <div className="final">
      <div className={`final__banner ${champ ? 'is-champ' : ''}`}>
        <small>Your Major Mayhem team finished</small>
        <h3>{champ ? 'Major champions' : pl.label}</h3>
      </div>
      <StageTrack t={s.t} />
      <div className="mvp-card anim-in">
        <span className="mvp-card__photo"><Avatar player={star.player} roster={star.roster} /></span>
        <div>
          <small>★ Tournament MVP</small>
          <strong>{star.player.nick}</strong>
          <span>{ROLE_LABEL[star.slot]} · {star.roster.org} {star.roster.year}</span>
        </div>
        <div className="mvp-card__rating"><b>{fmt(stats[star.player.id].rating)}</b><small>Event rating</small></div>
      </div>
      <RosterList mine={mine} stats={stats} mvpId={star.player.id} />
      <ul className="history">
        {s.t.matches.map((m, i) => {
          const o = G.rosterById.get(m.opponentId)!;
          return (
            <li key={i} className={m.won ? 'w' : 'l'}>
              <span>{m.stage === 'QUAL' ? 'Qual' : m.stage}</span>
              <span className="history__opp">{o.org} {o.year}</span>
              <span className="history__maps">{m.maps.map((g) => `${g.map} ${g.score[0]}–${g.score[1]}`).join(', ')}</span>
              <b>{m.score[0]}–{m.score[1]}</b>
            </li>
          );
        })}
      </ul>
      <button className="cta cta--orange" onClick={() => dispatch({ type: 'reset' })}>Play again</button>
    </div>
  );
}

// ---------------- help ----------------

function HelpModal({ onClose }: { onClose: () => void }) {
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
        </ol>
        <p>Player strength is hidden, so trust your CS knowledge. After every map you get a scoreboard with kills, deaths and a match rating (1.00 is average). Stronger players tend to post better ratings, but anyone can have a bad map. Results also depend on role fit, a small chemistry bonus for teammates who share a lineup or organization, and luck. Your run saves in this browser.</p>
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
