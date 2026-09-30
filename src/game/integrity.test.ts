import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as G from './logic';
import { ROSTERS, isCoach } from '../data/rosters';
import { coachBonus } from './synergy';
import { Run, fresh, parseRun, reducer, roundOf, validRun } from './state';
import { addAbandon, addRun, emptyStats, forgetStats, isPractice, loadStats, recordDuel, recordRun, sanitizeStats } from './stats';
import { GuessDay, MAX_GUESSES, normalizeDay, sanitizeGuesses } from './guess';
import { decodeDuel, duelFrom, encodeDuel, validDuel } from './duel';
import { isRealDate } from './dates';
import { applyBackup, createBackup, previewBackup } from './backup';
import { shareText } from './share';

// Saves, records and links (#162 to #165, #170, #189): what is written to the browser is only used when it is what the game expects.

function vetoAll(s: Run): Run {
  const oppL = G.naturalLineup(G.rosterById.get(s.current!.opponentId)!);
  while (G.vetoTurn(s.current!.veto)) s = reducer(s, { type: 'veto', map: G.vetoChoice(s.current!.veto, 'us', G.lineupFromPicks(s.picks), oppL) });
  return s;
}
function draftThrough(start: Run): Run {
  let s = start;
  for (let n = 0; s.phase === 'draft' && n < 20; n++) {
    s = reducer(s, { type: 'spin' });
    const round = roundOf(s);
    if (round === 'coach') { s = reducer(s, { type: 'coach', rosterId: s.offer[0] }); continue; }
    if (round === 'bench') {
      s = reducer(s, { type: 'team', id: s.offer[0] });
      const taken = G.draftedIds(s.picks);
      s = reducer(s, { type: 'bench', player: G.rosterById.get(s.offer[0])!.players.find((p) => !taken.has(p.id))! });
      continue;
    }
    const r = G.rosterById.get(s.offer.find((id) => G.rosterEligible(G.rosterById.get(id)!, s.picks))!)!;
    s = reducer(s, { type: 'team', id: r.id });
    const p = r.players.find((x) => G.eligibleSlots(x, s.picks).length)!;
    s = reducer(s, { type: 'draft', player: p, slot: G.eligibleSlots(p, s.picks)[0] });
  }
  return s;
}
/** Every state a run passes through, from the first case to the results, as the game would have saved it. */
function everyState(start: Run): Run[] {
  const seen: Run[] = [start];
  let s = start;
  const step = (next: Run) => { s = next; seen.push(s); };
  for (let n = 0; s.phase === 'draft' && n < 20; n++) {
    step(reducer(s, { type: 'spin' }));
    const round = roundOf(s);
    if (round === 'coach') { step(reducer(s, { type: 'coach', rosterId: s.offer[0] })); continue; }
    if (round === 'bench') {
      step(reducer(s, { type: 'team', id: s.offer[0] }));
      const taken = G.draftedIds(s.picks);
      step(reducer(s, { type: 'bench', player: G.rosterById.get(s.offer[0])!.players.find((p) => !taken.has(p.id))! }));
      continue;
    }
    const r = G.rosterById.get(s.offer.find((id) => G.rosterEligible(G.rosterById.get(id)!, s.picks))!)!;
    step(reducer(s, { type: 'team', id: r.id }));
    const p = r.players.find((x) => G.eligibleSlots(x, s.picks).length)!;
    step(reducer(s, { type: 'draft', player: p, slot: G.eligibleSlots(p, s.picks)[0] }));
  }
  step(reducer(s, { type: 'play' }));
  while (s.phase !== 'final') {
    step(reducer(s, { type: 'start' }));
    step(vetoAll(s));
    while (!s.current!.done) step(reducer(s, { type: 'side', side: G.autoSide(s.current!.next!) }));
    step(reducer(s, { type: 'next' }));
  }
  return seen;
}
const play = (start: Run) => everyState(start).at(-1)!;
const through = (r: unknown) => JSON.parse(JSON.stringify(r));

