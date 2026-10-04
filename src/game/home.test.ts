import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { achievementCount, bestFinish, clockText, dailyButton, dailyPanel, homeState, howExpanded, msUntilMidnight, replaceRisk, runWhere, spokenLeft } from './home';
import { Run, fresh, reducer } from './state';
import { emptyStats } from './stats';

const DAY = '2026-10-01';
const started = (mode: 'daily' | 'free', date = DAY) => reducer(fresh(mode, mode === 'daily' ? date : undefined), { type: 'spin' });

describe('the home you get (#115)', () => {
  it('is the first visit with no record and no run', () => {
    expect(homeState(fresh('daily', DAY), emptyStats(), DAY)).toEqual({ daily: 'new', freeInProgress: false, oldRun: null, first: true });
  });
  it('is a daily in progress once a case is open', () => {
    const h = homeState(started('daily'), emptyStats(), DAY);
    expect(h.daily).toBe('progress');
    expect(h.first).toBe(false);
  });
  it('shows a saved daily from an earlier day as that day, and not as today (#183)', () => {
    const h = homeState(started('daily', DAY), emptyStats(), '2026-10-02');
    expect(h.daily).toBe('new');
    expect(h.oldRun).toEqual({ date: DAY, n: 4 });
    expect(homeState(started('daily', DAY), emptyStats(), DAY).oldRun).toBeNull();
    // Today's result still decides today's state, whatever the old run is.
    const done = { ...emptyStats(), runs: 1, daily: { '2026-10-02': { placement: 'Champions', reached: 4, mvp: 'x', grade: 0.9 } } };
    expect(homeState(started('daily', DAY), done, '2026-10-02')).toMatchObject({ daily: 'done', oldRun: { date: DAY } });
  });
  it('says what starting another run would throw away, the same way for every entry point (#182)', () => {
    const none = homeState(fresh('free'), emptyStats(), DAY);
    expect(replaceRisk(none, fresh('free'))).toBeNull();
    const old = homeState(started('daily', DAY), emptyStats(), '2026-10-02');
    expect(replaceRisk(old, started('daily', DAY))).toMatch(/Daily #4 \(2026-10-01\) is unfinished.*abandons it/);
    const today = homeState(started('daily', DAY), emptyStats(), DAY);
    expect(replaceRisk(today, started('daily', DAY))).toMatch(/Today's daily is under way/);
    const free = started('free');
    expect(replaceRisk(homeState(free, emptyStats(), DAY), free)).toMatch(/free run \(round 1 of 7\) would be replaced/);
  });
  it('shows today finished or abandoned from the stats', () => {
    const done = { ...emptyStats(), runs: 1, daily: { [DAY]: { placement: 'Champions', reached: 4, mvp: 'donk', grade: 0.9 } } };
    expect(homeState(fresh('daily', DAY), done, DAY).daily).toBe('done');
    const gone = { ...emptyStats(), daily: { [DAY]: { placement: 'Abandoned', reached: 0, mvp: '–', grade: null, abandoned: true } } };
    expect(homeState(fresh('daily', DAY), gone, DAY).daily).toBe('abandoned');
    expect(homeState(fresh('daily', DAY), done, '2026-10-02').daily).toBe('new');
  });
  it('knows a free run in progress, and that a fresh free run is not one', () => {
    expect(homeState(started('free'), emptyStats(), DAY)).toMatchObject({ daily: 'new', freeInProgress: true });
    expect(homeState(fresh('free'), emptyStats(), DAY).freeInProgress).toBe(false);
  });
  it('lets a draft duel under way be continued from the Home, and asks before replacing it (#222)', () => {
    const duel = { ...started('free'), mode: 'duel', duel: { name: 'Ann' } } as unknown as Run;
    const h = homeState(duel, emptyStats(), DAY);
    expect(h.freeInProgress).toBe(true);
    expect(replaceRisk(h, duel)).toMatch(/draft duel against Ann/);
  });
  it('says where a run is', () => {
    expect(runWhere(started('daily'))).toBe('round 1 of 7');
    expect(runWhere({ ...started('daily'), phase: 'ready' })).toBe('in the lobby');
    expect(runWhere({ ...started('daily'), phase: 'live' })).toBe('in the Major');
  });
});

describe('best finish and achievements (#118)', () => {
  const st = (reached: number[]) => ({ runs: reached.reduce((a, b) => a + b, 0), reached: reached as [number, number, number, number, number] });
  it('is nothing before the first finished run', () => {
    expect(bestFinish(st([0, 0, 0, 0, 0]))).toBeNull();
  });
  it('words every stage as a placement', () => {
    expect(bestFinish(st([3, 0, 0, 0, 0]))).toBe('Out in the Swiss stage');
    expect(bestFinish(st([3, 1, 0, 0, 0]))).toBe('5th–8th place');
    expect(bestFinish(st([3, 1, 1, 0, 0]))).toBe('3rd–4th place');
    expect(bestFinish(st([3, 1, 1, 1, 0]))).toBe('2nd place');
    expect(bestFinish(st([3, 1, 1, 1, 1]))).toBe('1st place');
  });
  it('takes the furthest stage, not the most recent', () => {
    expect(bestFinish(st([0, 0, 0, 1, 0]))).toBe('2nd place');
  });
  it('counts achievements out of the ones that exist', () => {
    expect(achievementCount({ ach: {} })).toEqual({ earned: 0, total: ACHIEVEMENTS.length });
    expect(achievementCount({ ach: { [ACHIEVEMENTS[0].id]: DAY, 'gone-in-a-later-version': DAY } })).toEqual({ earned: 1, total: ACHIEVEMENTS.length });
  });
});

describe('the daily countdown (#117)', () => {
  it('counts to the next local midnight', () => {
    expect(msUntilMidnight(new Date(2026, 9, 1, 23, 59, 59, 0))).toBe(1000);
    expect(msUntilMidnight(new Date(2026, 9, 1, 12, 0, 0, 0))).toBe(12 * 3600000);
    // At exactly midnight the next daily is a whole day away, not zero.
    expect(msUntilMidnight(new Date(2026, 9, 2, 0, 0, 0, 0))).toBe(24 * 3600000);
  });
  it('writes the clock as HH:MM:SS', () => {
    expect(clockText(1000)).toBe('00:00:01');
    expect(clockText((23 * 3600 + 14 * 60 + 27) * 1000)).toBe('23:14:27');
    expect(clockText(-5)).toBe('00:00:00');
  });
  it('says the time for a screen reader by the hour, then by the minute, never by the second', () => {
    expect(spokenLeft(7 * 3600000 + 3 * 60000 + 59000)).toBe('Next daily in 7 hours');
    expect(spokenLeft(7 * 3600000 + 3 * 60000 + 58000)).toBe(spokenLeft(7 * 3600000 + 3 * 60000 + 5000));
    expect(spokenLeft(3600000)).toBe('Next daily in 1 hour');
    expect(spokenLeft(59 * 60000 + 30000)).toBe('Next daily in 60 minutes');
    expect(spokenLeft(43 * 60000 - 1000)).toBe('Next daily in 43 minutes');
    expect(spokenLeft(30000)).toBe('Next daily in less than a minute');
  });

  // Daylight saving: the day the clocks change is 23 or 25 hours long. These run in a zone that changes them.
  describe('across a daylight-saving change', () => {
    const was = process.env.TZ;
    beforeAll(() => { process.env.TZ = 'Europe/Copenhagen'; });
    afterAll(() => { if (was === undefined) delete process.env.TZ; else process.env.TZ = was; });
    it('counts a 23 hour day when the clocks go forward', () => {
      expect(msUntilMidnight(new Date(2026, 2, 29, 0, 0, 0, 0))).toBe(23 * 3600000);
    });
    it('counts a 25 hour day when the clocks go back', () => {
      expect(msUntilMidnight(new Date(2026, 9, 25, 0, 0, 0, 0))).toBe(25 * 3600000);
    });
    it('is still an ordinary day either side', () => {
      expect(msUntilMidnight(new Date(2026, 2, 28, 0, 0, 0, 0))).toBe(24 * 3600000);
      expect(msUntilMidnight(new Date(2026, 2, 30, 0, 0, 0, 0))).toBe(24 * 3600000);
    });
  });
});

describe('the daily card and panel say different things (#150)', () => {
  const done = { placement: 'Semifinals' };
  const st = (daily: 'new' | 'progress' | 'done' | 'abandoned') => ({ daily, freeInProgress: false, oldRun: null, first: false });
  it('starts as a plain countdown', () => {
    expect(dailyPanel(st('new'), 3, fresh('daily', DAY))).toMatchObject({ title: "Today's daily", label: 'Ends in', note: null, rule: null, progress: null });
    expect(dailyButton(st('new'), fresh('daily', DAY))).toEqual({ action: "Start today's run", sub: null, quiet: false });
  });
  it('shows progress in a run, and continues rather than restarts', () => {
    const run = started('daily');
    expect(dailyPanel(st('progress'), 3, run)).toMatchObject({ note: 'Round 1 of 7', progress: { at: 1, of: 7 } });
    expect(dailyPanel(st('progress'), 3, { ...run, phase: 'live' }).progress).toBeNull();
    expect(dailyButton(st('progress'), run)).toEqual({ action: "Continue today's run", sub: 'Round 1 of 7', quiet: false });
  });
  it('offers a quiet replay once finished, and only there explains the replay rule', () => {
    const run = fresh('daily', DAY);
    expect(dailyPanel(st('done'), 3, run, done.placement)).toMatchObject({ title: 'Next daily', label: 'Starts in', note: 'Daily #3: you finished Semifinals.' });
    expect(dailyPanel(st('done'), 3, run, done.placement).rule).toMatch(/replay/i);
    expect(dailyButton(st('done'), run).quiet).toBe(true);
    for (const s of ['new', 'progress', 'abandoned'] as const) expect(dailyPanel(st(s), 3, started('daily')).rule).toBeNull();
  });
  it('never offers Continue for a finished daily', () => {
    expect(dailyButton(st('done'), fresh('daily', DAY)).action).not.toMatch(/continue/i);
    expect(dailyButton(st('abandoned'), fresh('daily', DAY)).action).toBe('Play it anyway');
  });
});

describe('how it works (#148)', () => {
  it('is open for a first visit and for an unfinished first run, slim for a player who has played, and opens on request', () => {
    expect(howExpanded(false, false)).toBe(true);
    expect(howExpanded(true, false)).toBe(false);
    expect(howExpanded(true, true)).toBe(true);
  });
});
