import { afterEach, describe, expect, it, vi } from 'vitest';

/** A fresh copy of the tips module over a fake localStorage, since it reads what's been dismissed once, when it loads. */
async function load(store: Record<string, string> = {}) {
  vi.resetModules();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } });
  return { tips: await import('./tips'), store };
}
afterEach(() => vi.unstubAllGlobals());

describe('first-appearance tips (#21)', () => {
  it('shows every tip to someone who has never played', async () => {
    const { tips } = await load();
    for (const id of tips.TIP_IDS) expect(tips.tipSeen(id)).toBe(false);
  });

  it('shows none to someone who has finished a run, a daily or a duel', async () => {
    for (const stats of [{ runs: 1 }, { runs: 0, daily: { '2026-09-28': {} } }, { runs: 0, duels: { w: 0, l: 1 } }]) {
      const { tips } = await load({ 'major-mayhem-stats-v1': JSON.stringify({ v: 1, ...stats }) });
      for (const id of tips.TIP_IDS) expect(tips.tipSeen(id)).toBe(true);
    }
  });

  it('remembers a dismissed tip, only that one, across reloads', async () => {
    const first = await load();
    first.tips.dismissTip('fit');
    expect(first.tips.tipSeen('fit')).toBe(true);
    expect(first.tips.tipSeen('knife')).toBe(false);
    expect(JSON.parse(first.store['mm-tips'])).toEqual(['fit']);
    const again = await load(first.store);
    expect(again.tips.tipSeen('fit')).toBe(true);
    expect(again.tips.tipSeen('knife')).toBe(false);
  });

  it('brings every tip back on request, even for a returning player', async () => {
    const { tips, store } = await load({ 'major-mayhem-stats-v1': JSON.stringify({ v: 1, runs: 5 }) });
    expect(tips.tipSeen('intro')).toBe(true);
    tips.resetTips();
    expect(tips.tipSeen('intro')).toBe(false);
    // The explicit empty list beats the "has played" guess on the next load.
    const again = await load(store);
    expect(again.tips.tipSeen('intro')).toBe(false);
  });

  it('copes with storage that is missing or holds rubbish', async () => {
    const bad = await load({ 'mm-tips': '{not json', 'major-mayhem-stats-v1': 'nope' });
    expect(bad.tips.tipSeen('fit')).toBe(false);
    vi.resetModules();
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    const blocked = await import('./tips');
    expect(blocked.tipSeen('fit')).toBe(false);
    expect(() => blocked.dismissTip('fit')).not.toThrow();
    expect(blocked.tipSeen('fit')).toBe(true);
  });
});

describe('one tip at a time, and turning them all off (#130, #110)', () => {
  it('draws only the first unseen tip of the ones on screen', async () => {
    const { tips } = await load();
    expect(tips.firstVisible(['fit', 'chem', 'form'], new Set())).toBe('fit');
    expect(tips.firstVisible(['fit', 'chem', 'form'], new Set(['fit']))).toBe('chem');
    expect(tips.firstVisible(['fit', 'chem'], new Set(['fit', 'chem']))).toBeNull();
    expect(tips.firstVisible([], new Set())).toBeNull();
  });
  it('knows the chemistry tip, and skipping tips marks every one seen until they are turned back on', async () => {
    const { tips, store } = await load();
    expect(tips.TIP_IDS).toContain('chem');
    tips.setTipsOn(false);
    for (const id of tips.TIP_IDS) expect(tips.tipSeen(id)).toBe(true);
    expect(JSON.parse(store['mm-tips'])).toEqual(tips.TIP_IDS);
    tips.setTipsOn(true);
    for (const id of tips.TIP_IDS) expect(tips.tipSeen(id)).toBe(false);
  });
});
