import { describe, expect, it } from 'vitest';
import { ROLE_ORDER, ROSTERS, Roster } from '../data/rosters';
import * as G from './logic';
import { Synergy, chemistryOf, synergies } from './synergy';
import { chemPreview, chemistryWord, defaultSlot, draftHint, liveChemistry, majorsOf, mapComfort, placementLabel, playerState } from './draftui';

const pick = (r: Roster, i: number, slot: G.Pick['slot']): G.Pick => ({ slot, rosterId: r.id, playerId: r.players[i].id });
/** A whole real roster as five picks, one per slot in slot order. */
const fromRoster = (r: Roster): G.Pick[] => ROLE_ORDER.map((slot, i) => pick(r, i, slot));
const syn = (value: number, kind: Synergy['kind'] = 'lineup'): Synergy => ({ kind, label: String(value), value });

describe('draft hint (#109)', () => {
  const five = fromRoster(ROSTERS[0]);
  const without = (...slots: string[]) => five.filter((p) => !slots.includes(p.slot));

  it('names every slot when none is filled', () => {
    expect(draftHint({ picks: [] })).toBe('Five slots to fill: IGL, AWPer, Entry, Lurker and Support / Anchor.');
  });
  it('names one open slot, with the right article', () => {
    expect(draftHint({ picks: without('SUP') })).toBe('You still need a Support / Anchor.');
    expect(draftHint({ picks: without('IGL') })).toBe('You still need an IGL.');
    expect(draftHint({ picks: without('AWP') })).toBe('You still need an AWPer.');
    expect(draftHint({ picks: without('ENTRY') })).toBe('You still need an Entry.');
  });
  it('lists several open slots in slot order', () => {
    expect(draftHint({ picks: without('LURK', 'SUP') })).toBe('You still need a Lurker and a Support / Anchor.');
    expect(draftHint({ picks: without('AWP', 'LURK', 'SUP') })).toBe('You still need an AWPer, a Lurker and a Support / Anchor.');
  });
  it('has its own sentence for the coach and the bench', () => {
    expect(draftHint({ picks: five, extras: true, coach: undefined })).toMatch(/^Your five are set\. Now a coach/);
    expect(draftHint({ picks: five, extras: true, coach: 'Zonic', bench: null })).toMatch(/^Last pick: a bench player/);
    expect(draftHint({ picks: five, extras: true, coach: 'Zonic', bench: five[0] })).toBe('Your team is set.');
    expect(draftHint({ picks: five })).toBe('Your team is set.');
  });
  it('in hard mode only names the slots still to fill, and gives no advice', () => {
    const hard = { hard: true };
    expect(draftHint({ picks: without('LURK', 'SUP'), extras: true, coach: undefined, bench: null, opts: hard })).toBe('Still to fill: Lurker, Support / Anchor, Coach, Bench.');
    expect(draftHint({ picks: five, extras: true, coach: undefined, bench: null, opts: hard })).toBe('Still to fill: Coach, Bench.');
    expect(draftHint({ picks: five, extras: true, coach: 'Zonic', bench: five[1], opts: hard })).toBe('Your team is set.');
  });
  it('never mentions a rating or a win', () => {
    for (const picks of [[], without('SUP'), five]) expect(draftHint({ picks, extras: true })).not.toMatch(/rating|win|best|strong/i);
  });
});

