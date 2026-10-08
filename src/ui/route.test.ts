import { describe, expect, it } from 'vitest';
import { ROUTES, isInviteHash, landingView, viewFromHash } from './route';

describe('page addresses (#222)', () => {
  it('gives every page its own address, and reads each one back', () => {
    for (const [view, hash] of Object.entries(ROUTES)) expect(viewFromHash(hash), hash).toBe(view);
    expect(new Set(Object.values(ROUTES)).size).toBe(Object.keys(ROUTES).length);
  });
  it('treats no address as the Home and an unknown one as no page', () => {
    expect(viewFromHash('')).toBe('home');
    expect(viewFromHash('#')).toBe('home');
    expect(viewFromHash('#/nope')).toBeNull();
    expect(viewFromHash('#guess')).toBeNull();
  });
  it('is forgiving about a trailing slash and a query', () => {
    expect(viewFromHash('#/guess/')).toBe('guess');
    expect(viewFromHash('#/archive?from=help')).toBe('archive');
    expect(viewFromHash('#/')).toBe('home');
  });
  it('opens on the Home unless an address names a page, and never resumes the draft on load', () => {
    expect(landingView('')).toBe('home');
    expect(landingView('#/guess')).toBe('guess');
    expect(landingView('#/archive')).toBe('archive');
    expect(landingView('#/stats')).toBe('stats');
    expect(landingView('#/setup')).toBe('setup');
    expect(landingView('#/play')).toBe('home');
    expect(landingView('#/whatever')).toBe('home');
    // A challenge link is not a page: the invite handles it, and what is behind it is the Home.
    expect(landingView('#duel=abc')).toBe('home');
  });

  it('leaves a challenge or duel link to the invite, and reads the pages as pages', () => {
    expect(isInviteHash('#duel=abc')).toBe(true);
    expect(isInviteHash('#c=abc')).toBe(true);
    expect(isInviteHash('#/guess')).toBe(false);
    expect(isInviteHash('')).toBe(false);
  });
});
