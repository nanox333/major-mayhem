import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, parsePrefs } from './prefs';
import { SHORTCUTS } from './shortcuts';

describe('preferences (#110, #75, #77)', () => {
  it('start with normal contrast and shortcuts on', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS).toEqual({ contrast: false, shortcuts: true, fastReveals: false, language: 'en' });
  });
  it('pick the language from the saved choice, then the browser, then English', () => {
    expect(parsePrefs(JSON.stringify({ language: 'en' }), false, ['pt-BR']).language).toBe('en');
    expect(parsePrefs(null, false, ['fr-FR', 'en-US']).language).toBe('en');
    expect(parsePrefs(JSON.stringify({ language: 'xx' })).language).toBe('en');
  });
  it('follow the system "more contrast" setting until a choice is saved', () => {
    expect(parsePrefs(null, true).contrast).toBe(true);
    expect(parsePrefs(JSON.stringify({ contrast: false }), true).contrast).toBe(false);
  });
  it('keep a saved choice and ignore values that make no sense', () => {
    expect(parsePrefs(JSON.stringify({ contrast: true, shortcuts: false }))).toEqual({ contrast: true, shortcuts: false, fastReveals: false, language: 'en' });
    expect(parsePrefs(JSON.stringify({ contrast: 'yes', shortcuts: 1 }))).toEqual(DEFAULT_PREFS);
  });
  it('keeps old settings compatible and validates the fast reveal preference', () => {
    // A theme saved by an older version (there was once a light one) is dropped: there is one palette now.
    expect(parsePrefs(JSON.stringify({ theme: 'light', contrast: true }))).toEqual({ ...DEFAULT_PREFS, contrast: true });
    expect(parsePrefs(JSON.stringify({ fastReveals: true })).fastReveals).toBe(true);
    expect(parsePrefs(JSON.stringify({ fastReveals: 'yes' })).fastReveals).toBe(false);
  });
  it('survive a broken or blocked save', () => {
    expect(parsePrefs('{not json')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('42')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('null')).toEqual(DEFAULT_PREFS);
  });
  it('lists every shortcut the game handles, with where it works', () => {
    expect(SHORTCUTS.map((s) => s.keys)).toEqual(['1  2  3', 'Enter', 'Space', '→', 'T', 'M', '?']);
    for (const s of SHORTCUTS) expect(s.does.length).toBeGreaterThan(5);
  });
});
