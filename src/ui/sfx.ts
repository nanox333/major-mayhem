// Sound effects are short recorded samples (credits and licences in assets-src/sounds/CREDITS.md), played through the Web
// Audio API. This file says which samples make up each game event and how they are layered, varied and levelled; sound.ts owns
// the audio context and the decoding. Nothing here touches the page, so the tests can run it against a stub context.

export const SFX_NAMES = [
  'click', 'tick', 'open', 'reveal', 'reroll', 'draft', 'found', 'accept', 'ban', 'call',
  'roundWin', 'roundLoss', 'clutch', 'half', 'mapWin', 'mapLose', 'champion', 'achievement', 'hit', 'near', 'miss',
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

/** The recipe table. Effects are keyed by name; a reveal is keyed `reveal:<rarity>`. */
export const RECIPES: Record<string, Recipe> = {};

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
