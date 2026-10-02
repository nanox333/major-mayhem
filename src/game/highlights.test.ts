import { describe, expect, it } from 'vitest';
import { keyMoments } from './highlights';
import type { MapGame } from './match';

const game = (rounds: boolean[]): MapGame => ({
  map: 'Mirage', start: 'T', rounds, events: [{ round: 5, text: 'x clutches a 1v3', mine: true, good: true, kind: 'clutch' }],
  score: [rounds.filter(Boolean).length, rounds.filter((x) => !x).length], won: rounds.filter(Boolean).length > rounds.length / 2,
  stats: { mine: [{ id: 'a', nick: 'A', k: 20, d: 10, rating: 1.3 }, { id: 'b', nick: 'B', k: 10, d: 12, rating: 0.9 }], opp: [] },
});

describe('keyMoments', () => {
  it('reports the MVP first, then rounds in order, from the results only', () => {
    const r = [...Array(5).fill(false), ...Array(13).fill(true)];
    const m = keyMoments(game(r), 'ABC');
    expect(m[0].kind).toBe('mvp');
    const rounds = m.slice(1).map((x) => x.round ?? 99);
    expect(rounds).toEqual([...rounds].sort((a, b) => a - b));
    expect(m.some((x) => x.kind === 'comeback' && x.good)).toBe(true);
    expect(m.some((x) => x.kind === 'clutch')).toBe(true);
    expect(m.find((x) => x.kind === 'run' && x.good)?.title).toBe('13 in a row');
  });
});
