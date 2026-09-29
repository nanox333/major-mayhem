import React, { useMemo, useState } from 'react';
import { ROLE_LABEL } from '../data/rosters';
import { dailyNumber, today } from '../game/state';
import { BEST_LABEL, CLUE_MARK, Clue, GuessDay, MAX_GUESSES, Pro, addGuess, answerFor, compare, describeClue, guessShare, guessStreak, loadGuesses, prosOn, saveGuesses, searchState } from '../game/guess';
import { COUNTRY } from '../game/synergy';
import { pageUrl } from '../game/share';
import { Avatar, TeamBadge } from '../ui/art';
import { NextDaily } from '../ui/Countdown';
import { ShareBar } from './Final';
import { track } from '../analytics';
import { play } from '../ui/sound';

// Majors, best finish and first year count only the Major rosters in this game, not whole careers (#14).
const HEADS: [Clue['key'], string, string?][] = [['country', 'Nation'], ['role', 'Role'],
  ['majors', 'Majors*', 'Major rosters of theirs included in this game, not their whole career'],
  ['best', 'Best*', 'Best finish among the rosters included in this game'],
  ['first', 'First*', 'Year of their earliest roster included in this game'], ['orgs', 'Teams']];
const HEAD = Object.fromEntries(HEADS.map(([k, h]) => [k, h])) as Record<Clue['key'], string>;

/** What a clue shows in its cell, and its full name for the description (a nation is shown as its code, described by name). */
const shownFor = (c: Clue) => (c.key === 'role' ? ROLE_LABEL[c.text as keyof typeof ROLE_LABEL] : c.text);
const namedFor = (c: Clue) => (c.key === 'country' ? COUNTRY[c.text] ?? c.text : shownFor(c));

export function GuessScreen() {
  const date = today();
  const all = useMemo(() => prosOn(date), [date]);
  const answer = useMemo(() => answerFor(date), [date]);
  const [store, setStore] = useState(loadGuesses);
  const day: GuessDay = store[date] ?? { guesses: [], done: false, won: false };
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const found = searchState(all, text, day.guesses);
  const options = found.kind === 'results' ? found.options : [];
  const spoken = found.kind === 'results' ? `${options.length} player${options.length === 1 ? '' : 's'} found` : found.kind === 'none' ? 'No players found' : found.kind === 'guessed' ? `${found.nick} was already guessed` : '';

  const guess = (p: Pro) => {
    const next = addGuess(day, p.id, answer);
    if (next === day) return;
    const s = { ...store, [date]: next };
    setStore(s); saveGuesses(s); setText(''); setActive(0);
    // One note per clue, left to right: bright for a match, mid for close, low for a miss; then the verdict.
    compare(p, answer).forEach((c, i) => play(c.state === 'hit' ? 'hit' : c.state === 'near' ? 'near' : 'miss', { delay: i * 70 }));
    if (next.done) play(next.won ? 'mapWin' : 'mapLose', { delay: 6 * 70 + 250 });
    if (day.guesses.length === 0) track('guess_start', { daily: dailyNumber(date) });
    if (next.done) track('guess_finish', { daily: dailyNumber(date), won: next.won, guesses: next.guesses.length });
  };
  const hint = !day.done && day.guesses.length >= 5 ? answer.orgs[answer.orgs.length - 1] : null;

  return (
    <div className="guess stack">
      <p className="spin-stage__hint">
        One pro from Major history, the same for everyone today. You have {MAX_GUESSES} guesses: each shows how your pick compares with the answer.
      </p>
      {/* Every result has a symbol as well as a colour, and each clue is described in words for screen readers (#22). */}
      <ul className="guess__legend" aria-label="What the marks mean">
        <li><span className="clue-key clue--hit" aria-hidden="true">{CLUE_MARK.hit}</span> Match</li>
        <li><span className="clue-key clue--near" aria-hidden="true">{CLUE_MARK.near}</span> Close</li>
        <li><span className="clue-key clue--miss" aria-hidden="true">{CLUE_MARK.miss}</span> No match</li>
        <li><span className="clue-key" aria-hidden="true">↑ ↓</span> Answer is higher / lower</li>
      </ul>
      <p className="muted small">Close means the same region, a role they also played, a year off, or a shared team. * Majors, best finish and first year count only the Major rosters in this game, not whole careers.</p>
      {!day.done && (
        <div className="guess__box">
          <input value={text} onChange={(e) => { setText(e.target.value); setActive(0); }} placeholder={`Guess ${day.guesses.length + 1} of ${MAX_GUESSES}: type a player`}
            aria-label="Type a player's name" autoComplete="off" spellCheck={false}
            role="combobox" aria-autocomplete="list" aria-expanded={options.length > 0} aria-controls="guess-options"
            aria-activedescendant={options.length ? `guess-option-${active}` : undefined}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === 'Enter' && options[active]) guess(options[active]);
              if (e.key === 'Escape' && text) { e.preventDefault(); setText(''); setActive(0); }
            }} />
          <div className="sr" role="status" aria-live="polite">{spoken}</div>
          {options.length > 0 && (
            <ul className="guess__suggest" id="guess-options" role="listbox" aria-label="Matching players">
              {options.map((p, i) => (
                <li key={p.id} role="presentation">
                  <button role="option" id={`guess-option-${i}`} aria-selected={i === active} tabIndex={-1} className={i === active ? 'is-on' : ''} data-sfx="none" onClick={() => guess(p)}>
                    <b>{p.nick}</b><small>{p.country} · {p.orgs.slice(-1)[0]}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {found.kind === 'none' && <p className="guess__empty">No players found for “{text.trim()}”. Check the spelling, or try part of a nickname.</p>}
          {found.kind === 'guessed' && <p className="guess__empty">You've already guessed {found.nick}. Try someone else.</p>}
          {hint && <p className="muted small">Hint: one of their teams was {hint}.</p>}
        </div>
      )}
      {day.guesses.length > 0 && (
        <div className="guess__grid" role="table" aria-label="Your guesses">
          <div className="guess__row guess__row--head" role="row"><span role="columnheader">Player</span>{HEADS.map(([k, h, tip]) => <span key={k} role="columnheader" title={tip}>{h}</span>)}</div>
          {[...day.guesses].reverse().map((id) => {
            const p = all.get(id)!;
            const right = id === answer.id;
            return (
              <div className="guess__row anim-in" role="row" key={id}>
                <span className={`guess__who ${right ? 'is-hit' : ''}`} role="cell" aria-label={right ? `${p.nick}, correct` : undefined}>{p.nick}{right && <i className="clue__mark" aria-hidden="true"> {CLUE_MARK.hit}</i>}</span>
                {compare(p, answer).map((c) => {
                  const said = describeClue(c, namedFor(c));
                  return (
                    <span key={c.key} role="cell" className={`clue clue--${c.state} clue-${c.key}`} aria-label={said} title={said}>
                      <small className="clue__label" aria-hidden="true">{HEAD[c.key]}</small>
                      <span className="clue__val" aria-hidden="true">{shownFor(c)}{c.dir ? (c.dir === 'up' ? ' ↑' : ' ↓') : ''}</span>
                      <i className="clue__mark" aria-hidden="true">{CLUE_MARK[c.state]}</i>
                    </span>
                  );
                })}
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
            <span>{COUNTRY[answer.country] ?? answer.country} · {ROLE_LABEL[answer.role]} · {answer.majors} Major{answer.majors === 1 ? '' : 's'} in the game · best finish here {BEST_LABEL[answer.best].toLowerCase()}</span>
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
