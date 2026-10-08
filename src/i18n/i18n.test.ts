import { describe, expect, it } from 'vitest';
import { en, plurals } from './en';
import { LANGUAGES, isSupported, plural, resolveLanguage, t, tNode, formatList, setLanguage, getLanguage } from './index';

describe('the text layer (#275)', () => {
  it('returns the English text and fills placeholders', () => {
    setLanguage('en');
    expect(t('nav.home')).toBe('Home');
    expect(t('footer.fanBody', { privacy: 'x' })).toBe('Not affiliated with Valve or any team. Player strength is hidden and match ratings are simulated. x.');
  });

  it('leaves a placeholder alone when no value is given, so a gap shows, not a blank', () => {
    expect(t('settings.kicker', { unused: 1 })).toBe('Preferences');
    expect(t('contact.emailButton')).toBe('Email {address}');
  });

  it('chooses plural forms by the language rules, and never prints a bare number without its word', () => {
    setLanguage('en');
    expect(plural('backup.runs', 1)).toBe('1 Major run');
    expect(plural('backup.runs', 0)).toBe('0 Major runs');
    expect(plural('backup.runs', 2)).toBe('2 Major runs');
    expect(plural('backup.guessDays', 1)).toBe('1 day of Guess history');
  });

  it('gives every plural message an "other" form, which every language falls back to', () => {
    for (const forms of Object.values(plurals)) expect(forms.other).toContain('{n}');
  });

  it('keeps React elements inside one sentence, in their place', () => {
    const pieces = tNode('footer.fanBody', { privacy: 'LINK' });
    expect(pieces.length).toBe(3);
    expect(pieces[0]).toBe('Not affiliated with Valve or any team. Player strength is hidden and match ratings are simulated. ');
    expect(pieces[2]).toBe('.');
  });

  it('picks a language: the saved choice, then the browser, then English', () => {
    expect(resolveLanguage('en', ['pt-BR'])).toBe('en');
    expect(resolveLanguage('xx', ['en-GB'])).toBe('en');
    expect(resolveLanguage(null, ['fr-FR', 'en-US'])).toBe('en');
    expect(resolveLanguage(null, [])).toBe('en');
    expect(isSupported('en')).toBe(true);
    expect(isSupported('xx')).toBe(false);
  });

  it('falls back to English for an unknown language rather than showing nothing', () => {
    setLanguage('xx');
    expect(getLanguage()).toBe('en');
    expect(t('nav.home')).toBe('Home');
    setLanguage('en');
  });

  it('lists the languages the game ships, with the English name first', () => {
    expect(LANGUAGES[0]).toEqual({ code: 'en', name: 'English' });
  });

  it('joins a list in the current language', () => {
    setLanguage('en');
    expect(formatList(['Valve', 'a team'])).toBe('Valve and a team');
  });

  it('has text for every key (no empty messages)', () => {
    for (const [key, text] of Object.entries(en)) expect(text.trim(), key).not.toBe('');
  });
});
