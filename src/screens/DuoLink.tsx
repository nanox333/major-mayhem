import React, { useMemo, useState } from 'react';
import { dailyNumber } from '../game/state';
import { DuoDay, DuoMode, DuoPuzzle, MAX_TRIES, MODE_LABEL, addPick, candidates, duoFor, duoPros, duoShare, duoStreak, emptyDay, lineupLabel, linksFor, loadDuo, normalizeDuoDay, optionsFor, saveDuo, sharedLineups } from '../game/duo';
import { Pro, searchState } from '../game/guess';
import { pageUrl } from '../game/share';
import { Avatar, TeamBadge } from '../ui/art';
import { Flag } from '../ui/flags';
import { ArrowRightIcon, FlameIcon, HelpIcon, SearchIcon } from '../ui/icons';
import radars from '../data/radars.json';
import { Tip } from '../ui/tips';
import { Modal } from '../ui/Modal';
import { play } from '../ui/sound';
import { useCountdown } from '../ui/useCountdown';
import { ShareBar } from './Final';
import { track } from '../analytics';

const photoOf = (p: Pro) => ({ id: p.id, nick: p.nick, roles: p.roles, rating: 80, country: p.country, portrait: p.portrait });
const lastRoster = (p: Pro) => p.rosters[p.rosters.length - 1];
const badgeRoster = (p: Pro, org: string) => [...p.rosters].reverse().find((r) => r.org === org)!;

/** One end of the chain: photo, nick, nation and the teams they played for (never roles or ratings). */
function Who({ p }: { p: Pro }) {
  return (
    <div className="duo__who">
      <span className="duo__photo"><Avatar player={photoOf(p)} roster={lastRoster(p)} /></span>
      <strong>{p.nick}</strong>
      <span className="duo__sub"><Flag code={p.country} size={16} decorative /><b>{p.country}</b></span>
      <span className="duo__orgs" aria-label={`Teams: ${p.orgs.join(', ')}`}>{p.orgs.slice(-3).map((org) => <span key={org} title={org}><TeamBadge roster={badgeRoster(p, org)} size={24} /></span>)}</span>
    </div>
  );
}

interface BoardProps {
  date: string;
  puzzle: DuoPuzzle;
  day: DuoDay;
  setDay: (d: DuoDay) => void;
  /** Seeds the Normal-mode cards: the date's for the daily, a random one for practice. */
  seed: string;
  practice: boolean;
  daily: number;
}

