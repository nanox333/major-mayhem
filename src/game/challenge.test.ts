import { describe, expect, it } from 'vitest';
import * as G from './logic';
import { Run, fresh, reducer, roundOf, slotsFor, freshDuel } from './state';
import { duelFrom, decodeDuel, encodeDuel } from './duel';
import { challengeCode, decodeChallenge, encodeChallenge, newChallengeSeed } from './challenge';
import { fromBase64Url, toBase64Url } from './duelCode';

/** Drafts a whole run through the reducer, the way a player would, choosing the first eligible roster each round. */
function draft(start: Run): Run {
  let s = start;
  for (let round = 0; s.phase === 'draft'; round++) {
    s = reducer(s, { type: 'spin' });
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

describe('a challenge before a draft (#challenge)', () => {
  it('carries the name and the seed in a link, and reads them back', () => {
    const seed = newChallengeSeed();
    const code = encodeChallenge({ name: 'Kris', seed });
    expect(decodeChallenge(code)).toEqual({ name: 'Kris', seed });
    expect(challengeCode(`#c=${code}`)).toBe(code);
    expect(challengeCode('#duel=abc')).toBeNull();
  });

  it('is a short code: 11 characters with a name, 6 without', () => {
    expect(encodeChallenge({ name: 'Kris', seed: 'free-k7x2' }).length).toBe(11);
    expect(encodeChallenge({ name: '', seed: 'free-k7x2' }).length).toBe(6);
    expect(decodeChallenge(encodeChallenge({ name: '', seed: 'free-k7x2' }))).toEqual({ name: 'A friend', seed: 'free-k7x2' });
  });

  it('makes seeds of four characters, which differ between challenges', () => {
    const seeds = new Set(Array.from({ length: 20 }, () => newChallengeSeed()));
    for (const seed of seeds) expect(seed).toMatch(/^free-[a-z0-9]{4}$/);
    expect(seeds.size).toBeGreaterThan(15);
  });

  it('refuses a seed a free run could not have, and a name too long to carry', () => {
    expect(() => encodeChallenge({ name: 'Kris', seed: 'daily-2026-10-08' })).toThrow();
    expect(() => encodeChallenge({ name: 'Kris', seed: 'free-' + 'a'.repeat(8) })).toThrow();
    // The same bytes with another format byte are not a challenge.
    const bytes = fromBase64Url(encodeChallenge({ name: 'Kris', seed: 'free-k7x2' }));
    bytes[0] = 3;
    expect(decodeChallenge(toBase64Url(bytes))).toBeNull();
  });

  it('refuses a code too short to hold a seed, or one that is not a code at all', () => {
    const code = encodeChallenge({ name: '', seed: 'free-k7x2' });
    expect(decodeChallenge(code.slice(0, 4))).toBeNull();
    expect(decodeChallenge('not a code!')).toBeNull();
  });

  it('starts a free draft from the challenger\'s seed, with nothing drafted yet', () => {
    const s = reducer(fresh('free'), { type: 'challenge', seed: 'free-k7x2', from: 'Kris' });
    expect(s.seed).toBe('free-k7x2');
    expect(s.mode).toBe('free');
    expect(s.phase).toBe('draft');
    expect(s.picks).toEqual([]);
    expect(s.challengeFrom).toBe('Kris');
  });

  it('closes the loop with no server: a friend drafts from the seed, sends a team back, and the challenger drafts against it', () => {
    const challenge = { name: 'Kris', seed: 'free-k7x2' };
    // The friend opens the challenge and drafts a whole team from its seed.
    const friend = draft(reducer(fresh('free'), { type: 'challenge', seed: decodeChallenge(encodeChallenge(challenge))!.seed, from: 'Kris' }));
    expect(friend.picks).toHaveLength(5);
    // They send the team back as a duel link. It carries their cases, so it is an equal-conditions duel.
    const reply = duelFrom(friend, 'Ana');
    expect(reply.v).toBe(2);
    expect(reply.seed).toBe(challenge.seed);
    const back = decodeDuel(encodeDuel(reply));
    expect(back).toEqual(reply);
    // The challenger opens it and drafts against their team, dealt the cases the friend saw.
    const yours = freshDuel(back!);
    expect(yours.duel!.name).toBe('Ana');
    expect(yours.seed).toBe(challenge.seed);
  });
});