describe('a daily that was already played is practice (#162)', () => {
  it('counts the first attempt and nothing after it: no tally, streak or achievement moves', () => {
    const first = play(fresh('daily', '2026-10-01'));
    const again = play(fresh('daily', '2026-10-01'));
    expect(first.attempt).not.toBe(again.attempt);
    const one = addRun(emptyStats(), first);
    const two = addRun(one, again);
    expect(one.runs).toBe(1);
    expect(one.daily['2026-10-01'].attempt).toBe(first.attempt);
    expect(two).toEqual({ ...one, attempts: [...one.attempts!, again.attempt], lastNew: [] });
    expect(two.runs).toBe(1);
    expect(two.byMode!.daily.runs).toBe(1);
    expect(isPractice(one, again)).toBe(true);
    expect(isPractice(one, first)).toBe(false);
  });
  it('cannot turn an abandoned daily into a scored result', () => {
    const gone = reducer(fresh('daily', '2026-10-02'), { type: 'spin' });
    const st = addAbandon(emptyStats(), gone);
    expect(st.daily['2026-10-02'].abandoned).toBe(true);
    const replay = play(fresh('daily', '2026-10-02'));
    const after = addRun(st, replay);
    expect(after.runs).toBe(0);
    expect(after.daily['2026-10-02'].abandoned).toBe(true);
    expect(isPractice(st, replay)).toBe(true);
  });
  it('still counts free play, and a daily of another day', () => {
    const a = addRun(emptyStats(), play(fresh('free')));
    const b = addRun(a, play(fresh('free')));
    const c = addRun(b, play(fresh('daily', '2026-10-03')));
    expect([a.runs, b.runs, c.runs]).toEqual([1, 2, 3]);
  });
  it('treats a result from before attempts were tracked as already played', () => {
    const legacy = { ...emptyStats(), runs: 1, daily: { '2026-10-04': { placement: 'Champions', reached: 4, mvp: 'x', grade: 0.9 } } };
    expect(addRun(legacy, play(fresh('daily', '2026-10-04'))).runs).toBe(1);
  });
  it('is shared as practice, not as a new scored attempt', () => {
    const run = play(fresh('daily', '2026-10-05'));
    expect(shareText(run).split('\n')[0]).toMatch(/^Major Mayhem Daily #8 /);
    expect(shareText(run, undefined, true).split('\n')[0]).toMatch(/^Major Mayhem Daily #8 \(practice\) /);
  });
});

describe('a result counts once (#163)', () => {
  beforeEach(() => { forgetStats(); });
  afterEach(() => { forgetStats(); vi.unstubAllGlobals(); });
  it('ignores the same free-play or duel result arriving twice', () => {
    const run = play(fresh('free'));
    const once = addRun(emptyStats(), run);
    expect(addRun(once, run)).toBe(once);
    const free = recordRun(run);
    expect(recordRun(run)).toEqual(free);
    expect(free.runs).toBe(1);
  });
  it('does not count a result again when the run was not marked recorded after a stats write', () => {
    // The stats write succeeded and the run save did not: the run comes back unrecorded, and recording it again changes nothing.
    const run = play(fresh('free'));
    const first = recordRun(run);
    const reloaded = { ...run, recorded: false };
    expect(recordRun(reloaded)).toEqual(first);
    expect(loadStats().runs).toBe(1);
  });
  it('keeps the session totals consistent when the browser will not save', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} });
    const a = recordRun(play(fresh('free')));
    const b = recordRun(play(fresh('free')));
    expect([a.runs, b.runs]).toEqual([1, 2]);
  });
  it('records a duel once', () => {
    const base = play(fresh('free'));
    const duelRun: Run = { ...base, mode: 'duel', t: { ...base.t, duel: true } };
    const once = recordDuel(duelRun);
    expect(recordDuel(duelRun)).toEqual(once);
    expect(once.duels.w + once.duels.l).toBe(1);
  });
});

