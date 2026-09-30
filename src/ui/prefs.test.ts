import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, parsePrefs, resolveTheme } from './prefs';
import { SHORTCUTS } from './shortcuts';

describe('preferences (#110, #75, #77)', () => {
  it('start as system theme, normal contrast and shortcuts on', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS).toEqual({ theme: 'system', contrast: false, shortcuts: true });
  });
  it('follow the system "more contrast" setting until a choice is saved', () => {
    expect(parsePrefs(null, true).contrast).toBe(true);
    expect(parsePrefs(JSON.stringify({ contrast: false }), true).contrast).toBe(false);
  });
  it('keep a saved choice and ignore values that make no sense', () => {
    expect(parsePrefs(JSON.stringify({ theme: 'light', contrast: true, shortcuts: false }))).toEqual({ theme: 'light', contrast: true, shortcuts: false });
    expect(parsePrefs(JSON.stringify({ theme: 'purple', contrast: 'yes', shortcuts: 1 }))).toEqual(DEFAULT_PREFS);
  });
  it('survive a broken or blocked save', () => {
    expect(parsePrefs('{not json')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('42')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('null')).toEqual(DEFAULT_PREFS);
  });
  it('resolves "system" to the device, and a chosen theme to itself', () => {
    expect(resolveTheme('system', true)).toBe('light');
    expect(resolveTheme('system', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('light', false)).toBe('light');
  });
  it('lists every shortcut the game handles, with where it works', () => {
    expect(SHORTCUTS.map((s) => s.keys)).toEqual(['1  2  3', 'Enter', 'Space', '→', 'T', 'M', '?']);
    for (const s of SHORTCUTS) expect(s.does.length).toBeGreaterThan(5);
  });
});