describe('live chemistry (#108)', () => {
  it('shows exactly the lobby rows for a full lineup', () => {
    for (const r of [ROSTERS[0], ROSTERS[20], ROSTERS[40]]) {
      const picks = fromRoster(r);
      expect(liveChemistry(picks, undefined, false).rows).toEqual(synergies(G.lineupFromPicks(picks), undefined));
    }
  });
  it('shows exactly the lobby rows for a lineup with a penalty, whatever order the picks were made in', () => {
    const awpers = ROSTERS.flatMap((r) => r.players.map((p) => ({ r, p }))).filter((x) => x.p.roles[0] === 'AWP');
    const [a, b] = [awpers[0], awpers.find((x) => x.p.id !== awpers[0].p.id && x.r.id !== awpers[0].r.id)!];
    const rest = ROSTERS.filter((r) => r.id !== a.r.id && r.id !== b.r.id).slice(0, 3);
    // The first AWPer fills the IGL slot and the second the AWP slot, drafted last: the pick order differs from the slot order.
    const picks: G.Pick[] = [
      pick(rest[0], 2, 'ENTRY'), pick(rest[1], 3, 'LURK'), pick(rest[2], 4, 'SUP'),
      { slot: 'AWP', rosterId: b.r.id, playerId: b.p.id }, { slot: 'IGL', rosterId: a.r.id, playerId: a.p.id },
    ];
    const live = liveChemistry(picks, undefined, false);
    expect(live.rows).toEqual(synergies(G.lineupFromPicks(picks), undefined));
    expect(live.rows.some((x) => x.kind === 'awp')).toBe(true);
    expect(liveChemistry(picks, undefined, true).rows.some((x) => x.kind === 'awp')).toBe(false);
  });
  it('a lineup of one has no "all one era" bonus, and none yet', () => {
    const live = liveChemistry([pick(ROSTERS[0], 0, 'IGL')], undefined, false);
    expect(live.rows.some((x) => x.kind === 'era')).toBe(false);
    expect(live.word).toBe('None yet');
  });
  it('turns the value into a word at fixed boundaries', () => {
    expect(chemistryWord([])).toEqual({ word: 'None yet', pips: 0 });
    expect(chemistryWord([syn(0.3)])).toEqual({ word: 'Some', pips: 1 });
    expect(chemistryWord([syn(0.59)])).toEqual({ word: 'Some', pips: 1 });
    expect(chemistryWord([syn(0.6)])).toEqual({ word: 'Good', pips: 2 });
    expect(chemistryWord([syn(1.4)])).toEqual({ word: 'Good', pips: 2 });
    expect(chemistryWord([syn(1.5)])).toEqual({ word: 'Strong', pips: 3 });
    expect(chemistryWord([syn(9)])).toEqual({ word: 'Strong', pips: 3 });
    expect(chemistryWord([syn(-1, 'awp')])).toEqual({ word: 'Clashing', pips: 0 });
    expect(chemistryWord([syn(2), syn(-1, 'awp')])).toEqual({ word: 'Good', pips: 2 });
  });
});

describe('placement and default slot (#104, #105)', () => {
  it('writes each result as a placement', () => {
    expect(placementLabel('Champions')).toBe('1st place');
    expect(placementLabel('Runner-up')).toBe('2nd place');
    expect(placementLabel('Semifinalist')).toBe('3rd–4th place');
    expect(placementLabel('Quarterfinalist')).toBe('5th–8th place');
    expect(placementLabel('Challenger')).toBe('Challenger');
  });
  it('every result in the data has a placement', () => {
    for (const r of ROSTERS) expect(placementLabel(r.result), r.id).toMatch(/place$/);
  });
  it('defaults to the main role when it is open, else the first open slot they cover', () => {
    expect(defaultSlot(['AWP', 'LURK'], 'AWP', false)).toBe('AWP');
    expect(defaultSlot(['LURK'], 'AWP', false)).toBe('LURK');
    expect(defaultSlot([], 'AWP', false)).toBe(null);
  });
  it('gives no default in hard mode, where nothing says which slot suits a player', () => {
    expect(defaultSlot(['AWP', 'LURK'], 'AWP', true)).toBe(null);
  });
});