describe('damaged records are recovered, not crashed on (#164)', () => {
  it('keeps what is valid in a record and drops what is not', () => {
    expect(sanitizeStats({ v: 1, daily: null })).toEqual(emptyStats());
    const s = sanitizeStats({
      v: 1, runs: 5, titles: 'two', reached: [1, 2, 3], streak: -4, drafted: { a: 2, b: 'x', c: -1 },
      daily: { '2026-10-01': { placement: 'Champions', reached: 4, mvp: 'x', grade: 0.9 }, 'not-a-date': { placement: 'x', reached: 0, mvp: 'y', grade: null }, '2026-10-02': 'nope', '2026-10-03': { placement: 7 } },
      ach: { good: '2026-10-01', bad: 3 }, duels: { w: 2, l: 'many' }, lastNew: ['a', 4],
    });
    expect(s.runs).toBe(5);
    expect(s.titles).toBe(0);
    expect(s.reached).toEqual([0, 0, 0, 0, 0]);
    expect(s.streak).toBe(0);
    expect(s.drafted).toEqual({ a: 2 });
    expect(Object.keys(s.daily)).toEqual(['2026-10-01']);
    expect(s.ach).toEqual({ good: '2026-10-01' });
    expect(s.duels).toEqual({ w: 2, l: 0 });
    expect(s.lastNew).toEqual(['a']);
  });
  it('treats a non-record as an empty one', () => {
    for (const bad of [null, 'text', 42, [], { v: 2 }]) expect(sanitizeStats(bad)).toEqual(emptyStats());
  });
  it('drops malformed Guess days and unknown players', () => {
    const g = sanitizeGuesses({ '2026-10-01': { guesses: ['a', 'a', 3, 'b'], done: 'yes', won: true }, nope: { guesses: [] }, '2026-10-02': { guesses: 'x' }, '2026-10-03': null });
    expect(Object.keys(g)).toEqual(['2026-10-01']);
    expect(g['2026-10-01']).toEqual({ guesses: ['a', 'b'], done: false, won: true });
    expect(sanitizeGuesses('text')).toEqual({});
  });
  it('works out won and done from the guesses and the answer, not from the save', () => {
    const known = new Set(['a', 'b', 'c', 'ans']);
    const claimed: GuessDay = { guesses: ['a', 'ghost', 'ans', 'b'], done: false, won: false };
    expect(normalizeDay(claimed, known, 'ans')).toEqual({ guesses: ['a', 'ans'], done: true, won: true });
    expect(normalizeDay({ guesses: ['ghost'], done: true, won: true }, known, 'ans')).toEqual({ guesses: [], done: false, won: false });
    expect(normalizeDay(undefined, known, 'ans')).toEqual({ guesses: [], done: false, won: false });
    const eight = ['a', 'b', 'c', 'a', 'b', 'c', 'a', 'b', 'c'];
    expect(normalizeDay({ guesses: eight, done: false, won: false }, known, 'ans').guesses).toHaveLength(MAX_GUESSES);
  });
});

