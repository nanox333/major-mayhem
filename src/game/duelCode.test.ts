import { describe, expect, it } from 'vitest';
import * as G from './logic';
import { Run, fresh, reducer, roundOf, slotsFor } from './state';
import { Duel, decodeDuel, duelFrom, duelLink, encodeDuel } from './duel';
import { fromBase64Url, toBase64Url, unencodableIds, writeCompact } from './duelCode';

/** Drafts a whole run through the reducer, spinning again once in the rounds listed. */
function draft(start: Run, spinAt: number[] = []): Run {
  let s = start;
  for (let round = 0; s.phase === 'draft'; round++) {
    s = reducer(s, { type: 'spin' });
    if (spinAt.includes(round)) s = reducer(s, { type: 'reroll' });
    const kind = roundOf(s);
    if (kind === 'coach') { s = reducer(s, { type: 'coach', rosterId: s.offer.find((id) => G.rosterById.get(id)!.coach)! }); continue; }
    const id = kind === 'bench' ? s.offer[0] : (s.offer.find((x) => G.rosterEligible(G.rosterById.get(x)!, s.picks)) ?? s.offer[0]);
    s = reducer(s, { type: 'team', id });
    const roster = G.rosterById.get(id)!;
    if (kind === 'bench') {
      const taken = G.draftedIds(s.picks);
      s = reducer(s, { type: 'bench', player: roster.players.find((p) => !taken.has(p.id))! });
      continue;
    }
    const p = roster.players.find((x) => slotsFor(s, x).length)!;
    s = reducer(s, { type: 'draft', player: p, slot: slotsFor(s, p)[0] });
  }
  return s;
}

const SITE = 'https://nanox333.github.io/major-mayhem/';
const freeDuel = (seed: string, spins: number[] = []) => duelFrom(draft({ ...fresh('free'), seed }, spins), 'Ann');
const dailyDuel = (date: string, spins: number[] = []) => duelFrom(draft({ ...fresh('daily', date), seed: `daily-${date}` }, spins), 'Ann');

describe('the compact duel link (#duel)', () => {
  it('reads back to the same duel', () => {
    for (const d of [freeDuel('free-rt1'), freeDuel('free-rt2', [0, 3]), dailyDuel('2026-10-08', [2])]) {
      expect(decodeDuel(encodeDuel(d))).toEqual(d);
    }
  });

  it('is a few hundred characters, not the 1,300 to 1,700 the JSON form made it', () => {
    for (const d of [freeDuel('free-len1'), freeDuel('free-len2', [0, 3]), dailyDuel('2026-10-08', [2])]) {
      expect(writeCompact(d)).not.toBeNull();
      expect(duelLink(SITE, d).length).toBeLessThan(350);
    }
  });

  it('keeps every roster, player and coach in the data encodable, so no link has to fall back', () => {
    expect(unencodableIds()).toEqual([]);
  });

  it('still opens a link made in the older JSON form', () => {
    const d = freeDuel('free-old1', [1]);
    const old = toBase64Url(new TextEncoder().encode(JSON.stringify(d)));
    expect(decodeDuel(old)).toEqual(d);
  });

  it('refuses a link that is cut short or has a code the game does not know', () => {
    const code = encodeDuel(freeDuel('free-bad1'));
    expect(decodeDuel(code.slice(0, code.length - 8))).toBeNull();
    const bytes = fromBase64Url(code);
    bytes[bytes.length - 1] = 0xff; bytes[bytes.length - 2] = 0xff; bytes[bytes.length - 3] = 0xff;
    expect(decodeDuel(toBase64Url(bytes))).toBeNull();
  });

  it('writes a duel it cannot compact in the older JSON form, and the game then refuses it as not a valid duel', () => {
    const d = freeDuel('free-fb1');
    const odd: Duel = { ...d, picks: [...d.picks.slice(1), d.picks[0]] as Duel['picks'] };
    expect(writeCompact(odd)).toBeNull();
    expect(fromBase64Url(encodeDuel(odd))[0]).toBe(0x7b);
    expect(decodeDuel(encodeDuel(odd))).toBeNull();
  });
});
