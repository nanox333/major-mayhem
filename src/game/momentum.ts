// What the match screen says about how a map is going (#71): momentum from recent rounds, and each side's economy. Display only: it reads the rounds
// the simulation already played and the calls you made, and changes nothing, so there is no rules version. Economy mirrors the simulation: the two rounds
// after a pistol round (rounds 1 and 13) favour the pistol winner while the loser saves, unless the loser forces the first of them.

export interface Momentum {
  /** Rounds won by your side and by theirs among the last `window` played. */
  ours: number;
  theirs: number;
  /** A run of three or more in a row, and whose. */
  run: { who: 'us' | 'them'; len: number } | null;
  /** Your share of the recent rounds, 0 to 1 (0.5 with nothing played). */
  share: number;
}

/** `rounds` are the round results (true = yours); `n` is how many have been played. */
export function momentumAt(rounds: boolean[], n: number, window = 6): Momentum {
  const played = rounds.slice(0, n);
  const recent = played.slice(-window);
  const ours = recent.filter(Boolean).length;
  const theirs = recent.length - ours;
  let len = 0;
  for (let i = played.length - 1; i >= 0 && played[i] === played[played.length - 1]; i--) len++;
  const run = played.length && len >= 3 ? { who: (played[played.length - 1] ? 'us' : 'them') as 'us' | 'them', len } : null;
  return { ours, theirs, run, share: recent.length ? ours / recent.length : 0.5 };
}

/** One sentence for the bar. */
export function momentumText(m: Momentum, theirTag: string): string {
  if (m.run) return m.run.who === 'them' ? `${theirTag} are on a ${m.run.len}-round run` : `You're on a ${m.run.len}-round run`;
  if (m.ours + m.theirs === 0) return 'Nothing yet';
  return m.ours === m.theirs ? 'Even' : m.ours > m.theirs ? 'Slightly yours' : `Slightly ${theirTag}'s`;
}

export type Buy = 'full' | 'force' | 'eco';
export const BUY_LABEL: Record<Buy, string> = { full: 'Full buy', force: 'Force buy', eco: 'Eco' };
export const BUY_MARK: Record<Buy, string> = { full: '$$$', force: '$$', eco: '$' };

/** What each side is buying in round index `i` (0-based): `rounds` are the results so far and `forced` the round indexes where you chose to force buy. */
export function economyFor(rounds: boolean[], i: number, forced: readonly number[] = []): { mine: Buy; theirs: Buy } {
  const after = i % 12; // 1 or 2 rounds after a half's pistol round (0 and 12 in the first 24 rounds)
  if ((after !== 1 && after !== 2) || i >= 24) return { mine: 'full', theirs: 'full' };
  const pistol = rounds[i - after];
  if (pistol === undefined) return { mine: 'full', theirs: 'full' };
  if (pistol) return { mine: 'full', theirs: 'eco' };
  if (after === 1) return { mine: forced.includes(i) ? 'force' : 'eco', theirs: 'full' };
  // The second round after a lost pistol: broke if you forced and lost, otherwise still saving.
  return { mine: forced.includes(i - 1) && rounds[i - 1] ? 'full' : 'eco', theirs: 'full' };
}
