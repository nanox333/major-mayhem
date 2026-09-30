import { describe, expect, it } from 'vitest';
import { ROLE_ORDER, ROSTERS, Roster } from '../data/rosters';
import * as G from './logic';
import { Synergy, synergies } from './synergy';
import { chemistryWord, defaultSlot, draftHint, liveChemistry, placementLabel } from './draftui';

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
