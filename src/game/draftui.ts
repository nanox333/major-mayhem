// What the draft screen says about your team while you build it: a hint from the open slots, live chemistry, a placement label.
// Display only: nothing here changes the draft, the simulation or a daily, so there is no rules version. (#108, #109, #104)
import { ROLE_LABEL, ROLE_ORDER, Role } from '../data/rosters';
import * as G from './logic';
import { Synergy, chemistryOf, synergies } from './synergy';

/** "an AWPer", "a Lurker": the label with the article it reads with. */
const withArticle = (label: string) => `${/^[AEIOU]/.test(label) ? 'an' : 'a'} ${label}`;
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

interface HintState { picks: G.Pick[]; extras?: boolean; coach?: string | null; bench?: G.Pick | null; opts?: { hard?: boolean } }

/**
 * One or two plain sentences about what the lineup still needs, built from the open slots only: never from ratings,
 * the case in front of you, or what wins. Hard mode names the open slots exactly as the team strip does and gives no advice about roles.
 */
export function draftHint(s: HintState): string {
  const hard = !!s.opts?.hard;
  const open = G.openSlots(s.picks).map((r) => ROLE_LABEL[r]);
  const coachOpen = !!s.extras && s.coach === undefined;
  const benchOpen = !!s.extras && !s.bench;
  if (hard) {
    const left = [...open, ...(coachOpen ? ['Coach'] : []), ...(benchOpen ? ['Bench'] : [])];
    return left.length ? `Still to fill: ${left.join(', ')}.` : 'Your team is set.';
  }
  if (open.length === ROLE_ORDER.length) return `Five slots to fill: ${list(open)}.`;
  if (open.length) return `You still need ${list(open.map(withArticle))}.`;
  if (coachOpen) return 'Your five are set. Now a coach: a better one lifts the team, and one who has coached your players adds chemistry.';
  if (benchOpen) return 'Last pick: a bench player, any role. You can sub them in for one match.';
  return 'Your team is set.';
}

/** The lineup you have so far, in slot order, so five picks read exactly as the lobby reads them. */
function lineupSoFar(picks: G.Pick[]): G.Lineup[] {
  return [...picks].sort((a, b) => ROLE_ORDER.indexOf(a.slot) - ROLE_ORDER.indexOf(b.slot)).map((pk) => {
    const roster = G.rosterById.get(pk.rosterId)!;
    return { slot: pk.slot, roster, player: roster.players.find((p) => p.id === pk.playerId)! };
  });
}

export type ChemistryWord = 'None yet' | 'Some' | 'Good' | 'Strong' | 'Clashing';
export interface Chemistry { rows: Synergy[]; word: ChemistryWord; /** 0 to 3, decoration only: the word carries the meaning. */ pips: 0 | 1 | 2 | 3 }

/** The chemistry total in one word, from the same value the lobby uses (0 to 3, minus penalties). */
export function chemistryWord(rows: Synergy[]): Pick<Chemistry, 'word' | 'pips'> {
  if (!rows.length) return { word: 'None yet', pips: 0 };
  const v = chemistryOf(rows);
  if (v < 0) return { word: 'Clashing', pips: 0 };
  if (v < 0.6) return { word: 'Some', pips: 1 };
  if (v < 1.5) return { word: 'Good', pips: 2 };
  return { word: 'Strong', pips: 3 };
}

/**
 * Chemistry for the picks you have so far. With five picks the rows are exactly the lobby's; with fewer, a lineup of one
 * can't have an "all one era" bonus. Hard mode leaves out the two-AWPers penalty, because it names a role.
 */
export function liveChemistry(picks: G.Pick[], coach: string | null | undefined, hard: boolean): Chemistry {
  const l = lineupSoFar(picks);
  let rows = synergies(l, coach);
  if (l.length < 2) rows = rows.filter((x) => x.kind !== 'era');
  if (hard) rows = rows.filter((x) => x.kind !== 'awp');
  return { rows, ...chemistryWord(rows) };
}

/** A team's result as a placement, for the badge on a team card: text as well as an icon. */
export function placementLabel(result: string): string {
  switch (result) {
    case 'Champions': return '1st place';
    case 'Runner-up': return '2nd place';
    case 'Semifinalist': return '3rd–4th place';
    case 'Quarterfinalist': return '5th–8th place';
    default: return result;
  }
}

/** The slot a click on a player fills: their main role when it's open, else the first open one they cover. Hard mode gives no default. */
export function defaultSlot(slots: Role[], main: Role, hard: boolean): Role | null {
  if (hard || !slots.length) return null;
  return slots.includes(main) ? main : slots[0];
}

