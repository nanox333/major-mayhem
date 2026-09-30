// All game randomness goes through `random()`. `seeded()` swaps in a deterministic generator,
// so the daily challenge gives everyone the same cases and a saved run replays identically.

/** mulberry32: small, fast, good enough for a game. */
export const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
/** FNV-1a string hash. */
export const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

let rng: () => number = Math.random;
export const random = () => rng();
export function seeded<T>(seed: string, fn: () => T): T {
  const prev = rng;
  rng = mulberry32(hash(seed));
  try { return fn(); } finally { rng = prev; }
}

export const rand = (n: number) => Math.floor(random() * n);
export const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = rand(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
