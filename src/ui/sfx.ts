// Sound effects are short recorded samples (credits and licences in assets-src/sounds/CREDITS.md), played through the Web
// Audio API. This file says which samples make up each game event and how they are layered, varied and levelled; sound.ts owns
// the audio context and the decoding. Nothing here touches the page, so the tests can run it against a stub context.

export const SFX_NAMES = [
  'click', 'tick', 'open', 'reveal', 'reroll', 'draft', 'found', 'accept', 'ban', 'call',
  'roundWin', 'roundLoss', 'clutch', 'legend', 'half', 'mapWin', 'mapLose', 'champion', 'achievement', 'hit', 'near', 'miss',
] as const;
export type Sfx = (typeof SFX_NAMES)[number];
export interface SfxOpts {
  /** 'reveal': the rarity of the team the case landed on; a rarer one gets a bigger sound. */
  rarity?: string;
  /** A playback-rate multiplier, so a run of ticks doesn't sound machine-gunned. */
  pitch?: number;
}

/** One recorded sound inside an effect: which file, when it starts (s after the effect), how loud, and how fast it plays. */
export interface Layer { file: string; at?: number; gain?: number; rate?: number }
/**
 * What an effect sounds like. `variants` are alternatives, one picked per play and never the same one twice running, and each
 * is a stack of layers played together. `jitter` randomises the playback rate by up to that fraction either way.
 */
export interface Recipe { variants: Layer[][]; gain?: number; jitter?: number }
/** Decoded samples by file id (the file name without its extension). */
export type Bank = ReadonlyMap<string, AudioBuffer>;

export const RARITIES = ['milspec', 'restricted', 'classified', 'covert', 'gold'] as const;

const L = (file: string, at = 0, gain = 1, rate = 1): Layer => ({ file, at, gain, rate });
const each = (...files: string[]) => files.map((f) => [L(f)]);

/**
 * The recipe table. Effects are keyed by name; a reveal is keyed `reveal:<rarity>`. The feel is dry and tactical: mechanical
 * clicks, heavy plate thuds with a metal clang, and pitched confirmations that stack up as a moment gets bigger. Sample ids are
 * the files in src/sounds (int- Interface Sounds, imp- Impact Sounds, cas- Casino Audio, sci- Sci-fi Sounds, all by Kenney).
 * Each recipe's gain sets where it sits in the mix. The sounds that fire constantly (clicks, ticks, round blips, guess clues) are barely there; the big moments carry the audio.
 */
