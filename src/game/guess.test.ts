import { describe, expect, it } from 'vitest';
import { rostersOn } from '../data/rosters';
import { MAX_GUESSES, addGuess, answerFor, compare, guessShare, guessStreak, pros, suggest } from './guess';

describe('guess the pro', () => {
  const all = pros();
  it('builds each pro from every Major they played', () => {
    const s1 = all.get('s1mple')!;
    expect(s1.country).toBe('UA');
    expect(s1.best).toBe(3);
    expect(s1.first).toBe(2016);
    expect(s1.orgs).toEqual(expect.arrayContaining(['Team Liquid', 'Natus Vincere']));
    expect(s1.majors).toBeGreaterThanOrEqual(3);
  });
  it('gives everyone the same answer for a day, from rosters that day, and a known name', () => {
    const a = answerFor('2026-10-10');
    expect(answerFor('2026-10-10')).toEqual(a);
    expect(pros(rostersOn('2026-10-10')).has(a.id)).toBe(true);
    const days = ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'].map((d) => answerFor(d).id);
    expect(new Set(days).size).toBeGreaterThan(1);
  });
  it('marks matches, near misses and which way the numbers go', () => {
    const [zywoo, dev1ce] = [all.get('zywoo')!, all.get('dev1ce')!];
    const self = compare(zywoo, zywoo);
    expect(self.every((c) => c.state === 'hit')).toBe(true);
    const c = Object.fromEntries(compare(dev1ce, zywoo).map((x) => [x.key, x]));
    expect(c.country.state).toBe('miss');
    expect(c.role.state).toBe('hit'); // both main AWPers
    expect(c.first.dir).toBe('up'); // ZywOo's first Major came later
    // Neighbouring countries in one region are close.
    const [dk, se] = [all.get('dupreeh')!, all.get('f0rest')!];
    expect(compare(se, dk).find((x) => x.key === 'country')!.state).toBe('near');
  });
  it('ends on the right answer or after the last guess, ignoring repeats', () => {
    const answer = all.get('niko')!;
    let day = { guesses: [] as string[], done: false, won: false };
    day = addGuess(day, 's1mple', answer);
    expect(addGuess(day, 's1mple', answer)).toBe(day);
    day = addGuess(day, 'niko', answer);
    expect(day).toMatchObject({ done: true, won: true });
    const wrong = [...all.keys()].filter((id) => id !== 'niko').slice(0, MAX_GUESSES);
    const lost = wrong.reduce((d, id) => addGuess(d, id, answer), { guesses: [] as string[], done: false, won: false });
    expect(lost).toMatchObject({ done: true, won: false });
    expect(lost.guesses).toHaveLength(MAX_GUESSES);
  });
  it('shares squares without the answer, and counts a solved streak', () => {
    const answer = all.get('niko')!;
    const text = guessShare('2026-09-30', { guesses: ['s1mple', 'niko'], done: true, won: true }, answer, all);
    expect(text.split('\n')[0]).toBe(`Major Mayhem · Guess the Pro #3 2/${MAX_GUESSES}`);
    expect(text).not.toContain('NiKo');
    expect(guessStreak({ '2026-09-29': { guesses: ['a'], done: true, won: true }, '2026-09-30': { guesses: ['a'], done: true, won: true } }, '2026-10-01')).toBe(2);
  });
  it('suggests players as you type, names starting with the text first', () => {
    const list = suggest(all, 'ni', []);
    expect(list[0].id.startsWith('ni')).toBe(true);
    expect(suggest(all, 'niko', ['niko']).some((p) => p.id === 'niko')).toBe(false);
  });
});
