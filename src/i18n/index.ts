import { Fragment, createElement, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { en, plurals, type Messages, type PluralMessages } from './en';

// The text layer (#275). Every player-facing sentence lives in a catalogue (en.ts, and one file per other language), and
// the screens ask for it by key. English is the fallback, so a missing translation shows English, never a blank.

/** Every language the game ships. To add one: a catalogue file that exports `messages` (and `plurals`), then one line here. */
export const LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
];

const catalogues: Record<string, { messages: Messages; plurals: PluralMessages }> = {
  en: { messages: en, plurals },
};

export type MessageKey = keyof Messages;
export type PluralKey = keyof PluralMessages;
type Vars = Record<string, string | number>;

let language = 'en';
const listeners = new Set<() => void>();

export const isSupported = (code: string) => code in catalogues;
export const getLanguage = () => language;

/** Switches the language and tells every mounted screen. The page's lang attribute follows, for screen readers and hyphenation. */
export function setLanguage(code: string) {
  language = isSupported(code) ? code : 'en';
  if (typeof document !== 'undefined') document.documentElement.lang = language;
  listeners.forEach((fn) => fn());
}

/** The language to use: the saved choice if it is supported, else the first browser language that is, else English. */
export function resolveLanguage(saved: string | null | undefined, browserLanguages: readonly string[] = []): string {
  if (saved && isSupported(saved)) return saved;
  for (const tag of browserLanguages) {
    if (isSupported(tag)) return tag;
    const base = tag.split('-')[0];
    if (isSupported(base)) return base;
  }
  return 'en';
}

/** Re-renders a component when the language changes. Call it in any component whose text comes from `t`. */
export function useT(): typeof t {
  useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, getLanguage);
  return t;
}

const fill = (text: string, vars?: Vars) => (vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text);

/** The text for a key, with its {placeholders} filled in. */
export function t(key: MessageKey, vars?: Vars): string {
  const text = catalogues[language]?.messages[key] ?? en[key];
  return fill(text, vars);
}

/**
 * A sentence with React elements in it (a link, a button): the elements take the places of {placeholders}, so the whole
 * sentence stays one message. Returns the pieces in order.
 */
export function tNode(key: MessageKey, vars: Record<string, ReactNode>): ReactNode[] {
  const text = catalogues[language]?.messages[key] ?? en[key];
  const out: ReactNode[] = [];
  text.split(/(\{\w+\})/).forEach((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    if (!m) { if (part) out.push(part); return; }
    out.push(m[1] in vars ? createElement(Fragment, { key: i }, vars[m[1]]) : part);
  });
  return out;
}

/** A plural message: picks the form for the current language's plural rules, and fills {n}. */
export function plural(key: PluralKey, n: number, vars?: Vars): string {
  const forms = catalogues[language]?.plurals[key] ?? plurals[key];
  const category = new Intl.PluralRules(language).select(n);
  const text = forms[category as keyof typeof forms] ?? forms.other;
  return fill(text, { n, ...vars });
}

/** Numbers, dates and lists in the current language. Use these rather than building the strings by hand. */
export const formatNumber = (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(language, opts).format(n);
export const formatDate = (d: Date | number, opts?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(language, opts).format(d);
// Intl.ListFormat is not in this project's TypeScript library, so its shape is declared here.
type ListFormatter = { format(items: string[]): string };
type ListFormatConstructor = new (locale: string, opts: { style: 'long' | 'short' | 'narrow'; type: 'conjunction' | 'disjunction' | 'unit' }) => ListFormatter;
export const formatList = (items: string[], type: 'conjunction' | 'disjunction' | 'unit' = 'conjunction') =>
  new (Intl as unknown as { ListFormat: ListFormatConstructor }).ListFormat(language, { style: 'long', type }).format(items);