describe('a saved run is only used when it is a whole, legal run (#165)', () => {
  it('accepts every state a real run passes through, so legitimate saves still resume', () => {
    for (const start of [fresh('daily', '2026-10-06'), fresh('free'), fresh('free', undefined, { hard: true }), fresh('free', undefined, { era: 'cs2' })]) {
      for (const s of everyState(start)) {
        expect(validRun(through(s)), `${s.phase}/${s.step}`).toBe(true);
        expect(parseRun(JSON.stringify(s))).not.toBeNull();
      }
    }
  });
  it('rejects the reproduced bad enums, a null seed, and the same person in two slots', () => {
    const s = fresh();
    expect(validRun({ ...s, mode: 'invalid', phase: 'invalid', step: 'invalid', seed: null })).toBe(false);
    for (const bad of [{ mode: 'x' }, { phase: 'x' }, { step: 'x' }, { seed: null }, { seed: 7 }, { rerolls: -1 }, { rerolls: 1.5 }, { offerKey: 'a' }, { recorded: 'yes' }, { attempt: 4 }]) {
      expect(validRun({ ...s, ...bad }), JSON.stringify(bad)).toBe(false);
    }
    const r = ROSTERS[0];
    const p = r.players[0];
    const twice = { ...s, picks: [{ slot: 'IGL', rosterId: r.id, playerId: p.id }, { slot: 'AWP', rosterId: r.id, playerId: p.id }] };
    expect(validRun(twice)).toBe(false);
  });
  it('rejects a daily whose seed is not a real date, and a free run that claims to be a daily', () => {
    expect(validRun({ ...fresh('daily', '2026-10-06'), seed: 'daily-2026-99-99' })).toBe(false);
    expect(validRun({ ...fresh('daily', '2026-10-06'), seed: 'free-abc' })).toBe(false);
    expect(validRun({ ...fresh('free'), seed: 'daily-2026-10-06' })).toBe(false);
  });
  it('rejects a run whose state does not agree with its phase, and malformed match state', () => {
    const done = play(fresh('free'));
    expect(validRun(through({ ...done, phase: 'preview', pending: null }))).toBe(false);
    expect(validRun(through({ ...done, phase: 'live', current: null }))).toBe(false);
    expect(validRun(through({ ...done, t: { ...done.t, status: 'running' } }))).toBe(false);
    expect(validRun(through({ ...done, t: { ...done.t, matches: [{ stage: 'QUAL' }] } }))).toBe(false);
    expect(validRun(through({ ...done, t: { ...done.t, qual: null } }))).toBe(false);
    const live = everyState(fresh('free')).find((x) => x.phase === 'live')!;
    expect(validRun(through(live))).toBe(true);
    expect(validRun(through({ ...live, current: { ...live.current, veto: 'nope' } }))).toBe(false);
    expect(validRun(through({ ...live, current: { ...live.current, maps: [{ map: 3 }] } }))).toBe(false);
    expect(validRun(through({ ...live, pending: { stage: 'XX', oppId: live.current!.opponentId } }))).toBe(false);
  });
  it('still resumes a save from before attempts, vetoes and coaches existed', () => {
    const s = through(fresh('free'));
    delete s.attempt; delete s.extras; delete s.coach; delete s.bench; delete s.rules;
    const back = parseRun(JSON.stringify(s));
    expect(back).not.toBeNull();
    expect(back!.attempt).toBeTruthy();
    const old = through(play(fresh('free')));
    delete old.extras;
    for (const m of old.t.matches) { delete m.veto; delete m.pool; delete m.next; }
    expect(validRun(old)).toBe(true);
  });
  it('gives a save from before attempts one, so it can be counted once', () => {
    const s = through(fresh('free'));
    delete s.attempt;
    expect(parseRun(JSON.stringify(s))!.attempt).toMatch(/\w+-\w+/);
  });
});

