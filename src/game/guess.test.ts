import { describe, expect, it } from 'vitest';
import { rostersOn } from '../data/rosters';
import { CLUE_LABEL, CLUE_MARK, Clue, MAX_GUESSES, REVEAL, addGuess, answerFor, clueCompact, clueMeaning, clueNamed, compare, describeClue, guessAnnouncement, guessShare, guessStreak, pros, revealPlan, searchState, suggest } from './guess';

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

describe('the reveal (#127)', () => {
  it('flips the cells one after another, showing each result at the halfway point', () => {
    const p = revealPlan(6, false);
    expect(p.shows[0]).toBe(REVEAL.pop + REVEAL.flip / 2);
    for (let i = 1; i < 6; i++) expect(p.shows[i] - p.shows[i - 1]).toBe(REVEAL.stagger);
    expect(p.total).toBe(REVEAL.pop + 5 * REVEAL.stagger + REVEAL.flip);
    expect(p.shows[5]).toBeLessThan(p.total);
    expect(p.verdict).toBeGreaterThan(p.total);
  });
  it('plays each note when its cell shows, so sound and picture share one clock', () => {
    const p = revealPlan(6, false);
    expect(p.notes).toEqual(p.shows);
  });
  it('shows everything at once with reduced motion, and keeps the notes spaced as before', () => {
    const p = revealPlan(6, true);
    expect(p.shows).toEqual([0, 0, 0, 0, 0, 0]);
    expect(p.total).toBe(0);
    expect(p.notes).toEqual([0, 70, 140, 210, 280, 350]);
  });
  it('a whole reveal takes about two seconds', () => {
    expect(revealPlan(6, false).total).toBeGreaterThan(1500);
    expect(revealPlan(6, false).total).toBeLessThan(2500);
  });
  it('announces a guess once, as one sentence with every clue', () => {
    const all = pros();
    const [g, a] = [all.get('dev1ce')!, all.get('zywoo')!];
    const text = guessAnnouncement(3, g, compare(g, a), a);
    expect(text.startsWith('Guess 3, dev1ce.')).toBe(true);
    for (const label of Object.values(CLUE_LABEL)) expect(text).toContain(`${label}:`);
    expect(text).toContain('Denmark');
    expect(guessAnnouncement(1, a, compare(a, a), a)).toContain('Correct.');
  });
  it('has a short form for a small cell and a full name for the accessible one', () => {
    const c = Object.fromEntries(compare(pros().get('dev1ce')!, pros().get('zywoo')!).map((x) => [x.key, x]));
    expect(clueCompact(c.role)).toBe('AWP');
    expect(clueNamed(c.role)).toBe('AWPer');
    expect(clueNamed(c.country)).toBe('Denmark');
    expect(clueCompact(c.country)).toBe('DK');
    expect(['QF', 'SF', 'RU', 'W']).toContain(clueCompact(c.best));
  });
});
