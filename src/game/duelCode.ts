// The compact form of a duel link. A link used to carry the whole duel as JSON, so the names of every roster, player and case
// made it 1,300 to 1,700 characters long, and some chat apps, email scanners and proxies cut or block links that long. This
// form is a few hundred bytes: rosters, players and coaches are three-byte codes, taken from a hash of their id. A code depends
// only on its own id, so adding a roster or a player never changes another one's code, and an old link still reads.
//
// A link from before this form is base64url of JSON, which starts with "{" (0x7b). This form starts with FORMAT, so the two can
// always be told apart. If any id in a duel has no clean code, the duel is written in the old form rather than wrongly.
import { COACHES, ROLE_ORDER, ROSTERS } from '../data/rosters';
import type { Duel } from './duel';

export const FORMAT = 3;
const JSON_START = 0x7b;
const ERA = [undefined, 'csgo', 'cs2'] as const;
const POOL = [undefined, 'champions', 'underdogs'] as const;
const enc = new TextEncoder();
const dec = new TextDecoder();

/** Three bytes from an FNV-1a hash of the kind and the id. Stable: nothing about other ids goes into it. */
const hash24 = (text: string) => {
  let h = 0x811c9dc5;
  for (const b of enc.encode(text)) { h ^= b; h = Math.imul(h, 0x01000193); }
  return h & 0xffffff;
};

interface Table { toCode: Map<string, number>; toId: Map<number, string>; clashes: string[] }

/** The codes for one kind of id. Two ids that hash alike are both left out (and listed in `clashes`), so a clash falls back to the old form. */
function table(kind: string, ids: Iterable<string>): Table {
  const toCode = new Map<string, number>();
  const toId = new Map<number, string>();
  const clashes: string[] = [];
  for (const id of new Set(ids)) {
    const c = hash24(`${kind}:${id}`);
    const other = toId.get(c);
    if (other === undefined) { toId.set(c, id); toCode.set(id, c); continue; }
    clashes.push(id, other);
    toId.delete(c); toCode.delete(other);
  }
  return { toCode, toId, clashes };
}

const rosterTable = table('roster', ROSTERS.map((r) => r.id));
const playerTable = table('player', ROSTERS.flatMap((r) => r.players.map((p) => p.id)));
const coachTable = table('coach', Object.keys(COACHES));

/** Ids that could not get a clean code. Empty in the data as shipped; a test checks it. */
export const unencodableIds = (): string[] => [...rosterTable.clashes, ...playerTable.clashes, ...coachTable.clashes];

