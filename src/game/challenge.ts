// A challenge before a draft (#challenge): a link that starts a friend on a free draft from a seed, before you have drafted anything.
// They draft a team from that seed, send it back as a draft duel, and you then draft against their team. Nothing is stored
// anywhere: the link carries the challenger's name and a short seed, and the reply is an ordinary duel link.
//
// The code is as short as it can be: four characters of seed, then the name's letters. The link's key is "c", and the code has
// no header, because the key already says what it is. A name of "Kris" makes an 11-character code; with no name, 6.
import { cleanName } from './duel';
import { fromBase64Url, toBase64Url } from './duelCode';

/** The seed a challenge uses: "free-" and four letters or digits. Four is enough: a seed only has to differ between challenges. */
const SEED = /^free-[a-z0-9]{4}$/;
const enc = new TextEncoder();
const dec = new TextDecoder();

/** The name the player last typed for a challenge, shared with the one on the results page. */
export const NAME_KEY = 'mm-name';

export interface Challenge { name: string; seed: string }

/** A new seed for a challenge: "free-" and four random characters. */
export const newChallengeSeed = () => `free-${Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, '0')}`;

/** The challenge's link code, or null when there is none in the hash. */
export const challengeCode = (hash: string) => /^#c=([A-Za-z0-9_-]+)$/.exec(hash)?.[1] ?? null;

export function encodeChallenge(c: Challenge): string {
  if (!SEED.test(c.seed)) throw new Error('not a challenge seed');
  // An empty name is left out entirely, so the friend sees "A friend" and the code is as short as it gets.
  const name = c.name.trim() ? enc.encode(cleanName(c.name)) : new Uint8Array(0);
  if (name.length > 200) throw new Error('name too long');
  return toBase64Url(Uint8Array.from([...enc.encode(c.seed.slice(5)), ...name]));
}

/** Reads a challenge from its code, or null if it is malformed or names a seed a challenge could not have. */
export function decodeChallenge(code: string): Challenge | null {
  try {
    const b = fromBase64Url(code);
    if (b.length < 4) return null;
    const seed = `free-${dec.decode(b.subarray(0, 4))}`;
    if (!SEED.test(seed)) return null;
    return { name: cleanName(dec.decode(b.subarray(4))), seed };
  } catch {
    return null;
  }
}
