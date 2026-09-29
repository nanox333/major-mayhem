import React, { useMemo, useState } from 'react';
import { ROLE_LABEL, rostersOn } from '../data/rosters';
import { dailyNumber, today } from '../game/state';
import { BEST_LABEL, Clue, GuessDay, MAX_GUESSES, Pro, addGuess, answerFor, compare, guessShare, guessStreak, loadGuesses, pros, saveGuesses, suggest } from '../game/guess';
import { COUNTRY } from '../game/synergy';
import { pageUrl } from '../game/share';
import { Avatar, TeamBadge } from '../ui/art';
import { NextDaily } from '../ui/Countdown';
import { ShareBar } from './Final';
import { track } from '../analytics';

const HEADS: [Clue['key'], string][] = [['country', 'Nation'], ['role', 'Role'], ['majors', 'Majors'], ['best', 'Best'], ['first', 'First'], ['orgs', 'Teams']];

export function GuessScreen() {
  const date = today();
  const all = useMemo(() => pros(rostersOn(date)), [date]);
  const answer = useMemo(() => answerFor(date), [date]);
  const [store, setStore] = useState(loadGuesses);
  const day: GuessDay = store[date] ?? { guesses: [], done: false, won: false };
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const options = suggest(all, text, day.guesses);

  const guess = (p: Pro) => {
    const next = addGuess(day, p.id, answer);
    if (next === day) return;
    const s = { ...store, [date]: next };
    setStore(s); saveGuesses(s); setText(''); setActive(0);
    if (day.guesses.length === 0) track('guess_start', { daily: dailyNumber(date) });
    if (next.done) track('guess_finish', { daily: dailyNumber(date), won: next.won, guesses: next.guesses.length });
  };
  const hint = !day.done && day.guesses.length >= 5 ? answer.orgs[answer.orgs.length - 1] : null;

  return (
    <div className="guess stack">
      <p className="spin-stage__hint">
        One pro from Major history, the same for everyone today. You have {MAX_GUESSES} guesses: each shows how your pick compares.
        Green is a match, yellow is close (same region, a role they also played, a year off, a shared team), and arrows point toward the answer.
      </p>
      {!day.done && (
        <div className="guess__box">
          <input value={text} onChange={(e) => { setText(e.target.value); setActive(0); }} placeholder={`Guess ${day.guesses.length + 1} of ${MAX_GUESSES}: type a player`}
            aria-label="Type a player's name" autoComplete="off" spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === 'Enter' && options[active]) guess(options[active]);
            }} />
          {options.length > 0 && (
            <ul className="guess__suggest" role="listbox">
              {options.map((p, i) => (
                <li key={p.id} role="option" aria-selected={i === active}>
                  <button className={i === active ? 'is-on' : ''} onClick={() => guess(p)}>
                    <b>{p.nick}</b><small>{p.country} · {p.orgs.slice(-1)[0]}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hint && <p className="muted small">Hint: one of their teams was {hint}.</p>}
        </div>
      )}
      {day.guesses.length > 0 && (
        <div className="guess__grid" role="table" aria-label="Your guesses">
          <div className="guess__row guess__row--head" role="row"><span role="columnheader">Player</span>{HEADS.map(([k, h]) => <span key={k} role="columnheader">{h}</span>)}</div>
          {[...day.guesses].reverse().map((id) => {
            const p = all.get(id)!;
            return (
              <div className="guess__row anim-in" role="row" key={id}>
                <span className={`guess__who ${id === answer.id ? 'is-hit' : ''}`} role="cell">{p.nick}</span>
                {compare(p, answer).map((c) => (
                  <span key={c.key} role="cell" className={`clue clue--${c.state}`} title={c.key === 'country' ? COUNTRY[c.text] : c.key === 'role' ? ROLE_LABEL[c.text as keyof typeof ROLE_LABEL] : undefined}>
                    {c.key === 'role' ? ROLE_LABEL[c.text as keyof typeof ROLE_LABEL] : c.text}{c.dir ? (c.dir === 'up' ? ' ↑' : ' ↓') : ''}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {day.done && (
        <div className={`guess__answer anim-in ${day.won ? 'is-won' : ''}`}>
          <span className="guess__photo"><Avatar player={{ id: answer.id, nick: answer.nick, roles: answer.roles, rating: 80, country: answer.country, portrait: answer.portrait }} roster={answer.rosters[answer.rosters.length - 1]} /></span>
          <div>
            <small>{day.won ? `Got it in ${day.guesses.length}` : 'Today\'s pro was'}</small>
            <strong>{answer.nick}</strong>
            <span>{COUNTRY[answer.country] ?? answer.country} · {ROLE_LABEL[answer.role]} · {answer.majors} Major{answer.majors === 1 ? '' : 's'} in the game · best finish {BEST_LABEL[answer.best].toLowerCase()}</span>
            <span className="guess__teams">{answer.rosters.map((r) => <span key={r.id}><TeamBadge roster={r} size={14} /> {r.org} {r.year}</span>)}</span>
          </div>
        </div>
      )}
      {day.done && (
        <>
          <ShareBar text={() => guessShare(date, day, answer, all, pageUrl())} props={{ mode: 'guess', daily: dailyNumber(date) }} />
          <p className="daily-meta">{guessStreak(store, date) > 1 && <span>🔥 {guessStreak(store, date)}-day streak</span>}<NextDaily /></p>
        </>
      )}
    </div>
  );
}