describe('player state (#145)', () => {
  const p = (...roles: G.Pick['slot'][]) => ({ roles });
  it('is main while their main role is open', () => {
    expect(playerState(p('IGL', 'SUP'), ['IGL', 'SUP'], false)).toEqual({ state: 'main', would: 'IGL', taken: null });
  });
  it('is secondary once their main role is taken but another they cover is open', () => {
    expect(playerState(p('IGL', 'ENTRY'), ['ENTRY'], false)).toEqual({ state: 'secondary', would: 'ENTRY', taken: 'IGL' });
  });
  it('is unavailable when every role they cover is taken, and for a one-role player whose slot is filled', () => {
    expect(playerState(p('IGL', 'ENTRY'), [], false).state).toBe('unavailable');
    expect(playerState(p('AWP'), [], false).state).toBe('unavailable');
    expect(playerState(p('AWP'), ['AWP'], false)).toEqual({ state: 'main', would: 'AWP', taken: null });
  });
  it('in hard mode names no role: draftable or not, never secondary', () => {
    expect(playerState(p('IGL'), ['ENTRY', 'LURK'], true)).toEqual({ state: 'main', would: null, taken: null });
    expect(playerState(p('IGL'), [], true).state).toBe('unavailable');
  });
  it('agrees with what the game lets you draft', () => {
    const r = ROSTERS[0];
    const picks = [pick(r, 0, r.players[0].roles[0])];
    for (const pl of r.players) {
      const open = G.eligibleSlots(pl, picks);
      const st = playerState(pl, open, false);
      expect(st.state === 'unavailable').toBe(open.length === 0);
      if (st.would) expect(open).toContain(st.would);
    }
  });
});

describe('chemistry preview (#143)', () => {
  const five = fromRoster(ROSTERS[0]);
  it('equals the change in the lobby total after really adding the same pick', () => {
    for (const r of ROSTERS.slice(0, 12)) {
      const base = fromRoster(r).slice(0, 3);
      for (const cand of ROSTERS.slice(12, 20).map((x) => pick(x, 0, ROLE_ORDER[3]))) {
        const before = liveChemistry(base, undefined, false);
        const after = liveChemistry([...base, cand], undefined, false);
        const pv = chemPreview({ picks: base }, { picks: [...base, cand] }, false);
        expect(pv.delta).toBeCloseTo(chemistryOf(after.rows) - chemistryOf(before.rows), 9);
        expect(pv.before).toBe(before.word);
        expect(pv.after).toBe(after.word);
      }
    }
  });
  it('shows a link a pick adds, and a penalty', () => {
    const pv = chemPreview({ picks: five.slice(0, 4) }, { picks: five }, false);
    expect(pv.added.length + pv.removed.length).toBeGreaterThan(0);
    expect(pv.after).toBe(liveChemistry(five, undefined, false).word);
  });
  it('says so when a link is already at the cap and adds nothing', () => {
    const rows = [syn(1), syn(1), syn(1), syn(1)];
    expect(chemistryOf(rows)).toBe(3);
    // A stub of the same rule: adding a positive row to a full total changes nothing.
    expect(chemistryOf([...rows, syn(0.5)]) - chemistryOf(rows)).toBe(0);
  });
  it('has no change to show for a pick with no links', () => {
    const solo = [pick(ROSTERS[0], 0, ROLE_ORDER[0])];
    const pv = chemPreview({ picks: [] }, { picks: solo }, false);
    expect(pv.added).toEqual([]);
    expect(pv.delta).toBe(0);
  });
});

describe('a player\'s Majors and your team\'s maps (#48, #49)', () => {
  it('lists the Majors a player attended, oldest first, with how far they got', () => {
    const r = ROSTERS.find((x) => x.result === 'Champions')!;
    const pl = r.players[0];
    const list = majorsOf(pl.id);
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((m) => m.year === r.year && m.org === r.org && m.result === '1st')).toBe(true);
    expect([...list].sort((a, b) => a.year - b.year)).toEqual(list);
    expect(majorsOf('nobody-of-that-name')).toEqual([]);
  });
  it('ranks the seven maps for a lineup, best first, each with a word', () => {
    const l = G.lineupFromPicks(fromRoster(ROSTERS[0]));
    const c = mapComfort(l);
    expect(c.map((x) => x.map).sort()).toEqual([...G.MAPS].sort());
    for (let i = 1; i < c.length; i++) expect(c[i - 1].pips).toBeGreaterThanOrEqual(c[i].pips);
    for (const x of c) expect(x.word).toBe(x.pips >= 4 ? 'strong' : x.pips <= 2 ? 'weak' : 'average');
  });
});
