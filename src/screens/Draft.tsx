import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ROLE_LABEL, ROLE_SHORT, Player, Role, Roster, ROSTERS, playerLiquipedia } from '../data/rosters';
import * as G from '../game/logic';
import { ChemPreview, Preview, chemPreview, defaultSlot, placementLabel, playerState } from '../game/draftui';
import { Action, MIN_POOL, Opts, Run, dailyDate, dailyNumber, poolCheck, roundOf, slotsFor, today } from '../game/state';
import { Stats, dailyStreak } from '../game/stats';
import { REACHED } from './Stats';
import { pageUrl } from '../game/share';
import { NextDaily } from '../ui/Countdown';
import { ShareBar } from './Final';
import { Avatar, RoleIcon, Sr, TeamBadge } from '../ui/art';
import { rarity, reduceMotion, useMedia } from '../ui/util';
import { COUNTRY, coachKnows, draftHints } from '../game/synergy';
import { useChatVote } from '../ui/ChatVote';
import { REEL_CURVE, REEL_MS, reelTickTimes } from '../ui/reel';
import { play, playTicks } from '../ui/sound';
import { HowSteps, Tip, useTipSeen } from '../ui/tips';
import { CaseIcon, ChevronDownIcon, MedalIcon, RefreshIcon, TrophyIcon } from '../ui/icons';
import { DailyDone, ModePicker } from './Modes';

