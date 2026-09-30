// What the killfeed says: event lines per role, map callouts, and which lines fit the buy this round.
import { Role } from '../data/rosters';
import { rand } from './random';
import { rules } from './rulesState';

// {p} player, {t} opposing org, {s} a callout on the current map.
export const EVENT_TEXT: Record<Role, string[]> = {
  IGL: [
    '{p} reads the rotate and calls a perfect mid-round', '{p} calls a fake that pulls three off {s}', '{p} wins the round with a gutsy anti-eco call',
    '{p} spots the stack on {s} and calls the team the other way', '{p} calls a late execute through {s} with seconds to spare', '{p} keeps the team calm on a 4v5 and wins it',
  ],
  AWP: [
    '{p} opens it up with an AWP pick on {s}', '{p} flicks a no-scope to save the round', '{p} holds {s} and takes two with the AWP',
    '{p} lands a collateral on {s}', '{p} one-taps the rotator with a quick-scope', '{p} picks the aggressive peek on {s} and the round is over',
  ],
  ENTRY: [
    '{p} dry-peeks {s} and gets the opening frag', '{p} storms the site for a 4K', '{p} trades perfectly on the entry',
    '{p} swings through {s} and takes the first two', '{p} jiggles {s}, baits the AWP, and the team trades', '{p} deagles two on the force buy',
  ],
  LURK: [
    '{p} catches the rotation from behind', '{p} backstabs three on the flank', '{p} wins a 1v2 from {s}',
    '{p} waits out the timing on {s} and takes two', '{p} cuts off the retake alone', '{p} steals the pick on {s} while everyone looks the other way',
  ],
  SUP: [
    '{p} pops a flash that blinds the whole site', '{p} holds {s} alone and wins a 1v3', '{p} molly-stalls the push until help arrives',
    '{p} smokes off {s} and the execute walks in', '{p} drops the AWP for the star and survives to trade', '{p} defuses with 0.3 on the clock',
  ],
};
export const OPP_TEXT = [
  '{p} wins a clutch for {t}', '{p} hits a triple kill on the retake', '{t} steamrolls {s} with {p} leading', '{p} lands a lucky wallbang',
  '{p} holds {s} and shuts the push down', '{t} win the force buy through {s}', '{p} ninja-defuses behind the smoke', '{p} gets a 1v3 on {s}',
];
/** A few recognizable callouts per map so the killfeed isn't all Dust 2. */
export const CALLOUTS: Record<string, string[]> = {
  Mirage: ['Palace', 'A ramp', 'Connector', 'Jungle', 'Window', 'B apartments', 'Short', 'Underpass'],
  Inferno: ['Banana', 'Apartments', 'Pit', 'Mid', 'Arch', 'Library', 'Car', 'Second mid'],
  Nuke: ['Outside', 'Ramp', 'Heaven', 'Secret', 'Hut', 'Lobby', 'Vents', 'Silo'],
  Ancient: ['Donut', 'Cave', 'Main', 'Temple', 'B ramp', 'Elbow', 'Red room'],
  Anubis: ['Canal', 'Bridge', 'Connector', 'Palace', 'Water', 'Ruins', 'Street'],
  Dust2: ['Long A', 'Catwalk', 'Mid doors', 'Upper tunnels', 'B window', 'Pit', 'Xbox', 'Goose'],
  Train: ['Ivy', 'Connector', 'Popdog', 'Upper B', 'Lower hall', 'Heaven', 'Z-connector'],
};
export interface Buy { ourForce: boolean; theirEco: boolean }
/** Lines that mention a force buy or an eco only fit rounds where that is actually happening. */
export const fitting = (lines: string[], buy: Buy): string[] => rules() < 2 ? lines : lines.filter((l) =>
  /force buy/.test(l) ? (l.startsWith('{t}') ? buy.theirEco : buy.ourForce) : /anti-eco/.test(l) ? buy.theirEco : true);
export const fill = (tpl: string, p: string, t: string, map: string) => {
  const spots = CALLOUTS[map] ?? ['mid'];
  return tpl.replace('{p}', p).replace('{t}', t).replace('{s}', spots[rand(spots.length)]);
};
