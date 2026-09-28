import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ROLE_LABEL, ROLE_SHORT, Roster, ROSTERS, playerLiquipedia } from '../data/rosters';
import * as G from '../game/logic';
import { Action, Run, dailyDate, dailyNumber, today } from '../game/state';
import { Stats } from '../game/stats';
import { pageUrl } from '../game/share';
import { NextDaily } from '../ui/Countdown';
import { ShareBar } from './Final';
import { Avatar, RoleIcon, TeamBadge } from '../ui/art';
import { rarity, reduceMotion } from '../ui/util';

export function DraftScreen({ s, dispatch, reelFor, setReelFor, stats }: {
  s: Run; dispatch: React.Dispatch<Action>; reelFor: number | null; setReelFor: (n: number | null) => void; stats: Stats;
}) {
  if (s.step === 'spin') {
    const open = G.openSlots(s.picks);
    const date = dailyDate(s);
    const played = date ? stats.daily[date] : undefined;
    const todayN = dailyNumber(today());
    const doneToday = stats.daily[today()];
    return (
      <div className="spin-stage anim-in" key={`spin-${s.picks.length}`}>
        <div className="case-art" aria-hidden="true"><span /></div>
        <p className="spin-stage__hint">
          {s.picks.length === 0 ? 'Each case holds three real rosters from a Major. Pick a team, then one player from it.' : `Still to fill: ${open.map((r) => ROLE_LABEL[r]).join(', ')}.`}
        </p>
        {s.picks.length === 0 && s.mode === 'daily' && (
          <p className="muted small">
            Daily #{dailyNumber(date!)}: everyone gets the same cases today.
            {played && ` You already finished this one (${played.placement}); replays don't change your record.`}
          </p>
        )}
        <button className="cta cta--orange" onClick={() => { setReelFor(s.offerKey + 1); dispatch({ type: 'spin' }); }}>Open case</button>
        {s.picks.length === 0 && s.rerolls === 2 && s.mode === 'daily' && (
          <button className="ghost-btn" onClick={() => dispatch({ type: 'reset', mode: 'free' })}>Switch to free play</button>
        )}
        {s.picks.length === 0 && s.rerolls === 2 && s.mode === 'free' && !doneToday && (
          <button className="ghost-btn" onClick={() => dispatch({ type: 'reset', mode: 'daily' })}>Play Daily #{todayN} instead</button>
        )}
        {s.picks.length === 0 && s.mode === 'free' && doneToday && (
          <div className="daily-done">
            <small>Daily #{todayN} done</small>
            <strong>{doneToday.placement}</strong>
            <span>MVP {doneToday.mvp}{doneToday.grade !== null ? ` · Draft ${Math.round(doneToday.grade * 100)}%` : ''}</span>
            {doneToday.share && <ShareBar text={() => [doneToday.share, pageUrl()].filter(Boolean).join('\n')} />}
            <NextDaily />
          </div>
        )}
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
