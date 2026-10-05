import { describe, expect, it } from 'vitest';
import { DuoDay, MAX_TRIES, addPick, duoFor, duoPros, duoShare, duoStreak, emptyDay, linksFor, normalizeDuoDay, optionsFor, sanitizeDuo } from './duo';

const dates = (n: number, from = Date.UTC(2026, 9, 5)) => Array.from({ length: n }, (_, i) => new Date(from + i * 86400000).toISOString().slice(0, 10));

describe('Duo Link (#133)', () => {
  it('gives every day a pair that never shared a lineup, with one to three connectors who each played with both', () => {
    for (const date of dates(120)) {
      const p = duoFor(date), links = linksFor(date);
      expect(links.teammates.get(p.a)!.has(p.b)).toBe(false);
      expect(p.connectors.length).toBeGreaterThanOrEqual(1);
      expect(p.connectors.length).toBeLessThanOrEqual(3);
      for (const c of p.connectors) { expect(links.teammates.get(c)!.has(p.a)).toBe(true); expect(links.teammates.get(c)!.has(p.b)).toBe(true); }
    }
  });

  it('deals four different cards with exactly one right answer, and never a decoy who could also be right', () => {
    for (const date of dates(120)) {
      const p = duoFor(date), all = duoPros(date), o = optionsFor(date, p);
      expect(o).toHaveLength(4);
      expect(new Set(o).size).toBe(4);
      expect(o.filter((id) => p.connectors.includes(id))).toHaveLength(1);
      expect(o).not.toContain(p.a);
      expect(o).not.toContain(p.b);
      const orgs = (id: string) => new Set(all.get(id)!.orgs);
      for (const id of o.filter((x) => !p.connectors.includes(x))) {
        const both = [...orgs(p.a)].some((g) => orgs(id).has(g)) && [...orgs(p.b)].some((g) => orgs(id).has(g));
        expect(both).toBe(false);
      }
      expect(optionsFor(date, p)).toEqual(o); // the same cards for everyone
    }
  });

  it('plays a day: wrong picks use tries, a right pick wins, three wrong lose, and a save cannot cheat', () => {
    const date = '2026-10-05', p = duoFor(date), all = duoPros(date);
    const wrong = [...all.keys()].filter((id) => id !== p.a && id !== p.b && !p.connectors.includes(id)).slice(0, 4);
    let d: DuoDay = { ...emptyDay(), mode: 'hard' };
    d = addPick(d, wrong[0], p); expect(d.done).toBe(false);
    d = addPick(d, p.connectors[0], p); expect(d).toMatchObject({ won: true, done: true });
    expect(addPick(d, wrong[1], p)).toBe(d);
    let lost: DuoDay = { ...emptyDay(), mode: 'normal' };
    for (let i = 0; i < MAX_TRIES; i++) lost = addPick(lost, wrong[i], p);
    expect(lost).toMatchObject({ won: false, done: true });
    // a save that claims a win, with picks that are ends or nobody: the picks decide
    const fake = sanitizeDuo({ [date]: { mode: 'hard', picks: [p.a, 'nobody', wrong[0]], done: true, won: true } });
    expect(normalizeDuoDay(fake[date], all, p)).toMatchObject({ picks: [wrong[0]], won: false, done: false });
  });

  it('counts a streak of solved days and words the share line by mode', () => {
    const won = { mode: 'normal' as const, picks: ['x', 'y'], done: true, won: true };
    expect(duoStreak({ '2026-10-04': won, '2026-10-03': won, '2026-10-01': won }, '2026-10-04')).toBe(2);
    expect(duoShare('2026-10-04', won)).toBe('Major Mayhem · Duo Link #7 · 2/3\n⬛🟩');
    expect(duoShare('2026-10-04', { ...won, mode: 'hard' })).toBe('Major Mayhem · Duo Link #7 · Hard 2/3 💀\n⬛🟩');
    expect(duoShare('2026-10-04', { ...won, won: false, picks: ['a', 'b', 'c'] })).toContain('X/3');
  });
});