describe('challenge links are checked as data (#170)', () => {
  const run = play(fresh('free'));
  const base = duelFrom(run, 'Ana');
  const code = (d: object) => encodeDuel(d as never);
  it('still decodes a valid link, dated or not', () => {
    expect(decodeDuel(code(base))).not.toBeNull();
    const daily = duelFrom(play(fresh('daily', '2026-10-01')), 'Bo');
    expect(daily.date).toBe('2026-10-01');
    expect(decodeDuel(code(daily))).not.toBeNull();
  });
  it('rejects names that are not coaches, even ones every object has', () => {
    for (const coach of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'Nobody', 7, {}, ['zonic']]) {
      expect(decodeDuel(code({ ...base, coach })), String(coach)).toBeNull();
    }
    expect(isCoach('constructor')).toBe(false);
    expect(coachBonus('constructor')).toBe(0);
  });
  it('rejects impossible dates and a date that disagrees with the seed', () => {
    const daily = duelFrom(play(fresh('daily', '2026-10-01')), 'Bo');
    for (const date of ['2026-99-99', '2026-02-30', '2026-10-1', 'yesterday', 20261001]) expect(decodeDuel(code({ ...daily, date })), String(date)).toBeNull();
    expect(decodeDuel(code({ ...daily, date: '2026-10-02' }))).toBeNull();
    expect(decodeDuel(code({ ...base, seed: 'daily-2026-10-01' }))).toBeNull();
  });
  it('checks a saved duel run the same way', () => {
    expect(validDuel(base)).toBe(true);
    expect(validDuel({ ...base, coach: 'constructor' })).toBe(false);
    expect(validRun({ ...fresh('free'), mode: 'duel' })).toBe(false);
  });
  it('knows a real calendar date', () => {
    expect(isRealDate('2026-02-28')).toBe(true);
    expect(isRealDate('2028-02-29')).toBe(true);
    expect(isRealDate('2026-02-29')).toBe(false);
    expect(isRealDate('2026-13-01')).toBe(false);
  });
});

describe('backup and restore (#189)', () => {
  let store: Record<string, string>;
  beforeEach(() => {
    store = {};
    forgetStats();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } });
  });
  afterEach(() => { forgetStats(); vi.unstubAllGlobals(); });
  it('round-trips a record, Guess history and one open run', () => {
    const run = draftThrough(fresh('daily', '2026-10-07'));
    const stats = addRun(emptyStats(), play(fresh('free')));
    store['major-mayhem-stats-v1'] = JSON.stringify(stats);
    store['major-mayhem-guess-v1'] = JSON.stringify({ '2026-10-01': { guesses: ['a'], done: false, won: false } });
    store['major-mayhem-run-v2'] = JSON.stringify(run);
    const text = JSON.stringify(createBackup());
    store = {}; forgetStats();
    const pv = previewBackup(text);
    expect(pv.ok).toBe(true);
    if (!pv.ok) return;
    expect(pv.summary).toMatchObject({ runs: 1, guessDays: 1 });
    expect(pv.summary.run).toMatch(/Daily 2026-10-07/);
    expect(applyBackup(pv.backup)).toBe(true);
    expect(JSON.parse(store['major-mayhem-stats-v1']).runs).toBe(1);
    expect(JSON.parse(store['major-mayhem-run-v2']).seed).toBe('daily-2026-10-07');
    expect(Object.keys(JSON.parse(store['major-mayhem-guess-v1']))).toEqual(['2026-10-01']);
  });
  it('refuses a file that is not a backup, or has a record or run it cannot read, and changes nothing', () => {
    const good = createBackup();
    const bad = [
      'not json', '{}', JSON.stringify({ ...good, app: 'other' }), JSON.stringify({ ...good, format: 9 }),
      JSON.stringify({ ...good, stats: { v: 2 } }), JSON.stringify({ ...good, guess: null }),
      JSON.stringify({ ...good, run: { v: 3, mode: 'nope' } }), JSON.stringify({ ...good, raw: true }),
    ];
    for (const text of bad) expect(previewBackup(text).ok, text.slice(0, 40)).toBe(false);
    expect(Object.keys(store)).toEqual([]);
  });
  it('puts back what was there when a write fails part-way', () => {
    store['major-mayhem-stats-v1'] = JSON.stringify(emptyStats());
    const pv = previewBackup(JSON.stringify(createBackup()));
    if (!pv.ok) throw new Error('preview');
    let writes = 0;
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { if (++writes === 2) throw new Error('quota'); store[k] = v; }, removeItem: (k: string) => { delete store[k]; } });
    const before = { ...store };
    expect(applyBackup(pv.backup)).toBe(false);
    expect(store['major-mayhem-stats-v1']).toBe(before['major-mayhem-stats-v1']);
  });
});
