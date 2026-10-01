import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ROLE_LABEL, ROLE_SHORT } from '../data/rosters';
import radars from '../data/radars.json';
import { dailyNumber, today } from '../game/state';
import { BEST_LABEL, BEST_SHORT, CLUE_LABEL, CLUE_MARK, CLUE_ORDER, Clue, GuessDay, MAX_GUESSES, Pro, REVEAL, RevealPlan, addGuess, answerFor, clueMeaning, compare, guessShare, guessStreak, loadGuesses, normalizeDay, prosOn, revealPlan, saveGuesses, searchState, spokenGuess, teamsFor } from '../game/guess';
import { COUNTRY } from '../game/synergy';
import { pageUrl } from '../game/share';
import { Avatar, TeamBadge } from '../ui/art';
import { Flag } from '../ui/flags';
import { FlameIcon, HelpIcon, SearchIcon } from '../ui/icons';
import { Modal } from '../ui/Modal';
import { play } from '../ui/sound';
import { Tip } from '../ui/tips';
import { useCountdown } from '../ui/useCountdown';
import { reduceMotion } from '../ui/util';
import { ShareBar } from './Final';
import { track } from '../analytics';

// Majors, best finish and first year count only the Major rosters in this game, not whole careers (#14).
const HEAD: Record<Clue['key'], string> = { country: 'Nation', orgs: 'Teams', first: 'First*', role: 'Role', majors: 'Majors*', best: 'Best*' };
const HEAD_TIP: Partial<Record<Clue['key'], string>> = {
  majors: 'Major rosters of theirs included in this game, not their whole career',
  best: 'Best finish among the rosters included in this game',
  first: 'Year of their earliest roster included in this game',
};
/** The columns, left to right. The clue for each comes from `compare`, which has its own order. */
const COLUMNS: readonly Clue['key'][] = CLUE_ORDER;

/** What a clue shows in its cell, and its full name for the description (a nation is shown as its code, described by name). */
const shownFor = (c: Clue) => (c.key === 'role' ? ROLE_LABEL[c.text as keyof typeof ROLE_LABEL] : c.text);
const namedFor = (c: Clue) => (c.key === 'country' ? COUNTRY[c.text] ?? c.text : shownFor(c));

/** A live reveal: which guess is animating, its schedule, and whether it is in the flip or the win bounce. Only a guess made in this visit has one. */
interface Reveal { id: string; plan: RevealPlan; win: boolean; phase: 'flip' | 'win' }

const cssVars = (o: Record<string, string | number>) => o as React.CSSProperties;
const ms = (n: number) => `${n}ms`;

/** The faceless player over the title: the game's own silhouette, with a question mark. */
function Silhouette() {
  return (
    <svg className="gp__sil" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="20" r="11" fill="currentColor" />
      <path d="M8 62c0-14 10-22 24-22s24 8 24 22z" fill="currentColor" />
      <text x="32" y="26" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--bg)">?</text>
    </svg>
  );
}