export const RECIPES: Record<string, Recipe> = {
  click: { gain: 0.05, jitter: 0.04, variants: each('int-click-001', 'int-click-002', 'int-click-003', 'int-click-005') },
  tick: { gain: 0.05, jitter: 0.05, variants: each('int-tick-001', 'int-tick-002', 'int-click-001', 'int-click-005') },
  open: { gain: 0.6, jitter: 0.03, variants: [
    [L('imp-plate-heavy-000'), L('imp-metal-heavy-001', 0.015, 0.7), L('sci-door-open-000', 0.05, 0.35)],
    [L('imp-plate-heavy-002'), L('imp-metal-heavy-003', 0.015, 0.7), L('sci-door-open-001', 0.05, 0.35)],
    [L('imp-plate-heavy-003'), L('imp-metal-heavy-000', 0.015, 0.7), L('sci-door-open-002', 0.05, 0.35)],
  ] },
  'reveal:milspec': { gain: .15, variants: [[L('int-select-006')], [L('int-select-004')]] },
  'reveal:restricted': { gain: .45, variants: [[L('int-confirmation-001'), L('int-select-003', 0.05, 0.5)]] },
  'reveal:classified': { gain: 1.05, variants: [[L('int-confirmation-002'), L('int-glass-001', 0.06, 0.6)]] },
  'reveal:covert': { gain: 0.98, variants: [[L('int-confirmation-003'), L('int-glass-004', 0.05, 0.55), L('imp-metal-medium-003', 0, 0.5)]] },
  'reveal:gold': { gain: 0.6, variants: [[
    L('imp-soft-heavy-001', 0, 0.9), L('imp-bell-heavy-000'), L('int-confirmation-003', 0.08, 0.8), L('int-glass-004', 0.16, 0.7),
  ]] },
  reroll: { gain: 0.08, jitter: 0.03, variants: [[L('cas-slide-5')], [L('cas-slide-6')], [L('cas-shove-2', 0, 0.8)]] },
  draft: { gain: 0.3, jitter: 0.02, variants: [
    [L('imp-plate-light-000', 0, 0.8), L('int-confirmation-003', 0.03, 0.45)],
    [L('imp-metal-medium-002', 0, 0.8), L('int-confirmation-001', 0.03, 0.5)],
    [L('imp-plate-light-003', 0, 0.8), L('int-select-003', 0.03, 0.5)],
  ] },
  found: { gain: 0.85, variants: [
    [L('int-glass-001', 0, 0.8), L('int-confirmation-003', 0.16, 0.9), L('int-glass-004', 0.3, 0.6)],
    [L('int-question-003'), L('int-confirmation-003', 0.18), L('int-glass-004', 0.3, 0.5)],
  ] },
  accept: { gain: 0.3, variants: [
    [L('int-confirmation-003'), L('imp-metal-light-001', 0, 0.5)],
    [L('int-confirmation-001'), L('imp-metal-light-004', 0, 0.5)],
  ] },
  ban: { gain: 0.7, jitter: 0.03, variants: [
    [L('imp-plate-heavy-001'), L('imp-metal-heavy-002', 0.01, 0.7)],
    [L('imp-plate-heavy-003'), L('imp-metal-heavy-000', 0.01, 0.7)],
    [L('imp-plate-heavy-002'), L('imp-metal-heavy-003', 0.01, 0.7)],
  ] },
  call: { gain: 0.1, variants: [
    [L('int-select-001'), L('int-select-001', 0.11, 1, 1.3)],
    [L('int-select-002'), L('int-select-002', 0.11, 1, 1.3)],
  ] },
  roundWin: { gain: 0.06, jitter: 0.06, variants: each('int-select-001', 'int-select-002', 'int-glass-005') },
  roundLoss: { gain: 0.07, jitter: 0.06, variants: each('int-drop-002', 'int-drop-003', 'int-drop-004') },
  clutch: { gain: 0.55, variants: [
    [L('imp-punch-heavy-000'), L('imp-bell-heavy-003', 0.04, 0.7), L('int-confirmation-003', 0.1, 0.8), L('int-glass-004', 0.18, 0.7)],
    [L('imp-punch-heavy-003'), L('imp-bell-heavy-002', 0.04, 0.7), L('int-confirmation-003', 0.1, 0.8), L('int-glass-004', 0.18, 0.7)],
  ] },
  legend: { gain: 0.85, variants: [[
    L('sci-sub-boom-001', 0, 0.8), L('imp-bell-heavy-000', 0.02, 0.9, 0.9), L('int-confirmation-004', 0.08, 0.7), L('int-confirmation-003', 0.3, 0.8),
    L('int-glass-004', 0.42, 0.8), L('imp-bell-heavy-001', 0.5, 0.6, 1.3),
  ]] },
  half: { gain: 0.55, variants: [[L('imp-bell-heavy-001', 0, 1, 0.8), L('imp-plate-heavy-000', 0, 0.7)]] },
  mapWin: { gain: 0.72, variants: [[L('int-confirmation-002'), L('imp-bell-heavy-003', 0, 0.6), L('int-confirmation-003', 0.14, 0.8), L('int-glass-004', 0.24, 0.6)]] },
  mapLose: { gain: 0.89, variants: [[L('imp-soft-heavy-001'), L('int-error-005', 0.06, 0.5), L('int-drop-004', 0.22, 0.7)]] },
  champion: { gain: 0.89, variants: [[
    L('imp-bell-heavy-000'), L('sci-sub-boom-001', 0, 0.9), L('int-confirmation-004', 0.04, 0.8), L('int-confirmation-002', 0.34, 0.9),
    L('int-glass-004', 0.44, 0.8), L('imp-bell-heavy-001', 0.5, 0.6, 1.2),
  ]] },
  achievement: { gain: 0.68, variants: [[L('int-glass-001'), L('imp-bell-heavy-002', 0.02, 0.5, 1.6), L('int-confirmation-003', 0.14, 0.7)]] },
  hit: { gain: 0.15, variants: each('int-glass-002', 'int-glass-003') },
  near: { gain: 0.08, variants: each('int-pluck-001', 'int-pluck-002') },
  miss: { gain: 0.09, jitter: 0.03, variants: [[L('int-drop-002', 0, 1, 0.9)], [L('int-drop-003', 0, 1, 0.9)]] },
};

export const recipeKey = (name: Sfx, o: SfxOpts = {}) => (name === 'reveal' ? `reveal:${o.rarity ?? 'milspec'}` : name);

const lastPick = new Map<string, number>();
/** A random variant index that is never the one picked last time for this effect. */
export function pickVariant(key: string, count: number, rng: () => number = Math.random): number {
  if (count <= 1) return 0;
  let i = Math.floor(rng() * count);
  if (i === lastPick.get(key)) i = (i + 1 + Math.floor(rng() * (count - 1))) % count;
  lastPick.set(key, i);
  return i;
}
export const resetVariants = () => lastPick.clear();

/** Plays one effect onto `out` starting at audio-clock time `t`; returns its length in seconds (0 if nothing was played). */
export function renderSfx(
  c: BaseAudioContext, out: AudioNode, name: Sfx, t: number, o: SfxOpts, bank: Bank, recipes: Record<string, Recipe> = RECIPES, rng: () => number = Math.random,
): number {
  const key = recipeKey(name, o);
  const recipe = recipes[key] ?? recipes[name];
  if (!recipe) return 0;
  const layers = recipe.variants[pickVariant(key, recipe.variants.length, rng)];
  const rate = (o.pitch ?? 1) * (1 + (rng() * 2 - 1) * (recipe.jitter ?? 0));
  let end = 0;
  for (const layer of layers) {
    const buffer = bank.get(layer.file);
    if (!buffer) continue;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const layerRate = rate * (layer.rate ?? 1);
    src.playbackRate.value = layerRate;
    const gain = c.createGain();
    gain.gain.value = (recipe.gain ?? 1) * (layer.gain ?? 1);
    src.connect(gain);
    gain.connect(out);
    src.start(t + (layer.at ?? 0));
    end = Math.max(end, (layer.at ?? 0) + buffer.duration / layerRate);
  }
  return end;
}
