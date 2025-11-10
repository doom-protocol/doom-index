/**
 * Doom Index Prompt Generation
 * Medieval allegorical painting with weighted elements based on market cap
 */

import type { TokenTicker, McMap } from "@/constants/token";

const THRESHOLD = 1_000_000;
const MIN_WEIGHT = 0.01;
const MAX_WEIGHT = 1.5;

const clamp = (x: number, min = 0, max = MAX_WEIGHT) => Math.max(min, Math.min(max, x));
const normalize = (mc: number) => clamp(mc / THRESHOLD);
const safeWeight = (w: number) => (w === 0 ? MIN_WEIGHT : w);

/**
 * Token phrase mapping for allegorical elements
 */
const TOKEN_PHRASE: Record<TokenTicker, string> = {
  CO2: "dense toxic smog in the sky",
  ICE: "glittering blue glaciers and cold reflections",
  FOREST: "lush emerald forests and living roots",
  NUKE: "blinding nuclear flash on the horizon",
  MACHINE: "colossal dystopian machine towers and metal grids",
  PANDEMIC: "bioluminescent spores and organic clusters",
  FEAR: "oppressive darkness with many red eyes",
  HOPE: "radiant golden divine light breaking the clouds",
};

/**
 * Fixed style elements
 */
const STYLE_BASE =
  "medieval renaissance allegorical oil painting, Bosch and Bruegel influence, chiaroscuro lighting, thick oil texture, symbolic architecture, detailed human figures, cohesive single landscape";

const NEGATIVE_PROMPT = "watermark, text, logo, oversaturated colors, low detail hands, extra limbs";

const HUMAN_ELEMENT = {
  text: "medieval figures praying, trading, recording the scene",
  weight: 1.0,
};

/**
 * Weighted fragment for prompt composition
 */
export type WeightedFragment = {
  text: string;
  weight: number;
};

/**
 * Convert market cap map to weighted fragments
 * Sorted by weight (descending) for generation stability
 */
export function toWeightedFragments(mc: McMap): WeightedFragment[] {
  const tokens: TokenTicker[] = ["CO2", "ICE", "FOREST", "NUKE", "MACHINE", "PANDEMIC", "FEAR", "HOPE"];

  const fragments = tokens.map(ticker => ({
    text: TOKEN_PHRASE[ticker],
    weight: safeWeight(normalize(mc[ticker])),
  }));

  // Sort by weight descending
  fragments.sort((a, b) => b.weight - a.weight);

  // Add human element at the end (fixed anchor)
  fragments.push(HUMAN_ELEMENT);

  return fragments;
}

/**
 * Build SDXL-style prompt with bracket weights
 * Format: (phrase:weight)
 */
export function buildSDXLPrompt(mc: McMap): { prompt: string; negative: string } {
  const fragments = toWeightedFragments(mc);

  const weightedLines = fragments.map(f => `(${f.text}:${f.weight.toFixed(2)})`).join(",\n");

  const prompt = [
    "a grand medieval allegorical oil painting of the world, all forces visible and weighted by real-time power,",
    weightedLines + ",",
    STYLE_BASE,
  ].join("\n");

  return {
    prompt,
    negative: NEGATIVE_PROMPT,
  };
}

/**
 * Build generic payload for Runware or other APIs
 * Returns structured data with fragment array
 */
export function buildGenericPayload(
  mc: McMap,
  options: {
    width?: number;
    height?: number;
    steps?: number;
    cfg?: number;
    seed?: number;
  } = {},
) {
  const { width = 1280, height = 720, steps = 30, cfg = 5.5, seed = 42 } = options;

  return {
    style: STYLE_BASE,
    negatives: NEGATIVE_PROMPT,
    fragments: toWeightedFragments(mc),
    width,
    height,
    steps,
    cfg,
    seed,
  };
}

/**
 * Build simple concatenated prompt (fallback for basic APIs)
 */
export function buildSimplePrompt(mc: McMap): { prompt: string; negative: string } {
  const fragments = toWeightedFragments(mc);

  // Create a weighted description by repeating phrases based on weight
  const weightedPhrases = fragments
    .map(f => {
      const intensity = Math.round(f.weight * 2); // 0-3 repetitions
      return Array(Math.max(1, intensity)).fill(f.text).join(", ");
    })
    .join(", ");

  const prompt = [
    "a grand medieval allegorical oil painting of the world, all forces visible and weighted by real-time power,",
    weightedPhrases + ",",
    STYLE_BASE,
  ].join(" ");

  return {
    prompt,
    negative: NEGATIVE_PROMPT,
  };
}