export function DraftScreen({ s, dispatch, reelFor, setReelFor, stats, onPreview }: {
  s: Run; dispatch: React.Dispatch<Action>; reelFor: number | null; setReelFor: (n: number | null) => void; stats: Stats;
  /** Tells the lineup and the chemistry panel which player or coach you are pointing at (#143). */
  onPreview: (p: Preview | null) => void;
}) {
  if (s.step === 'spin') {
    const open = G.openSlots(s.picks);
    const date = dailyDate(s);
    const played = date ? stats.daily[date] : undefined;
    const todayN = dailyNumber(today());
    const doneToday = stats.daily[today()];
    return (
      <div className="spin-stage anim-in" key={`spin-${s.picks.length}`}>
        {s.picks.length === 0 && s.offerKey === 0 && <Tip id="intro" title="How Major Mayhem works"><p className="tip__lead">Draft a five-man dream team from Counter-Strike Major history, then win the Major.</p><HowSteps compact /></Tip>}
        <div className="case-art" aria-hidden="true"><span /></div>
        <p className="spin-stage__hint">
          {roundOf(s) === 'coach' ? 'Round 6: the coach. This case holds three coaches from Major history. A better coach lifts the team and makes your timeouts count for more, and knowing your players helps.'
            : roundOf(s) === 'bench' ? 'Round 7: the bench. Pick anyone from the case, any role. Before each match you can sub them in for a starter who\'s off form.'
              : s.picks.length === 0 ? 'Each case holds three real rosters from a Major. Pick a team, then one player from it.' : `Still to fill: ${open.map((r) => ROLE_LABEL[r]).join(', ')}.`}
        </p>
        {s.picks.length === 0 && s.mode === 'daily' && (
          <p className="muted small">
            Daily #{dailyNumber(date!)}: everyone gets the same cases today.
            {played && ` You already finished this one (${played.placement}); replays don't change your record.`}
          </p>
        )}
        <div className="action-bar"><button className="cta cta--orange" data-sfx="open" onClick={() => { setReelFor(s.offerKey + 1); dispatch({ type: 'spin' }); }}>Open case</button></div>
        {s.picks.length === 0 && s.rerolls === 2 && s.mode === 'daily' && (
          <button className="ghost-btn" onClick={() => dispatch({ type: 'reset', mode: 'free' })}>Switch to free play</button>
        )}
        {s.picks.length === 0 && s.rerolls === 2 && s.mode === 'free' && !doneToday && (
          <button className="ghost-btn" onClick={() => dispatch({ type: 'reset', mode: 'daily' })}>Play Daily #{todayN} instead</button>
        )}
        {s.offerKey === 0 && s.mode === 'free' && <ModePicker opts={s.opts ?? {}} dispatch={dispatch} />}
        {s.picks.length === 0 && s.mode === 'free' && doneToday && <DailyDone d={doneToday} n={todayN} />}
      </div>
    );
  }
  if (s.step === 'teams') {
    if (reelFor === s.offerKey && !reduceMotion()) return <CaseReel land={s.offer[0]} onDone={() => setReelFor(null)} />;
    return roundOf(s) === 'coach' ? <CoachChoices s={s} dispatch={dispatch} onPreview={onPreview} /> : <CaseCards s={s} dispatch={dispatch} onPreview={onPreview} />;
  }
  return s.team ? <PlayerChoices roster={G.rosterById.get(s.team)!} s={s} bench={roundOf(s) === 'bench'} dispatch={dispatch} /> : null;
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
  const [landed, setLanded] = useState(false);
  useLayoutEffect(() => {
    const w = box.current?.clientWidth ?? 600;
    const target = LAND * STEP + STEP / 2 - w / 2 + (Math.random() - 0.5) * (STEP * 0.6);
    const el = strip.current!;
    el.style.transform = 'translateX(0)';
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = `transform ${REEL_MS}ms cubic-bezier(${REEL_CURVE.join(',')})`;
      el.style.transform = `translateX(${-target}px)`;
    }));
    const t = setTimeout(onDone, 2900);
    const glow = setTimeout(() => setLanded(true), REEL_MS);
    // A tick each time an item passes the marker (the strip starts moving a couple of frames in), then a chime for the team it stops on.
    const ticks = playTicks(reelTickTimes(target, w / 2, STEP), 40);
    const chime = play('reveal', { rarity: rarity(items[LAND]), delay: REEL_MS + 40 });
    return () => { cancelAnimationFrame(raf); clearTimeout(t); clearTimeout(glow); ticks(); chime(); };
  }, [items]);
  return (
    <div className={`reel anim-in rar-${rarity(items[LAND])} ${landed ? 'is-landed' : ''}`} ref={box} aria-label="Opening case">
      <div className="reel__strip" ref={strip}>
        {items.map((r, i) => (
          <div key={i} className={`reel__item rar-${rarity(r)} ${landed && i === LAND ? 'is-landed' : ''}`}>
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

function useReroll(dispatch: React.Dispatch<Action>) {
  const [out, setOut] = useState(false);
  const reroll = () => {
    if (reduceMotion()) return dispatch({ type: 'reroll' });
    setOut(true);
    setTimeout(() => { dispatch({ type: 'reroll' }); setOut(false); }, 160);
  };
  return { out, reroll };
}

/** The opened-case bar over the cards (#103): what this case holds and what to do with it. */
function OpenedCase({ children }: { children: React.ReactNode }) {
  return (
    <div className="opened">
      <span className="opened__icon"><CaseIcon size={26} /></span>
      <p><b>Opened case</b> <span>{children}</span></p>
    </div>
  );
}

/** "Spin again" with the real number of spins left (#103). */
function SpinAgain({ s, reroll }: { s: Run; reroll: () => void }) {
  return (
    <div className="reroll-row anim-in" style={{ animationDelay: '220ms' }}>
      <button className="ghost-btn ghost-btn--big" data-sfx="reroll" onClick={reroll} disabled={s.rerolls <= 0}>
        <RefreshIcon size={16} /> Spin again · {s.rerolls <= 0 ? 'no spins left' : `${s.rerolls} spin${s.rerolls === 1 ? '' : 's'} left`}
      </button>
    </div>
  );
}

/** A team's result as a placement badge: an icon and the words ("1st place"), so the colour of the card is never the only signal (#104). */
function Placement({ roster }: { roster: Roster }) {
  return <span className="place">{roster.result === 'Champions' ? <TrophyIcon size={14} /> : <MedalIcon size={14} />}{placementLabel(roster.result)}</span>;
}

/** The coach round: three coaches, each shown with the Major they coached at. */
function CoachChoices({ s, dispatch, onPreview }: { s: Run; dispatch: React.Dispatch<Action>; onPreview: (p: Preview | null) => void }) {
  const { out, reroll } = useReroll(dispatch);
  useEffect(() => () => onPreview(null), []);
  const pointAt = (id: string | null) => {
    if (!id) return onPreview(null);
    const c = G.rosterById.get(id)!.coach!;
    onPreview({ slot: 'coach', rosterId: id, coach: c, chem: chemPreview({ picks: s.picks, coach: s.coach }, { picks: s.picks, coach: c }, !!s.opts?.hard) });
  };
  const drafted = s.picks.map((pk) => G.rosterById.get(pk.rosterId)!.players.find((x) => x.id === pk.playerId)!);
  useChatVote(`coach-${s.offerKey}-${s.rerollKey}`, s.offer.map((id) => { const c = G.rosterById.get(id)!.coach!; return { id, label: c, aliases: [c] }; }),
    (id) => dispatch({ type: 'coach', rosterId: id }));
  return (
    <div className="case">
      <OpenedCase>Three coaches from Major history. Pick one to lead your team.</OpenedCase>
      <div className={`teams-col ${out ? 'is-out' : ''}`}>
        {s.offer.map((id, i) => {
          const r = G.rosterById.get(id)!;
          const knows = drafted.filter((p) => coachKnows(r.coach!, p.id));
          return (
            <button key={`${id}-${s.rerollKey}`} className={`case-item case-item--coach rar-${rarity(r)} anim-in`} data-sfx="draft" style={{ animationDelay: `${i * 70}ms` }} onClick={() => dispatch({ type: 'coach', rosterId: id })}
              onMouseEnter={() => pointAt(id)} onMouseLeave={() => pointAt(null)} onFocus={() => pointAt(id)} onBlur={() => pointAt(null)}>
              <div className="case-item__top">
                <TeamBadge roster={r} size={44} />
                <div className="case-item__id">
                  <div className="case-item__name">{r.coach}</div>
                  <div className="case-item__meta"><span>Coach · {r.org} {r.year}</span><Placement roster={r} /></div>
                </div>
              </div>
              {knows.length > 0 && <span className="hint hint--good"><i aria-hidden="true">+</i> <Sr>Bonus: </Sr>Coached {knows.map((p) => p.nick).join(', ')}</span>}
              <div className="case-item__event">{r.event}</div>
            </button>
          );
        })}
      </div>
      <SpinAgain s={s} reroll={reroll} />
    </div>
  );
}

type Chosen = { r: Roster; p: Player };

/**
 * The case (#102 to #105): three team cards with all fifteen players in view. Pick a player, see the slot and what it means, then draft.
 * It drafts through the same two steps as before (open the team, then draft the player), so a seed plays out exactly as it did.
 */
function CaseCards({ s, dispatch, onPreview }: { s: Run; dispatch: React.Dispatch<Action>; onPreview: (p: Preview | null) => void }) {
  const { out, reroll } = useReroll(dispatch);
  const bench = roundOf(s) === 'bench';
  const hard = !!s.opts?.hard;
  const taken = G.draftedIds(s.picks);
  const drafted = s.picks.map((pk) => G.rosterById.get(pk.rosterId)!.players.find((x) => x.id === pk.playerId)!);
  const can = (p: Player) => (bench ? !taken.has(p.id) : slotsFor(s, p).length > 0);
  const [sel, setSel] = useState<Chosen | null>(null);
  const [slot, setSlot] = useState<Role | null>(null);
  // Pointing at a player (mouse or keyboard) previews them; pressing one keeps the preview until you draft or pick someone else (#143).
  const [hov, setHov] = useState<Chosen | null>(null);
  // Choosing a player with the keyboard moves focus to the Draft button, so the next Enter drafts them (#77).
  const [focusDraft, setFocusDraft] = useState(false);
  useEffect(() => { if (focusDraft && sel) { document.querySelector<HTMLElement>('.draftbar .cta')?.focus(); setFocusDraft(false); } }, [focusDraft, sel]);
  // On a phone one card is open at a time, so all three fit on the screen; on wider screens every card is open.
  const phone = useMedia('(max-width: 860px)');
  const [openId, setOpenId] = useState<string | null>(s.offer[0] ?? null);
  // A new case, or a spin again, clears the choice.
  useEffect(() => { setSel(null); setSlot(null); setHov(null); setOpenId(s.offer[0] ?? null); }, [s.offerKey, s.rerollKey]);

  const cand = hov ?? sel;
  const isSel = !!cand && !!sel && cand.p.id === sel.p.id;
  const candSlot: Role | 'bench' | null = !cand ? null : bench ? 'bench' : isSel ? slot : defaultSlot(slotsFor(s, cand.p), cand.p.roles[0], hard);
  const chem: ChemPreview | null = useMemo(() => {
    if (!cand || bench) return null;
    const use = candSlot && candSlot !== 'bench' ? candSlot : slotsFor(s, cand.p)[0];
    return use ? chemPreview({ picks: s.picks, coach: s.coach }, { picks: [...s.picks, { slot: use, rosterId: cand.r.id, playerId: cand.p.id }], coach: s.coach }, hard) : null;
  }, [cand?.p.id, candSlot, s.picks.length]);
  useEffect(() => { onPreview(cand ? { slot: candSlot, rosterId: cand.r.id, playerId: cand.p.id, chem } : null); }, [cand?.p.id, candSlot, chem]);
  useEffect(() => () => onPreview(null), []);

  const choose = (c: Chosen) => { setSel(c); setOpenId(c.r.id); setSlot(bench ? null : defaultSlot(slotsFor(s, c.p), c.p.roles[0], hard)); };
  const draft = () => {
    if (!sel) return;
    dispatch({ type: 'team', id: sel.r.id });
    if (bench) dispatch({ type: 'bench', player: sel.p });
    else if (slot) dispatch({ type: 'draft', player: sel.p, slot });
  };

  // Chat votes once, on a player (by number or name); the slot is their main role when it's open, else the first open one they cover.
  const chatOptions = s.offer.flatMap((id) => {
    const r = G.rosterById.get(id)!;
    return r.players.filter(can).map((p) => ({ id: `${id}::${p.id}`, label: `${p.nick} (${r.tag} ${r.year})`, aliases: [p.nick, `${p.nick} ${r.tag}`] }));
  });
  useChatVote(`case-${s.offerKey}-${s.rerollKey}-${bench}`, chatOptions, (key) => {
    const [rid, pid] = key.split('::');
    const r = G.rosterById.get(rid)!;
    const p = r.players.find((x) => x.id === pid)!;
    dispatch({ type: 'team', id: rid });
    if (bench) return dispatch({ type: 'bench', player: p });
    const slots = slotsFor(s, p);
    dispatch({ type: 'draft', player: p, slot: slots.includes(p.roles[0]) ? p.roles[0] : slots[0] });
  });

  return (
    <div className="case">
      <OpenedCase>{bench ? 'Three iconic rosters. Pick anyone, any role, for your bench.' : 'Three iconic rosters. Pick one player to add to your lineup.'}</OpenedCase>
      {!bench && (hard
        ? <Tip id="fit" title="Hard mode" anchor="left">There are no role labels: put each player where you think they fit best. A slot that doesn't suit them costs you, but nothing tells you which is which.</Tip>
        : <Tip id="fit" title="Roles and fit" anchor="left">Each player has a main role: draft them there for the best fit. A role they also cover costs a little, and the card says so ("2nd role"). The + and − marks are chemistry: a shared country, a famous duo, a second AWPer.</Tip>)}
      <div className={`teams-col ${out ? 'is-out' : ''}`}>
        {s.offer.map((id, i) => {
          const r = G.rosterById.get(id)!;
          const expanded = !phone || openId === id;
          const top = (
            <>
              <TeamBadge roster={r} size={phone ? 44 : 68} />
              <div className="case-card__id">
                <h3 className="case-card__name">{r.org}</h3>
                <div className="case-card__meta"><span>{r.year}</span><Placement roster={r} /></div>
              </div>
            </>
          );
          return (
            <article key={`${id}-${s.rerollKey}`} className={`case-card rar-${hard ? 'milspec' : rarity(r)} ${sel?.r.id === id ? 'is-sel' : ''} anim-in`} style={{ animationDelay: `${i * 70}ms` }} aria-label={`${r.org} ${r.year}`}>
              {phone
                ? <button type="button" className="case-card__top case-card__toggle" aria-expanded={expanded} aria-controls={`players-${id}`} data-sfx="none" onClick={() => setOpenId(expanded ? null : id)}>{top}<ChevronDownIcon size={20} /></button>
                : <div className="case-card__top">{top}</div>}
              <ul className="case-players" id={`players-${id}`} hidden={!expanded}>
                {r.players.map((p) => {
                  const ok = can(p);
                  const on = sel?.r.id === id && sel.p.id === p.id;
                  const hints = !hard && ok && !bench ? draftHints(drafted, p) : [];
                  const st = bench ? { state: ok ? 'main' : 'unavailable', would: null, taken: null } as const : playerState(p, slotsFor(s, p), hard);
                  const body = (
                    <>
                      <span className="prow__face"><Avatar player={p} roster={r} /></span>
                      <span className="prow__main">
                        <span className="prow__name"><b>{p.nick}</b><em className="prow__cc" title={COUNTRY[p.country] ?? p.country}>{p.country}</em></span>
                        <span className="prow__meta">
                          {!ok && <small className="prow__why" title={unavailableReason(p, s, taken)}>{rowReason(p, s, taken)}</small>}
                          {ok && !hard && st.state === 'main' && <span className="prow__role" title="Main role"><RoleIcon role={p.roles[0]} size={13} /> <Sr>Main role: </Sr>{ROLE_SHORT[p.roles[0]]}</span>}
                          {ok && !hard && st.state === 'secondary' && (
                            <>
                              <span className="prow__role is-taken" title={`${ROLE_LABEL[st.taken]} is already filled`}><RoleIcon role={st.taken} size={13} /> <s>{ROLE_SHORT[st.taken]}</s> taken<Sr>: {ROLE_LABEL[st.taken]}, their main role, is already filled. </Sr></span>
                              <span className="prow__role is-second" title={`Would play ${ROLE_LABEL[st.would]} as a second role`}><RoleIcon role={st.would} size={13} /> {ROLE_SHORT[st.would]} 2nd role<Sr>: would play {ROLE_LABEL[st.would]} as a second role. </Sr></span>
                            </>
                          )}
                          {hints.map((h) => <span key={h.text} className={`hint ${h.good ? 'hint--good' : 'hint--bad'}`}><i aria-hidden="true">{h.good ? '+' : '−'}</i> <Sr>{h.good ? 'Bonus: ' : 'Penalty: '}</Sr>{h.text}</span>)}
                        </span>
                      </span>
                    </>
                  );
                  return (
                    <li key={p.id}>
                      {ok
                        ? <button type="button" className={`prow ${on ? 'is-sel' : ''} ${st.state === 'secondary' ? 'is-second' : ''}`} aria-pressed={on} data-sfx="select" onClick={(e) => { choose({ r, p }); if (e.detail === 0) setFocusDraft(true); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' && on) { e.preventDefault(); draft(); } }}
                          onMouseEnter={() => setHov({ r, p })} onMouseLeave={() => setHov(null)} onFocus={() => setHov({ r, p })} onBlur={() => setHov(null)}>{body}</button>
                        : <div className="prow is-off">{body}</div>}
                    </li>
                  );
                })}
              </ul>
              {expanded && <div className="case-card__event">{r.event}</div>}
            </article>
          );
        })}
      </div>
      <span className="sr" role="status">{sel ? `${sel.p.nick} selected.${chem && isSel ? (chem.before === chem.after ? ' Chemistry stays the same.' : ` Chemistry would go from ${chem.before} to ${chem.after}.`) : ''} Choose a slot, then draft.` : ''}</span>
      {sel && <DraftBar s={s} sel={sel} slot={slot} setSlot={setSlot} bench={bench} hard={hard} onDraft={draft} />}
      <SpinAgain s={s} reroll={reroll} />
    </div>
  );
}

/** What you are about to do: the player, the slot (with the fit written beside it, before you confirm), and the button. */
function DraftBar({ s, sel, slot, setSlot, bench, hard, onDraft }: { s: Run; sel: Chosen; slot: Role | null; setSlot: (r: Role) => void; bench: boolean; hard: boolean; onDraft: () => void }) {
  const slots = bench ? [] : slotsFor(s, sel.p);
  const nick = sel.p.nick;
  const st = bench ? null : playerState(sel.p, slots, hard);
  return (
    <div className="action-bar draftbar anim-in" role="region" aria-label={`Draft ${nick}`}>
      <p className="draftbar__who"><b>{nick}</b> <span>{sel.r.org} {sel.r.year}</span></p>
      {slots.length > 0 && (
        <div className="draftbar__slots" role="group" aria-label={`Slot for ${nick}`}>
          {!hard && st?.state === 'secondary' && (
            <button type="button" disabled className="slot-chip slot-chip--draft is-taken" aria-label={`${ROLE_LABEL[st.taken]}: already filled`}>
              <span><RoleIcon role={st.taken} size={12} /> <s>{ROLE_SHORT[st.taken]}</s></span><small className="fit">already filled</small>
            </button>
          )}
          {slots.map((sl) => {
            const note = G.fitNote(sel.p, sl);
            return (
              <button key={sl} type="button" aria-pressed={slot === sl} data-sfx="select" className={`slot-chip slot-chip--draft ${slot === sl ? 'is-on' : ''} ${!hard && note.kind === 'main' ? 'slot-chip--main' : ''}`} onClick={() => setSlot(sl)}
                aria-label={`${ROLE_LABEL[sl]}${hard ? '' : `, ${note.text}`}`}>
                <span><RoleIcon role={sl} size={12} /> {ROLE_SHORT[sl]}</span>
                {!hard && <small className={`fit fit--${note.kind}`}>{note.text}</small>}
              </button>
            );
          })}
        </div>
      )}
      <button type="button" className="cta cta--orange" data-sfx="draft" disabled={!bench && !slot} onClick={onDraft}>
        {bench ? `Draft ${nick} as Bench` : slot ? `Draft ${nick} as ${ROLE_SHORT[slot]}` : `Choose a slot for ${nick}`}
      </button>
    </div>
  );
}

function PlayerChoices({ roster, s, bench, dispatch }: { roster: Roster; s: Run; bench?: boolean; dispatch: React.Dispatch<Action> }) {
  const picks = s.picks;
  const hard = !!s.opts?.hard;
  const draftedIds = G.draftedIds(picks);
  const can = (p: Roster['players'][number]) => (bench ? !draftedIds.has(p.id) : slotsFor(s, p).length > 0);
  const players = roster.players.filter(can);
  const drafted = picks.map((pk) => G.rosterById.get(pk.rosterId)!.players.find((x) => x.id === pk.playerId)!);
  const taken = roster.players.filter((p) => !can(p));
  // Chat votes on the player; the slot is their main role when it's open, else the first open one they cover.
  useChatVote(`player-${roster.id}-${picks.length}-${bench}`, players.map((p) => ({ id: p.id, label: p.nick, aliases: [p.nick] })), (id) => {
    const p = players.find((x) => x.id === id)!;
    if (bench) return dispatch({ type: 'bench', player: p });
    const slots = slotsFor(s, p);
    dispatch({ type: 'draft', player: p, slot: slots.includes(p.roles[0]) ? p.roles[0] : slots[0] });
  });
  return (
    <div className="players-col">
      <div className={`team-heading rar-${hard ? 'milspec' : rarity(roster)}`}>
        <TeamBadge roster={roster} size={40} />
        <div>
          <div className="team-heading__name">{roster.org} <span>{roster.year}</span></div>
          <div className="team-heading__event">{roster.result} · {roster.event}</div>
          <div className="src-links">
            <a href={roster.liquipediaUrl} target="_blank" rel="noreferrer">Liquipedia</a>
            <a href={roster.sourceUrl} target="_blank" rel="noreferrer">Source: Wikipedia</a>
            <a href={reportUrl(roster)} target="_blank" rel="noreferrer">Report incorrect data</a>
          </div>
        </div>
      </div>
      {!bench && (hard
        ? <Tip id="fit" title="Hard mode">There are no role labels: put each player where you think they fit best. A slot that doesn't suit them costs you, but nothing tells you which is which.</Tip>
        : <Tip id="fit" title="Roles and fit">Each player has a main role. Draft them there for the best fit: another role they cover costs a little, and an off-role costs more. The line under each Draft button says which. The + and − chips are chemistry: a shared country, a famous duo, a second AWPer.</Tip>)}
      <div className="players-grid">
        {players.map((p, i) => {
          const slots = slotsFor(s, p);
          return (
            <div className="agent anim-in" style={{ animationDelay: `${i * 55}ms` }} key={p.id} role="group" aria-label={p.nick}>
              <div className="agent__photo">
                <Avatar player={p} roster={roster} className="agent__img" />
                {!hard && <span className="agent__main" title="Main role"><RoleIcon role={p.roles[0]} size={12} /> {ROLE_SHORT[p.roles[0]]}</span>}
                <span className="agent__flag" title={COUNTRY[p.country] ?? p.country}>{p.country}</span>
              </div>
              <div className="agent__body">
                {/* The name is just the name; the reference link is a separate, smaller control, so it can't be mistaken for drafting (#17). */}
                <span className="agent__name">{p.nick}
                  <a className="agent__ref" href={playerLiquipedia(p.nick)} target="_blank" rel="noreferrer" aria-label={`${p.nick} on Liquipedia`} title="Liquipedia">↗</a>
                </span>
                {!hard && <span className="agent__role muted small">Main role: {ROLE_LABEL[p.roles[0]]}</span>}
                {!hard && draftHints(drafted, p).map((h) => <span key={h.text} className={`hint ${h.good ? 'hint--good' : 'hint--bad'}`}><i aria-hidden="true">{h.good ? '+' : '−'}</i> <Sr>{h.good ? 'Bonus: ' : 'Penalty: '}</Sr>{h.text}</span>)}
                <div className="agent__slots">
                  {bench && <button className="slot-chip slot-chip--main" data-sfx="draft" onClick={() => dispatch({ type: 'bench', player: p })}>⇄ Draft as Bench</button>}
                  {!bench && slots.map((slot) => {
                    const note = G.fitNote(p, slot);
                    return (
                      <button key={slot} className={`slot-chip slot-chip--draft ${!hard && note.kind === 'main' ? 'slot-chip--main' : ''}`} data-sfx="draft" onClick={() => dispatch({ type: 'draft', player: p, slot })}
                        aria-label={`Draft ${p.nick} as ${ROLE_LABEL[slot]}${hard ? '' : `, ${note.text}`}`}>
                        <span><RoleIcon role={slot} size={12} /> Draft as {ROLE_SHORT[slot]}</span>
                        {!hard && <small className={`fit fit--${note.kind}`}>{note.text}</small>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {taken.length > 0 && (
        <ul className="unavailable muted small" aria-label="Unavailable players">
          {taken.map((p) => <li key={p.id}><b>{p.nick}</b>: {unavailableReason(p, s, draftedIds)}</li>)}
        </ul>
      )}
    </div>
  );
}

/** The same reason, short enough to sit under a name on a team card. */
function rowReason(p: Roster['players'][number], s: Run, drafted: Set<string>): string {
  if (drafted.has(p.id)) return 'already on your team';
  if (s.opts?.hard) return 'no open slot left';
  return `${p.roles.map((r) => ROLE_LABEL[r]).join(' and ')} already filled`;
}

/** Why a player can't be picked, exactly (#17). Hard mode doesn't name their roles. */
function unavailableReason(p: Roster['players'][number], s: Run, drafted: Set<string>): string {
  if (drafted.has(p.id)) {
    const pk = s.picks.find((x) => x.playerId === p.id);
    return pk ? `already on your team as ${ROLE_LABEL[pk.slot]}` : 'already on your team';
  }
  if (s.opts?.hard) return 'no open slot left';
  const filled = p.roles.map((r) => ROLE_LABEL[r]).join(' and ');
  return `plays ${filled}, and ${p.roles.length > 1 ? 'those slots are' : 'that slot is'} already filled`;
}

/** Opens the roster-data issue form with this roster filled in (#13). */
const reportUrl = (r: { org: string; year: number; event: string }) =>
  `https://github.com/nanox333/major-mayhem/issues/new?template=roster_data.yml&roster=${encodeURIComponent(`${r.org} ${r.year} (${r.event})`)}`;
