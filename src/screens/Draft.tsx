import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ROLE_LABEL, ROLE_SHORT, Roster, ROSTERS, playerLiquipedia } from '../data/rosters';
import * as G from '../game/logic';
import { Action, MIN_POOL, Opts, Run, dailyDate, dailyNumber, poolCheck, roundOf, slotsFor, today } from '../game/state';
import { Stats, dailyStreak } from '../game/stats';
import { REACHED } from './Stats';
import { pageUrl } from '../game/share';
import { NextDaily } from '../ui/Countdown';
import { ShareBar } from './Final';
import { Avatar, RoleIcon, Sr, TeamBadge } from '../ui/art';
import { rarity, reduceMotion } from '../ui/util';
import { COUNTRY, coachKnows, draftHints } from '../game/synergy';
import { useChatVote } from '../ui/ChatVote';
import { REEL_CURVE, REEL_MS, reelTickTimes } from '../ui/reel';
import { play, playTicks } from '../ui/sound';
import { ThreeSteps, Tip, useTipSeen } from '../ui/tips';

export function DraftScreen({ s, dispatch, reelFor, setReelFor, stats, onGuess, onTwitch }: {
  s: Run; dispatch: React.Dispatch<Action>; reelFor: number | null; setReelFor: (n: number | null) => void; stats: Stats; onGuess: () => void; onTwitch: () => void;
}) {
  if (s.step === 'spin') {
    const open = G.openSlots(s.picks);
    const date = dailyDate(s);
    const played = date ? stats.daily[date] : undefined;
    const todayN = dailyNumber(today());
    const doneToday = stats.daily[today()];
    if (s.picks.length === 0 && s.offerKey === 0 && s.mode !== 'duel') {
      return <Home s={s} dispatch={dispatch} setReelFor={setReelFor} stats={stats} onGuess={onGuess} onTwitch={onTwitch} />;
    }
    return (
      <div className="spin-stage anim-in" key={`spin-${s.picks.length}`}>
        {s.picks.length === 0 && s.offerKey === 0 && <Tip id="intro" title="How Major Mayhem works"><p className="tip__lead">Draft a five-man dream team from Counter-Strike Major history, then win the Major.</p><ThreeSteps compact /></Tip>}
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
    return roundOf(s) === 'coach' ? <CoachChoices s={s} dispatch={dispatch} /> : <TeamChoices s={s} dispatch={dispatch} />;
  }
  return s.team ? <PlayerChoices roster={G.rosterById.get(s.team)!} s={s} bench={roundOf(s) === 'bench'} dispatch={dispatch} /> : null;
}

/** Today's finished (or abandoned) daily: result, share buttons and the countdown. */
function DailyDone({ d, n }: { d: NonNullable<Stats['daily'][string]>; n: number }) {
  return (
    <div className="daily-done">
      <small>Daily #{n} {d.abandoned ? 'abandoned' : 'done'}</small>
      <strong>{d.placement}</strong>
      <span>{d.abandoned ? 'Reset after it started, so it has no result.' : `MVP ${d.mvp}${d.grade !== null ? ` · Draft ${Math.round(d.grade * 100)}%` : ''}`}</span>
      {d.share && !d.abandoned && <ShareBar text={() => [d.share, pageUrl()].filter(Boolean).join('\n')} props={{ mode: 'daily', daily: n, from: 'daily-done' }} />}
      <NextDaily />
    </div>
  );
}

/** The first screen: today's daily is the big action, the other modes sit beneath it (#68). */
function Home({ s, dispatch, setReelFor, stats, onGuess, onTwitch }: {
  s: Run; dispatch: React.Dispatch<Action>; setReelFor: (n: number | null) => void; stats: Stats; onGuess: () => void; onTwitch: () => void;
}) {
  const todayN = dailyNumber(today());
  const done = stats.daily[today()];
  const played = done && !done.abandoned;
  const { current: streak } = dailyStreak(stats.daily, today());
  const best = stats.runs > 0 ? REACHED[stats.reached.reduce((b, n, i) => (n > 0 ? i : b), 0)] : null;
  const free = s.mode === 'free';
  const introSeen = useTipSeen('intro');
  const openCase = () => { setReelFor(s.offerKey + 1); dispatch({ type: 'spin' }); };
  const playDaily = () => {
    if (s.mode !== 'daily') dispatch({ type: 'reset', mode: 'daily' });
    setReelFor(1);
    dispatch({ type: 'spin' });
  };
  return (
    <div className="spin-stage home anim-in">
      <button className="home__daily" data-sfx="open" onClick={playDaily}>
        <small>{played ? 'Played ✓' : 'Same cases for everyone'}</small>
        <strong>{played ? `Replay Daily #${todayN}` : `Play Daily #${todayN}`}</strong>
        <span>{played ? `${done.placement}. Replays don't change your record.` : <NextDaily />}</span>
      </button>
      <p className="daily-meta">
        {streak > 0 && <span>🔥 {streak}-day streak</span>}
        {best && <span>Best finish: {best}</span>}
        {!streak && !best && introSeen && <span>Draft five pros, then win the Major.</span>}
      </p>
      {/* A first-time visitor's introduction, with the tagline that used to sit in the header (#101). It sits under the daily button so the button stays first. */}
      <Tip id="intro" title="How Major Mayhem works"><p className="tip__lead">Draft a five-man dream team from Counter-Strike Major history, then win the Major.</p><ThreeSteps compact /></Tip>
      {done && <DailyDone d={done} n={todayN} />}
      <div className="home__cards">
        <button className={`home__card ${free ? 'is-on' : ''}`} aria-pressed={free} onClick={() => dispatch({ type: 'reset', mode: 'free' })}>
          <strong>Free play</strong><small>Any era, champions or underdogs, hard mode</small>
        </button>
        <button className="home__card" onClick={onGuess}>
          <strong>Guess the pro</strong><small>A second daily: eight guesses</small>
        </button>
      </div>
      {free && (
        <>
          <ModePicker opts={s.opts ?? {}} dispatch={dispatch} />
          <div className="action-bar"><button className="cta cta--orange" data-sfx="open" onClick={openCase}>Open case</button></div>
        </>
      )}
      <button type="button" className="link-btn" onClick={onTwitch}>Twitch chat votes ›</button>
    </div>
  );
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

/** The coach round: three coaches, each shown with the Major they coached at. */
function CoachChoices({ s, dispatch }: { s: Run; dispatch: React.Dispatch<Action> }) {
  const { out, reroll } = useReroll(dispatch);
  const drafted = s.picks.map((pk) => G.rosterById.get(pk.rosterId)!.players.find((x) => x.id === pk.playerId)!);
  useChatVote(`coach-${s.offerKey}-${s.rerollKey}`, s.offer.map((id) => { const c = G.rosterById.get(id)!.coach!; return { id, label: c, aliases: [c] }; }),
    (id) => dispatch({ type: 'coach', rosterId: id }));
  return (
    <div className={`teams-col ${out ? 'is-out' : ''}`}>
      {s.offer.map((id, i) => {
        const r = G.rosterById.get(id)!;
        const knows = drafted.filter((p) => coachKnows(r.coach!, p.id));
        return (
          <button key={`${id}-${s.rerollKey}`} className={`case-item case-item--coach rar-${rarity(r)} anim-in`} data-sfx="draft" style={{ animationDelay: `${i * 70}ms` }} onClick={() => dispatch({ type: 'coach', rosterId: id })}>
            <div className="case-item__top">
              <TeamBadge roster={r} size={44} />
              <div className="case-item__id">
                <div className="case-item__name">{r.coach}</div>
                <div className="case-item__meta"><span>Coach · {r.org} {r.year}</span><span className="grade">{r.result}</span></div>
              </div>
            </div>
            {knows.length > 0 && <span className="hint hint--good"><i aria-hidden="true">+</i> <Sr>Bonus: </Sr>Coached {knows.map((p) => p.nick).join(', ')}</span>}
            <div className="case-item__event">{r.event}</div>
          </button>
        );
      })}
      <div className="reroll-row anim-in" style={{ animationDelay: '220ms' }}>
        <button className="ghost-btn" data-sfx="reroll" onClick={reroll} disabled={s.rerolls <= 0}>⟳ Reroll case <b>{s.rerolls}</b></button>
      </div>
    </div>
  );
}

function TeamChoices({ s, dispatch }: { s: Run; dispatch: React.Dispatch<Action> }) {
  const { out, reroll } = useReroll(dispatch);
  const bench = roundOf(s) === 'bench';
  const hard = !!s.opts?.hard;
  const taken = G.draftedIds(s.picks);
  useChatVote(`team-${s.offerKey}-${s.rerollKey}-${bench}`, s.offer.map((id) => {
    const r = G.rosterById.get(id)!;
    return { id, label: `${r.tag} ${r.year}`, aliases: [r.org, r.tag, `${r.tag} ${r.year}`, `${r.org} ${r.year}`] };
  }), (id) => dispatch({ type: 'team', id }));
  return (
    <div className={`teams-col ${out ? 'is-out' : ''}`}>
      {s.offer.map((id, i) => {
        const r = G.rosterById.get(id)!;
        return (
          <button key={`${id}-${s.rerollKey}`} className={`case-item rar-${hard ? 'milspec' : rarity(r)} anim-in`} style={{ animationDelay: `${i * 70}ms` }} onClick={() => dispatch({ type: 'team', id })}>
            <div className="case-item__top">
              <TeamBadge roster={r} size={44} />
              <div className="case-item__id">
                <div className="case-item__name">{r.org}</div>
                <div className="case-item__meta"><span>{r.year}</span><span className="grade">{r.result}</span></div>
              </div>
            </div>
            <ul className="case-item__roster">
              {r.players.map((p) => {
                const ok = bench ? !taken.has(p.id) : slotsFor(s, p).length > 0;
                return <li key={p.id} className={ok ? '' : 'is-off'}>{!hard && <RoleIcon role={p.roles[0]} size={11} />}{p.nick}</li>;
              })}
            </ul>
            <div className="case-item__event">{r.event}</div>
          </button>
        );
      })}
      <div className="reroll-row anim-in" style={{ animationDelay: '220ms' }}>
        <button className="ghost-btn" data-sfx="reroll" onClick={reroll} disabled={s.rerolls <= 0}>⟳ Reroll case <b>{s.rerolls}</b></button>
      </div>
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

/** Free-play options, chosen before the first case. */
function ModePicker({ opts, dispatch }: { opts: Opts; dispatch: React.Dispatch<Action> }) {
  const set = (o: Opts) => dispatch({ type: 'opts', opts: { ...opts, ...o } });
  // A filter that leaves too few teams can't be chosen, rather than quietly widening once the draft starts (#63).
  const choice = <K extends keyof Opts>(key: K, value: Opts[K], label: string) => {
    const { n, ok } = poolCheck({ ...opts, [key]: value });
    const why = ok ? undefined : `Only ${n} team${n === 1 ? '' : 's'} match with your other settings; a full draft needs ${MIN_POOL}.`;
    return <button className={opts[key] === value ? 'is-on' : ''} aria-pressed={opts[key] === value} disabled={!ok} title={why} aria-description={why} onClick={() => set({ [key]: value } as Opts)}>{label}</button>;
  };
  const blocked = ([{ era: 'csgo' }, { era: 'cs2' }, { pool: 'champions' }, { pool: 'underdogs' }] as Opts[]).some((o) => !poolCheck({ ...opts, ...o }).ok);
  return (
    <div className="modes" aria-label="Free-play mode">
      <div className="modes__row"><span>Era</span><div className="seg">{choice('era', undefined, 'All')}{choice('era', 'csgo', 'CS:GO')}{choice('era', 'cs2', 'CS2')}</div></div>
      <div className="modes__row"><span>Teams</span><div className="seg">{choice('pool', undefined, 'All')}{choice('pool', 'champions', 'Champions')}{choice('pool', 'underdogs', 'Underdogs')}</div></div>
      <div className="modes__row"><span>Hard</span><div className="seg">{choice('hard', undefined, 'Off')}{choice('hard', true, 'No role labels')}</div></div>
      {blocked && <p className="muted small">Greyed-out options leave fewer than {MIN_POOL} teams with your other settings, too few for a full draft.</p>}
    </div>
  );
}
