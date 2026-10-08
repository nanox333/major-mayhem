// A challenge before a draft (#challenge): a link that starts a friend on a free draft from a seed, before you have drafted anything.
// They draft a team from that seed, send it back as a draft duel, and you then draft against their team. Nothing is stored
// anywhere: the link carries the challenger's name and the seed, and the reply is an ordinary duel link.
import { cleanName } from './duel';
import { fromBase64Url, toBase64Url } from './duelCode';

/** The first byte of a challenge's payload. Duel links start with 3 and older JSON links with "{", so this tells them apart. */
const FORMAT = 5;
/** A free-play seed: "free-" and a few letters or digits, as a run makes them. */
const SEED = /^free-[a-z0-9]{1,12}$/;
const enc = new TextEncoder();
const dec = new TextDecoder();

/** The name the player last typed for a challenge, shared with the one on the results page. */
export const NAME_KEY = 'mm-name';

export interface Challenge { name: string; seed: string }

/** A new seed for a challenge, made the way a free-play run makes its own. */
export const newChallengeSeed = () => `free-${Math.random().toString(36).slice(2, 10)}`;

/** The challenge's link code, or null when there is none in the hash. */
export const challengeCode = (hash: string) => /^#challenge=([A-Za-z0-9_-]+)$/.exec(hash)?.[1] ?? null;

export function encodeChallenge(c: Challenge): string {
  const name = enc.encode(cleanName(c.name));
  const seed = enc.encode(c.seed);
  if (!SEED.test(c.seed) || name.length > 255) throw new Error('not a challenge');
  return toBase64Url(Uint8Array.from([FORMAT, name.length, ...name, seed.length, ...seed]));
}

/** Reads a challenge from its code, or null if it is malformed or names a seed a run could not have. */
export function decodeChallenge(code: string): Challenge | null {
  try {
    const b = fromBase64Url(code);
    if (b[0] !== FORMAT) return null;
    let i = 1;
    const n = b[i++];
    const name = dec.decode(b.subarray(i, i + n));
    i += n;
    const k = b[i++];
    const seed = dec.decode(b.subarray(i, i + k));
    if (i + k !== b.length || !SEED.test(seed)) return null;
    return { name: cleanName(name), seed };
  } catch {
    return null;
  }
}