/** The compact bytes for a duel, or null when it has something this form cannot hold (an unknown id, an odd shape). */
export function writeCompact(d: Duel): Uint8Array | null {
  try {
    const out: number[] = [];
    const u8 = (n: number) => { if (!Number.isInteger(n) || n < 0 || n > 255) throw new Error('range'); out.push(n); };
    const code = (c: number | undefined) => { if (c === undefined) throw new Error('unknown id'); out.push(c >>> 16, (c >>> 8) & 255, c & 255); };
    const text = (s: string) => { const b = enc.encode(s); u8(b.length); out.push(...b); };
    if (d.date !== undefined && d.seed !== `daily-${d.date}`) throw new Error('date');
    if (d.v !== 2 && d.offers !== undefined) throw new Error('offers');
    if (d.picks.length !== ROLE_ORDER.length) throw new Error('picks');
    // Options are written only when they are exactly the known shape. Anything else (a string, null, a bad value) goes in the JSON form,
    // where the game refuses it the same way it always has.
    const o = d.opts as { era?: unknown; pool?: unknown; hard?: unknown } | undefined;
    if (o !== undefined && (typeof o !== 'object' || o === null || Array.isArray(o))) throw new Error('opts');
    if (o && o.hard !== undefined && typeof o.hard !== 'boolean') throw new Error('opts');
    const era = o?.era === undefined ? 0 : ERA.indexOf(o.era as (typeof ERA)[number]);
    const pool = o?.pool === undefined ? 0 : POOL.indexOf(o.pool as (typeof POOL)[number]);
    if (o && (era < 0 || pool < 0)) throw new Error('opts');
    const flags = (d.v === 2 ? 1 : 0) | (d.date !== undefined ? 2 : 0) | (d.coach != null ? 4 : 0) | (d.bench != null ? 8 : 0) | (o !== undefined ? 16 : 0) | (d.rules !== undefined ? 32 : 0);
    out.push(FORMAT, flags);
    text(d.name);
    text(d.seed);
    if (o !== undefined) u8(era | (pool << 2) | (o?.hard === true ? 16 : 0));
    if (d.rules !== undefined) u8(d.rules);
    if (d.v === 2) {
      if (!d.offers) throw new Error('offers');
      u8(d.offers.length);
      for (const round of d.offers) {
        u8(round.length);
        for (const cases of round) { u8(cases.length); for (const id of cases) code(rosterTable.toCode.get(id)); }
      }
    }
    d.picks.forEach(([role, rid, pid], i) => {
      if (role !== ROLE_ORDER[i]) throw new Error('role order');
      code(rosterTable.toCode.get(rid));
      code(playerTable.toCode.get(pid));
    });
    if (d.coach != null) code(coachTable.toCode.get(d.coach));
    if (d.bench != null) { code(rosterTable.toCode.get(d.bench[0])); code(playerTable.toCode.get(d.bench[1])); }
    return Uint8Array.from(out);
  } catch {
    return null;
  }
}

/** Reads the compact form back into a duel. Throws on anything malformed or unknown; the caller then refuses the link. */
export function readCompact(bytes: Uint8Array): Duel {
  let i = 0;
  const u8 = () => { if (i >= bytes.length) throw new Error('short'); return bytes[i++]; };
  const code = () => (u8() << 16) | (u8() << 8) | u8();
  const text = () => { const n = u8(); if (i + n > bytes.length) throw new Error('short'); const s = dec.decode(bytes.subarray(i, i + n)); i += n; return s; };
  const lookup = (t: Table, c: number) => { const id = t.toId.get(c); if (id === undefined) throw new Error('unknown code'); return id; };
  if (u8() !== FORMAT) throw new Error('format');
  const flags = u8();
  const d: any = { v: flags & 1 ? 2 : 1, name: text(), seed: text() };
  if (flags & 2) d.date = d.seed.replace(/^daily-/, '');
  if (flags & 16) {
    const o = u8();
    const opts: Record<string, unknown> = {};
    if (ERA[o & 3]) opts.era = ERA[o & 3];
    if (POOL[(o >> 2) & 3]) opts.pool = POOL[(o >> 2) & 3];
    if (o & 16) opts.hard = true;
    d.opts = opts;
  }
  if (flags & 32) d.rules = u8();
  if (d.v === 2) {
    const rounds = u8();
    d.offers = Array.from({ length: rounds }, () => Array.from({ length: u8() }, () => Array.from({ length: u8() }, () => lookup(rosterTable, code()))));
  }
  d.picks = ROLE_ORDER.map((role) => [role, lookup(rosterTable, code()), lookup(playerTable, code())]);
  d.coach = flags & 4 ? lookup(coachTable, code()) : null;
  d.bench = flags & 8 ? [lookup(rosterTable, code()), lookup(playerTable, code())] : null;
  return d as Duel;
}

/** A link's payload: the compact form when it can hold the duel, else the older JSON. */
export function payloadOf(d: Duel): Uint8Array {
  return writeCompact(d) ?? enc.encode(JSON.stringify(d));
}

/** Reads a payload in either form. Returns the duel as written, unchecked; the caller runs validDuel. */
export function duelFromPayload(bytes: Uint8Array): unknown {
  if (bytes[0] === JSON_START) return JSON.parse(dec.decode(bytes));
  return readCompact(bytes);
}

// base64url, with no padding, so a link is only letters, digits, "-" and "_".
export const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const fromBase64Url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
