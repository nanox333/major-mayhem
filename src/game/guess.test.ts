import { describe, expect, it } from 'vitest';
import { rostersOn } from '../data/rosters';
import { CLUE_LABEL, CLUE_MARK, Clue, MAX_GUESSES, addGuess, answerFor, clueMeaning, compare, describeClue, guessShare, guessStreak, pros, searchState, suggest } from './guess';

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
  it('gives every clue state a symbol and a description, so colour is never the only signal (#22)', () => {
    expect(new Set(Object.values(CLUE_MARK)).size).toBe(3);
    const keys = Object.keys(CLUE_LABEL) as Clue['key'][];
    for (const key of keys) {
      // The three states read differently for a clue, and each sentence names its column.
      const said = (['hit', 'near', 'miss'] as const).map((state) => describeClue({ key, text: 'x', state } as Clue));
      for (const s of said) expect(s.startsWith(`${CLUE_LABEL[key]}: x. `)).toBe(true);
      if (key === 'majors' || key === 'best') expect(said[0]).not.toBe(said[2]);
      else expect(new Set(said).size).toBe(3);
    }
    expect(clueMeaning({ key: 'country', text: 'SE', state: 'near' })).toBe('Same region');
    expect(clueMeaning({ key: 'majors', text: '3', state: 'miss', dir: 'up' })).toMatch(/more/);
    expect(clueMeaning({ key: 'majors', text: '3', state: 'miss', dir: 'down' })).toMatch(/fewer/);
    expect(clueMeaning({ key: 'first', text: '2016', state: 'near', dir: 'up' })).toMatch(/year off.*later/);
    // A real comparison describes all six columns.
    const real = compare(all.get('dev1ce')!, all.get('zywoo')!);
    expect(real.map((c) => describeClue(c))).toHaveLength(6);
  });
  it('says what the search found, including nothing and already guessed (#22)', () => {
    expect(searchState(all, '', [])).toEqual({ kind: 'idle' });
    expect(searchState(all, ' - ', [])).toEqual({ kind: 'idle' });
    const found = searchState(all, 'niko', []);
    expect(found.kind === 'results' && found.options.some((p) => p.id === 'niko')).toBe(true);
    expect(searchState(all, 'qqqqzz', [])).toEqual({ kind: 'none' });
    expect(searchState(all, 'niko', ['niko'])).toMatchObject({ kind: 'guessed', nick: expect.stringMatching(/niko/i) });
  });
});