/**
 * What a player is to you right now (#145): drafted into their main role, only into a second role because their main one is taken,
 * or not at all. One function, so the row, the preview, the confirm panel and the Twitch vote can't disagree.
 * `open` is the slots they could fill now (`slotsFor`). Hard mode has no roles to name: a player is either draftable or not.
 */
export type PlayerState =
  | { state: 'main'; would: Role | null; taken: null }
  | { state: 'secondary'; would: Role; taken: Role }
  | { state: 'unavailable'; would: null; taken: null };
export function playerState(p: { roles: Role[] }, open: Role[], hard: boolean): PlayerState {
  if (!open.length) return { state: 'unavailable', would: null, taken: null };
  if (hard) return { state: 'main', would: null, taken: null };
  if (open.includes(p.roles[0])) return { state: 'main', would: p.roles[0], taken: null };
  return { state: 'secondary', would: open[0], taken: p.roles[0] };
}

/** What one more pick (or a coach) does to chemistry (#143): the word before and after, the links it adds and removes, and the size of the change. */
export interface ChemPreview {
  before: ChemistryWord;
  after: ChemistryWord;
  added: Synergy[];
  removed: Synergy[];
  /** The change in the chemistry total the lobby uses (`chemistryOf`): what drafting this pick would really do. */
  delta: number;
  /** A link that would count, but the total is already at its cap, so it adds nothing. */
  capped: boolean;
}
export function chemPreview(before: { picks: G.Pick[]; coach?: string | null }, after: { picks: G.Pick[]; coach?: string | null }, hard: boolean): ChemPreview {
  const a = liveChemistry(before.picks, before.coach, hard);
  const b = liveChemistry(after.picks, after.coach, hard);
  const same = (x: Synergy, y: Synergy) => x.label === y.label && x.value === y.value;
  const added = b.rows.filter((x) => !a.rows.some((y) => same(x, y)));
  const removed = a.rows.filter((x) => !b.rows.some((y) => y.label === x.label));
  const delta = chemistryOf(b.rows) - chemistryOf(a.rows);
  const capped = added.some((x) => x.value > 0) && !added.some((x) => x.value < 0) && delta < 1e-9;
  return { before: a.word, after: b.word, added, removed, delta, capped };
}

/** The lineup slot a preview sits in: a role, 'coach' or 'bench'. */
export interface Preview {
  slot: string | null;
  rosterId: string;
  /** Set for a player; a coach has only the roster they coached at. */
  playerId?: string;
  coach?: string;
  chem: ChemPreview | null;
}

// ---------- a player's Majors (#48) and your team's maps (#49) ----------
const SHORT_RESULT: Record<string, string> = { Champions: '1st', 'Runner-up': '2nd', Semifinalist: 'SF', Quarterfinalist: 'QF' };
let byPlayer: Map<string, { year: number; org: string; result: string }[]> | null = null;
/** The Majors a player attended in this game's data, oldest first, each with how far their team got: "2016 SF", "2018 1st". */
export function majorsOf(playerId: string): { year: number; org: string; result: string }[] {
  if (!byPlayer) {
    byPlayer = new Map();
    for (const r of [...G.rosterById.values()].sort((a, b) => a.year - b.year)) for (const p of r.players) {
      const list = byPlayer.get(p.id) ?? [];
      list.push({ year: r.year, org: r.org, result: SHORT_RESULT[r.result] ?? r.result });
      byPlayer.set(p.id, list);
    }
  }
  return byPlayer.get(playerId) ?? [];
}

export type ComfortWord = 'strong' | 'average' | 'weak';
/** How at home your five are on each map, best first, before the veto (#49): the same pips the veto shows, with a word for each so it doesn't rely on counting. */
export function mapComfort(lineup: G.Lineup[]): { map: string; pips: number; word: ComfortWord }[] {
  return G.MAPS.map((map) => {
    const pips = G.comfortPips(G.comfort(lineup, map));
    return { map, pips, word: (pips >= 4 ? 'strong' : pips <= 2 ? 'weak' : 'average') as ComfortWord };
  }).sort((a, b) => b.pips - a.pips || a.map.localeCompare(b.map));
}

/** Two candidates are the same pick only when they are the same person offered from the same roster: one player in two rosters has different teammates and chemistry (#173). */
export const sameCandidate = (a: { r: { id: string }; p: { id: string } } | null | undefined, b: { r: { id: string }; p: { id: string } } | null | undefined) =>
  !!a && !!b && a.p.id === b.p.id && a.r.id === b.r.id;
