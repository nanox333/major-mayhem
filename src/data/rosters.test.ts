import { describe, expect, it } from 'vitest';
import { COACHES, DATA, ROLE_ORDER, ROSTERS, pid, rostersOn } from './rosters';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

describe('roster data', () => {
  it('gives every roster a unique id (a duplicate would silently replace the earlier roster)', () => {
    const ids = ROSTERS.map((r) => r.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it('has five distinct players per roster with valid roles and ratings', () => {
    for (const r of ROSTERS) {
      expect(r.players, r.id).toHaveLength(5);
      expect(new Set(r.players.map((p) => p.id)).size, r.id).toBe(5);
      for (const p of r.players) {
        expect(p.roles.length, `${r.id} ${p.nick}`).toBeGreaterThan(0);
        expect(new Set(p.roles).size, `${r.id} ${p.nick} repeats a role`).toBe(p.roles.length);
        for (const role of p.roles) expect(ROLE_ORDER, `${r.id} ${p.nick}`).toContain(role);
        expect(Number.isInteger(p.rating) && p.rating >= 60 && p.rating <= 99, `${r.id} ${p.nick} rating ${p.rating}`).toBe(true);
      }
    }
  });

  it('knows every organization, coach and nationality', () => {
    for (const r of ROSTERS) {
      expect(DATA.orgs[r.org], r.org).toBeDefined();
      if (r.coach) expect(COACHES[r.coach], `${r.id} coach ${r.coach}`).toBeDefined();
      for (const p of r.players) expect(p.country, `${p.nick} country`).toMatch(/^[A-Z]{2}$/);
    }
    for (const [name, c] of Object.entries(COACHES)) expect(c.rating >= 60 && c.rating <= 99, name).toBe(true);
  });

  it('keeps one spelling per person, and explicit ids only where two people share a nick', () => {
    const nick = new Map<string, string>();
    for (const r of ROSTERS) for (const p of r.players) {
      if (nick.has(p.id)) expect(nick.get(p.id), `${p.id} spelled two ways`).toBe(p.nick);
      nick.set(p.id, p.nick);
    }
    for (const r of DATA.rosters) for (const p of r.players) {
      if (!p.id) continue;
      expect(p.id, `${p.nick}: an explicit id must differ from the default`).not.toBe(pid(p.nick));
      expect(nick.get(pid(p.nick)), `${p.nick}: explicit id without anyone else using the default id`).toBeDefined();
    }
  });

  it('has no player entries that no roster uses', () => {
    const used = new Set(ROSTERS.flatMap((r) => r.players.map((p) => p.id)));
    expect(Object.keys(DATA.players).filter((id) => !used.has(id))).toEqual([]);
  });

  it('dates additions so existing dailies never change', () => {
    for (const r of DATA.rosters) {
      if (r.since) expect(r.since, r.org).toMatch(DATE);
      if (r.until) expect(r.until, r.org).toMatch(DATE);
    }
    // Everything after the launch set was added later, so it must say from when.
    const launch = rostersOn('2026-09-28');
    expect(launch).toHaveLength(46);
    for (const r of ROSTERS.filter((x) => !launch.includes(x))) expect(r.since, r.id).toBeTruthy();
  });

  it("doesn't repeat a lineup for the same organization and year", () => {
    const key = (r: (typeof ROSTERS)[number]) => `${r.org}|${r.year}|${r.players.map((p) => p.id).sort().join(',')}`;
    const keys = ROSTERS.map(key);
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });
});