export function GuessScreen({ next }: { /** What to do next once today's pro is found: play today's draft, continue it, or free play (#129). */ next: { label: string; go: () => void } }) {
  const date = today();
  const cd = useCountdown();
  const all = useMemo(() => prosOn(date), [date]);
  const answer = useMemo(() => answerFor(date), [date]);
  const [store, setStore] = useState(loadGuesses);
  const day: GuessDay = useMemo(() => normalizeDay(store[date], all, answer.id), [store, date, all, answer]);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [shake, setShake] = useState(false);
  const [help, setHelp] = useState(false);
  const [announce, setAnnounce] = useState('');
  const sounds = useRef<(() => void)[]>([]);
  const grid = useRef<HTMLDivElement>(null);
  const found = searchState(all, text, day.guesses);
  const options = found.kind === 'results' ? found.options : [];
  const spoken = found.kind === 'results' ? `${options.length} player${options.length === 1 ? '' : 's'} found` : found.kind === 'none' ? 'No players found' : found.kind === 'guessed' ? `${found.nick} was already guessed` : '';
  const left = MAX_GUESSES - day.guesses.length;

  /** Ends a reveal at once: the row is complete, the sounds still to come are cut off, and the next guess can be made. */
  const finish = () => { sounds.current.forEach((stop) => stop()); sounds.current = []; setReveal(null); };

  // A reveal ends by itself: after the flips, then after the win bounce. Leaving the page, or the tab going to the background, ends it too, so timers don't pile up.
  useEffect(() => {
    if (!reveal) return;
    const wait = reveal.phase === 'flip' ? reveal.plan.total : REVEAL.bounce * 5 + REVEAL.bounceLen;
    const t = setTimeout(() => (reveal.phase === 'flip' && reveal.win ? setReveal({ ...reveal, phase: 'win' }) : finish()), wait);
    const hidden = () => { if (document.hidden) finish(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', hidden); };
  }, [reveal]);
  useEffect(() => () => sounds.current.forEach((stop) => stop()), []);
  // A new guess comes into view, above the sticky search bar on a phone. Not on the first render: a reload shouldn't scroll.
  const seenRows = useRef(day.guesses.length);
  useEffect(() => {
    if (day.guesses.length > seenRows.current) grid.current?.querySelectorAll('.guess__row:not(.guess__row--empty):not(.guess__row--head)')[day.guesses.length - 1]?.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
    seenRows.current = day.guesses.length;
  }, [day.guesses.length]);

  const guess = (p: Pro) => {
    const nextDay = addGuess(day, p.id, answer);
    if (nextDay === day) return;
    const s = { ...store, [date]: nextDay };
    setStore(s); saveGuesses(s); setText(''); setActive(0);
    const clues = compare(p, answer);
    const right = p.id === answer.id;
    const reduced = reduceMotion();
    const plan = revealPlan(clues.length, reduced);
    // One note per cell, at the moment the tile turns over: bright for a match, mid for close, low for a miss; then the verdict. The same times the CSS uses.
    sounds.current.forEach((stop) => stop());
    sounds.current = clues.map((c, i) => play(c.state === 'hit' ? 'hit' : c.state === 'near' ? 'near' : 'miss', { delay: reduced ? i * 70 : plan.show[i] }));
    if (nextDay.done) sounds.current.push(play(nextDay.won ? 'mapWin' : 'mapLose', { delay: (reduced ? 6 * 70 : plan.total) + 250 }));
    setAnnounce(spokenGuess(nextDay.guesses.length, p.nick, clues, namedFor, right));
    setReveal(reduced ? null : { id: p.id, plan, win: right, phase: 'flip' });
    if (day.guesses.length === 0) track('guess_start', { daily: dailyNumber(date) });
    if (nextDay.done) track('guess_finish', { daily: dailyNumber(date), won: nextDay.won, guesses: nextDay.guesses.length });
  };

  /** Enter and the Guess button: while a row is still turning over they finish it, as in Wordle; otherwise they guess, and a miss shakes the box. */
  const submit = () => {
    if (reveal) return finish();
    if (options[active]) return guess(options[active]);
    if (text.trim()) { setShake(true); setTimeout(() => setShake(false), 420); }
  };
  const hint = !day.done && day.guesses.length >= 5 ? answer.orgs[answer.orgs.length - 1] : null;
  const showEnd = day.done && !reveal;
  const streak = guessStreak(store, date);
  // A different map behind each day's puzzle: an original backdrop from the game's own radars.
  const maps = Object.keys(radars as Record<string, string>);
  const radar = (radars as Record<string, string>)[maps[dailyNumber(date) % maps.length]];

  return (
    <section className={`gp ${reveal ? 'is-revealing' : ''} ${day.done && !day.won ? 'is-lost' : ''}`} style={cssVars({ '--radar': `url(${radar})`, '--flip': ms(REVEAL.flip), '--pop': ms(REVEAL.pop), '--bounce-len': ms(REVEAL.bounceLen) })} aria-labelledby="gp-title">
      <div className="gp__bg" aria-hidden="true" />
      <header className="gp__head">
        <Silhouette />
        <div className="gp__titles">
          <p className="gp__kicker">Daily #{dailyNumber(date)}</p>
          <h2 id="gp-title" className="gp__title">Guess the <span>Pro</span></h2>
          <p className="gp__sub">Find today's pro in {MAX_GUESSES} guesses.</p>
        </div>
        <button type="button" className="gp__help" onClick={() => setHelp(true)} aria-label="How Guess the pro works" data-sfx="none"><HelpIcon size={22} /></button>
      </header>

      <Tip id="guess" title="How to read the grid"><p>Each guess shows how your pick compares with the answer. ✓ is a match, ≈ is close, ✗ is no match, and an arrow points to where the answer is. The ? button explains every clue.</p></Tip>

      {/* Always eight rows: the ones you have used, then the ones you have left, so you can see how many remain without a counter. Oldest first. */}
      <div className="guess__grid" role="table" aria-label="Your guesses" ref={grid}>
        <div className="guess__row guess__row--head" role="row"><span role="columnheader">Player</span>{COLUMNS.map((k) => <span key={k} role="columnheader" title={HEAD_TIP[k]}>{HEAD[k]}</span>)}</div>
        {Array.from({ length: MAX_GUESSES }, (_, i) => {
          const id = day.guesses[i];
          if (!id) {
            const candidate = i === day.guesses.length && !day.done && !reveal ? options[active] : null;
            return <div key={`e${i}`} className={`guess__row guess__row--empty ${candidate ? 'guess__row--preview' : ''}`} role="row" aria-hidden="true"><span className="guess__n">{candidate ? <>{candidate.nick}<small>Not submitted</small></> : i + 1}</span>{COLUMNS.map((k) => <span key={k} className="guess__ph" />)}</div>;
          }
          const p = all.get(id)!;
          const right = id === answer.id;
          const live = reveal?.id === id ? reveal : null;
          const byKey = new Map(compare(p, answer).map((c) => [c.key, c]));
          return (
            <div className={`guess__row ${live ? 'is-reveal' : ''} ${live?.phase === 'win' ? 'is-win' : ''} ${right && !live ? 'is-right' : ''}`} role="row" key={id}>
              <span className={`guess__who ${right ? 'is-hit' : ''}`} role="cell" aria-label={right ? `${p.nick}, correct` : undefined}>{p.nick}{right && <i className="clue__mark" aria-hidden="true"> {CLUE_MARK.hit}</i>}</span>
              {COLUMNS.map((k, ci) => <ClueCell key={k} c={byKey.get(k)!} p={p} a={answer} style={live ? cssVars({ '--d': ms(live.plan.cells[ci]), '--b': ms(live.plan.bounce[ci] - live.plan.total) }) : undefined} />)}
            </div>
          );
        })}
      </div>

      {!day.done && (
        <div className={`guess__bar ${shake ? 'is-shake' : ''}`}>
          <div className="guess__box">
            <SearchIcon size={20} />
            <input value={text} onChange={(e) => { setText(e.target.value); setActive(0); }} placeholder="Type a player's name"
              aria-label={`Guess ${day.guesses.length + 1} of ${MAX_GUESSES}: type a player's name`} autoComplete="off" spellCheck={false}
              role="combobox" aria-autocomplete="list" aria-expanded={options.length > 0} aria-controls="guess-options"
              aria-activedescendant={options.length ? `guess-option-${active}` : undefined}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                if (e.key === 'Enter') { e.preventDefault(); submit(); }
                if (e.key === 'Escape' && text) { e.preventDefault(); setText(''); setActive(0); }
              }} />
            <button type="button" className="cta cta--orange guess__go" data-sfx="none" disabled={!options[active] && !reveal} onClick={submit}>Guess</button>
            {options.length > 0 && (
              <ul className="guess__suggest" id="guess-options" role="listbox" aria-label="Matching players">
                {options.map((p, i) => (
                  <li key={p.id} role="presentation">
                    <button role="option" id={`guess-option-${i}`} aria-selected={i === active} tabIndex={-1} className={i === active ? 'is-on' : ''} data-sfx="none" onClick={() => { if (reveal) finish(); guess(p); }}>
                      <b>{p.nick}</b><small>{p.country} · {p.orgs.slice(-1)[0]}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="sr" role="status" aria-live="polite">{spoken}</div>
          {found.kind === 'none' && <p className="guess__empty">No players found for “{text.trim()}”. Check the spelling, or try part of a nickname.</p>}
          {found.kind === 'guessed' && <p className="guess__empty">You've already guessed {found.nick}. Try someone else.</p>}
          <p className="guess__left">{left} guess{left === 1 ? '' : 'es'} left{hint && <> · Hint: one of their teams was {hint}</>}</p>
        </div>
      )}
      {/* The result of each guess as one sentence, said once, not cell by cell as the tiles turn (#127). */}
      <div className="sr" role="status" aria-live="polite">{announce}</div>

      {showEnd && (
        <>
          <div className={`guess__answer ${day.won ? 'is-won' : ''} ${announce ? 'is-in' : ''}`}>
            <span className="guess__photo"><Avatar player={{ id: answer.id, nick: answer.nick, roles: answer.roles, rating: 80, country: answer.country, portrait: answer.portrait }} roster={answer.rosters[answer.rosters.length - 1]} /></span>
            <div className="guess__about">
              <small className="guess__verdict">{day.won ? `Got it in ${day.guesses.length}` : "Today's pro was"}</small>
              <strong><Flag code={answer.country} size={20} decorative />{answer.nick}<em>{COUNTRY[answer.country] ?? answer.country}</em></strong>
              <span>{ROLE_LABEL[answer.role]} · {answer.majors} Major{answer.majors === 1 ? '' : 's'} in the game · best finish here {BEST_LABEL[answer.best].toLowerCase()}</span>
              <span className="guess__teams">{answer.orgs.map((org) => { const r = [...answer.rosters].reverse().find((x) => x.org === org)!; return <span key={org}><TeamBadge roster={r} size={22} />{org}</span>; })}</span>
            </div>
          </div>
          <div className="guess__after">
            <ShareBar text={() => guessShare(date, day, answer, all, pageUrl())} props={{ mode: 'guess', daily: dailyNumber(date) }} />
            <p className="guess__meta">
              {streak > 0 && <span className="guess__streak"><FlameIcon size={16} />{streak}-day streak</span>}
              <span>Next daily in {cd.clock}</span>
            </p>
            <button type="button" className="cta cta--orange guess__next" onClick={next.go}>{next.label}</button>
          </div>
        </>
      )}

      {help && <GuessHelp onClose={() => setHelp(false)} />}
    </section>
  );
}

/** One clue: the value, a mark that never depends on colour, and a description for screen readers and for hover. */
function ClueCell({ c, p, a, style }: { c: Clue; p: Pro; a: Pro; style?: React.CSSProperties }) {
  const said = `${CLUE_LABEL[c.key]}: ${namedFor(c)}. ${meaning(c, p, a)}.`;
  const arrow = c.dir ? (c.dir === 'up' ? '↑' : '↓') : '';
  let body: React.ReactNode;
  if (c.key === 'country') body = <><Flag code={p.country} size={16} decorative /><b>{p.country}</b></>;
  else if (c.key === 'orgs') {
    const t = teamsFor(p, a);
    body = (
      <>
        <span className="tbs">{t.shown.map((x) => <span key={x.org} className={`tb ${x.shared ? 'is-shared' : ''}`} title={x.org}><TeamBadge roster={x.roster} size={24} />{x.shared && <i aria-hidden="true">{CLUE_MARK.hit}</i>}</span>)}{t.more > 0 && <em>+{t.more}</em>}</span>
        {t.sharedCount === 0 && <small className="tbs__none">No shared team</small>}
      </>
    );
  } else if (c.key === 'role') body = <><span className="long">{ROLE_LABEL[p.role]}</span><span className="short">{ROLE_SHORT[p.role]}</span></>;
  else if (c.key === 'best') body = <><span className="long">{BEST_LABEL[p.best]}</span><span className="short">{BEST_SHORT[p.best]}</span>{arrow && <b className="arrow">{arrow}</b>}</>;
  else body = <>{c.text}{arrow && <b className="arrow">{arrow}</b>}</>;
  return (
    <span role="cell" className={`clue clue--${c.state} clue-${c.key}`} aria-label={said} title={said} style={style}>
      <span className="clue__val" aria-hidden="true">{body}</span>
      <i className="clue__mark" aria-hidden="true">{CLUE_MARK[c.state]}</i>
    </span>
  );
}

/** The same words the cell says to a screen reader, from the clue and, for teams, which ones are shared. */
function meaning(c: Clue, p: Pro, a: Pro): string {
  if (c.key === 'orgs') {
    const t = teamsFor(p, a);
    return c.state === 'hit' ? 'Same teams' : c.state === 'near' ? `Shares ${t.sharedCount} team${t.sharedCount === 1 ? '' : 's'}` : 'No shared team';
  }
  return clueMeaning(c);
}

/** The legend (#126): what the marks and arrows mean. Off the page until asked for, so the grid has the room. */
function GuessHelp({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="How Guess the pro works" onClose={onClose}>
      <h3>How Guess the pro works</h3>
      <p>One pro from Major history, the same for everyone today. You have {MAX_GUESSES} guesses: each shows how your pick compares with the answer.</p>
      <ul className="guess__legend" aria-label="What the marks mean">
        <li><span className="clue-key clue--hit" aria-hidden="true">{CLUE_MARK.hit}</span> Match</li>
        <li><span className="clue-key clue--near" aria-hidden="true">{CLUE_MARK.near}</span> Close</li>
        <li><span className="clue-key clue--miss" aria-hidden="true">{CLUE_MARK.miss}</span> No match</li>
        <li><span className="clue-key" aria-hidden="true">↑ ↓</span> The answer is higher or lower</li>
      </ul>
      <p className="muted small">Close means the same region, a role they also played, a year off, or a shared team. Shared teams are ticked. * Majors, best finish and first year count only the Major rosters in this game, not whole careers.</p>
    </Modal>
  );
}