/** The puzzle and the way to answer it, for a daily or for a practice round. */
function Board({ date, puzzle, day, setDay, seed, practice, daily }: BoardProps) {
  const all = useMemo(() => duoPros(date), [date]);
  const links = useMemo(() => linksFor(date), [date]);
  const a = all.get(puzzle.a)!, b = all.get(puzzle.b)!;
  const options = useMemo(() => (day.mode === 'normal' ? optionsFor(date, puzzle, seed) : []), [day.mode, date, puzzle, seed]);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const [shake, setShake] = useState(false);
  const [announce, setAnnounce] = useState('');
  const left = MAX_TRIES - day.picks.length;
  const exclude = [...day.picks, puzzle.a, puzzle.b];
  const found = searchState(all, text, exclude);
  const choices = found.kind === 'results' ? found.options : [];
  const endNick = found.kind === 'guessed' && [a.nick, b.nick].includes(found.nick) ? found.nick : null;
  const spoken = found.kind === 'results' ? `${choices.length} player${choices.length === 1 ? '' : 's'} found` : found.kind === 'none' ? 'No players found' : '';

  const choose = (mode: DuoMode) => { setDay({ ...day, mode }); if (!practice) track('duo_mode', { daily, mode }); };
  const pick = (id: string) => {
    const next = addPick(day, id, puzzle);
    if (next === day) return;
    setDay(next); setText(''); setActive(0);
    const right = puzzle.connectors.includes(id);
    const nick = all.get(id)!.nick;
    play(right ? 'hit' : 'miss');
    if (next.done) play(next.won ? 'mapWin' : 'mapLose', { delay: 300 });
    setAnnounce(right ? `${nick}: correct. They played with both.` : `${nick}: not a connector.${next.done ? '' : ` ${MAX_TRIES - next.picks.length} ${MAX_TRIES - next.picks.length === 1 ? 'try' : 'tries'} left.`}`);
    if (!practice) {
      if (day.picks.length === 0) track('duo_start', { daily, mode: day.mode ?? 'normal' });
      if (next.done) track('duo_finish', { daily, mode: day.mode ?? 'normal', won: next.won, tries: next.picks.length });
    }
  };
  const submit = () => {
    if (choices[active]) return pick(choices[active].id);
    if (text.trim()) { setShake(true); setTimeout(() => setShake(false), 420); }
  };

  const rightIds = puzzle.connectors;
  return (
    <>
      <div className={`duo__chain ${day.won ? 'is-won' : ''}`} role="group" aria-label={`${a.nick} and ${b.nick}: name a pro who played with both`}>
        <Who p={a} />
        <span className="duo__link" aria-hidden="true" />
        <span className="duo__mid" aria-hidden="true"><b>{day.won ? '✓' : '?'}</b><small>{day.won ? 'Linked' : 'Link'}</small></span>
        <span className="duo__link" aria-hidden="true" />
        <Who p={b} />
      </div>

      {day.mode === null && !day.done && (
        <div className="duo__modes">
          <p className="duo__modes-t"><span>Choose your way in</span><small>Locked for today once you pick</small></p>
          <div className="duo__modes-row">
            <button type="button" className="duo__mode" data-sfx="none" onClick={() => choose('normal')}><span><b>Normal</b><small>Pick from four cards</small></span><ArrowRightIcon size={22} /></button>
            <button type="button" className="duo__mode duo__mode--hard" data-sfx="none" onClick={() => choose('hard')}><span><b>Hard 💀</b><small>Type the name yourself</small></span><ArrowRightIcon size={22} /></button>
          </div>
        </div>
      )}

      {day.mode && !day.done && (
        <>
          <p className="duo__state"><span className="duo__badge">{MODE_LABEL[day.mode]}{day.mode === 'hard' ? ' 💀' : ''}</span>
            <span className="guess__pips" aria-hidden="true">{Array.from({ length: MAX_TRIES }, (_, i) => <i key={i} className={i < left ? 'on' : ''} />)}</span>
            <span>{left} {left === 1 ? 'try' : 'tries'} left</span></p>

          {day.mode === 'normal' && (
            <div className="duo__cards" role="group" aria-label="Who played with both?">
              {options.map((id) => {
                const p = all.get(id)!;
                const struck = day.picks.includes(id);
                return (
                  <button key={id} type="button" className={`duo__card ${struck ? 'is-struck' : ''}`} disabled={struck} data-sfx="none" onClick={() => pick(id)}
                    aria-label={struck ? `${p.nick}, ${p.country}. Not a connector.` : `${p.nick}, ${p.country}`}>
                    <span className="duo__cphoto"><Avatar player={photoOf(p)} roster={lastRoster(p)} /></span>
                    <span className="duo__ctext"><strong>{p.nick}</strong><span className="duo__sub"><Flag code={p.country} size={14} decorative /><b>{p.country}</b></span></span>
                    {struck && <span className="duo__x" aria-hidden="true">✗<small>Not a connector</small></span>}
                  </button>
                );
              })}
            </div>
          )}

          {day.mode === 'hard' && (
            <div className={`guess__bar ${shake ? 'is-shake' : ''}`}>
              <div className="guess__entry">
                <div className="guess__box">
                  <SearchIcon size={20} />
                  <input value={text} onChange={(e) => { setText(e.target.value); setActive(0); }} placeholder="Who played with both?"
                    aria-label={`Try ${day.picks.length + 1} of ${MAX_TRIES}: type a player's name`} autoComplete="off" spellCheck={false}
                    role="combobox" aria-autocomplete="list" aria-expanded={choices.length > 0} aria-controls="duo-options"
                    aria-activedescendant={choices.length ? `duo-option-${active}` : undefined}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((x) => Math.min(x + 1, choices.length - 1)); }
                      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((x) => Math.max(x - 1, 0)); }
                      if (e.key === 'Enter') { e.preventDefault(); submit(); }
                      if (e.key === 'Escape' && text) { e.preventDefault(); setText(''); setActive(0); }
                    }} />
                  {choices.length > 0 && (
                    <ul className="guess__suggest" id="duo-options" role="listbox" aria-label="Matching players">
                      {choices.map((p, i) => (
                        <li key={p.id} role="presentation">
                          <button role="option" id={`duo-option-${i}`} aria-selected={i === active} tabIndex={-1} className={i === active ? 'is-on' : ''} data-sfx="none" onClick={() => pick(p.id)}>
                            <b>{p.nick}</b><small>{p.country} · {p.orgs.slice(-1)[0]}</small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button type="button" className="cta cta--orange guess__go" data-sfx="none" disabled={!choices[active]} onClick={submit}>Try</button>
              </div>
              <div className="sr" role="status" aria-live="polite">{spoken}</div>
              {found.kind === 'none' && <p className="guess__empty">No players found for “{text.trim()}”. Check the spelling, or try part of a nickname.</p>}
              {found.kind === 'guessed' && <p className="guess__empty">{endNick ? `${endNick} is one of the two ends. Name someone in between.` : `You've already tried ${found.nick}.`}</p>}
            </div>
          )}

          {day.mode === 'hard' && day.picks.length > 0 && (
            <ul className="duo__misses" aria-label="Your tries so far">
              {day.picks.map((id) => <li key={id}><i aria-hidden="true">✗</i><b>{all.get(id)!.nick}</b><span>Not linked to both in this game's data</span></li>)}
            </ul>
          )}
        </>
      )}
      <div className="sr" role="status" aria-live="polite">{announce}</div>

      {day.done && (
        <div className={`duo__reveal ${day.won ? 'is-won' : ''}`}>
          <small className="guess__verdict">{day.won ? `Linked in ${day.picks.length} ${day.picks.length === 1 ? 'try' : 'tries'}` : 'Nobody you named played with both. These did:'}</small>
          <ul className="duo__answers">
            {rightIds.map((id) => {
              const p = all.get(id)!;
              const chosen = day.picks.includes(id);
              return (
                <li key={id} className={chosen ? 'is-chosen' : ''}>
                  <span className="duo__cphoto"><Avatar player={photoOf(p)} roster={lastRoster(p)} /></span>
                  <div>
                    <strong><Flag code={p.country} size={16} decorative />{p.nick}{chosen && <i aria-hidden="true"> ✓</i>}</strong>
                    <span>With <b>{a.nick}</b>: {sharedLineups(links, id, a.id).map(lineupLabel).join(', ')}</span>
                    <span>With <b>{b.nick}</b>: {sharedLineups(links, id, b.id).map(lineupLabel).join(', ')}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          {rightIds.length > 1 && !day.won && <p className="duo__note">Any of them counts.</p>}
        </div>
      )}
    </>
  );
}

/** The faceless pair over the title: two silhouettes joined through a question mark, in the same box as Guess the pro's. */
function DuoMark() {
  return (
    <svg className="gp__sil duo__mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="14" cy="22" r="7" fill="currentColor" /><path d="M3 50c0-9 5-13 11-13s11 4 11 13z" fill="currentColor" />
      <circle cx="50" cy="22" r="7" fill="currentColor" /><path d="M39 50c0-9 5-13 11-13s11 4 11 13z" fill="currentColor" />
      <rect x="23" y="16" width="18" height="26" rx="2" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" />
      <text x="32" y="36" textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--accent)">?</text>
    </svg>
  );
}

export function DuoScreen({ next }: { next: { label: string; go: () => void } }) {
  const cd = useCountdown();
  const date = cd.day;
  const all = useMemo(() => duoPros(date), [date]);
  const puzzle = useMemo(() => duoFor(date), [date]);
  const [store, setStore] = useState(loadDuo);
  const day = useMemo(() => normalizeDuoDay(store[date], all, puzzle), [store, date, all, puzzle]);
  const [practice, setPractice] = useState<{ puzzle: DuoPuzzle; seed: string; day: DuoDay } | null>(null);
  const [help, setHelp] = useState(false);
  const streak = duoStreak(store, date);
  const n = dailyNumber(date);
  const maps = Object.keys(radars as Record<string, string>);
  const radar = (radars as Record<string, string>)[maps[(n + 3) % maps.length]];

  const setDay = (d: DuoDay) => { const s = { ...store, [date]: d }; setStore(s); saveDuo(s); };
  const startPractice = () => {
    const list = candidates(date).filter((c) => c.a !== puzzle.a || c.b !== puzzle.b);
    const c = list[Math.floor(Math.random() * list.length)];
    setPractice({ puzzle: c, seed: `practice-${Math.random().toString(36).slice(2)}`, day: emptyDay() });
  };

  return (
    <section className="gp duo" style={{ ['--radar' as string]: `url(${radar})` }} aria-labelledby="duo-title">
      <div className="gp__bg" aria-hidden="true" />
      <header className="gp__head">
        <DuoMark />
        <div className="gp__titles">
          <p className="gp__kicker">{practice ? 'Practice · not scored' : `Daily #${n}`}</p>
          <h2 id="duo-title" className="gp__title">Duo <span>Link</span></h2>
          <p className="gp__sub">Name a pro who played with both.</p>
        </div>
        <button type="button" className="gp__help" onClick={() => setHelp(true)} aria-label="How Duo Link works" data-sfx="none"><HelpIcon size={22} /></button>
      </header>

      <Tip id="duo" title="How Duo Link works">
        <p className="tip-lead">Two pros never shared a Major lineup. Name someone who played with both.</p>
        <ul className="tip-legend">
          <li className="is-hit"><i>✓</i><b>Normal</b><span>Pick from four cards</span></li>
          <li className="is-near"><i>💀</i><b>Hard</b><span>Type the name yourself</span></li>
          <li className="is-miss"><i>✗</i><b>Three tries</b><span>A wrong answer is struck out</span></li>
        </ul>
        <p className="tip-foot">Played with = the same Major lineup in this game's data.</p>
      </Tip>

      {practice
        ? <Board key={practice.seed} date={date} puzzle={practice.puzzle} day={practice.day} setDay={(d) => setPractice({ ...practice, day: d })} seed={practice.seed} practice daily={n} />
        : <Board key={date} date={date} puzzle={puzzle} day={day} setDay={setDay} seed={`duo-opts-${date}`} practice={false} daily={n} />}

      {(practice ? practice.day.done : day.done) && (
        <div className="guess__after">
          {!practice && <ShareBar text={() => duoShare(date, day, pageUrl())} props={{ mode: 'duo', daily: n }} />}
          {!practice && (
            <p className="guess__meta">
              {streak > 0 && <span className="guess__streak"><FlameIcon size={16} />{streak}-day streak</span>}
              <span>Next daily in {cd.clock}</span>
            </p>
          )}
          <button type="button" className="cta cta--orange guess__next" onClick={startPractice}>{practice ? 'Another practice pair' : 'Practice another pair'}</button>
          {practice && <button type="button" className="ghost-btn" onClick={() => setPractice(null)}>Back to today</button>}
          {!practice && <button type="button" className="ghost-btn" onClick={next.go}>{next.label}</button>}
        </div>
      )}

      {help && <DuoHelp onClose={() => setHelp(false)} />}
    </section>
  );
}

function DuoHelp({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="How Duo Link works" onClose={onClose} wide>
      <div className="gh">
        <header className="gh__head">
          <span className="gh__kick">Guide</span>
          <h3>How Duo Link works</h3>
          <p>Two pros never shared a Major lineup. One pro played with both of them. Name that pro in {MAX_TRIES} tries. Everyone gets the same pair today.</p>
        </header>
        <h4 className="gh__title">Two ways to play</h4>
        <dl className="gh__cols">
          <div className="gh__col"><dt>Normal</dt><dd><span>Four cards: one is right and three are not. A wrong card is struck out.</span></dd></div>
          <div className="gh__col"><dt>Hard 💀</dt><dd><span>No cards. Type the name yourself. Any pro who played with both counts.</span></dd></div>
        </dl>
        <p className="gh__note">Pick one before your first try. It stays for the day, because seeing the cards would give the answer away. There is one streak, and your share line says which way you played.</p>
        <h4 className="gh__title">What counts as "played with"</h4>
        <p className="gh__note">Being on the same Major lineup in this game's data, not whole careers. Two pros who shared a team between Majors are not linked here. A player on the lineup that went out in the quarterfinals counts too.</p>
      </div>
    </Modal>
  );
}
