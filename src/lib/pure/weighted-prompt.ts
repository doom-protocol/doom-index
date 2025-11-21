/**
 * Doom Index Prompt Generation
 * World-scale baroque allegorical painting with weighted elements based on market cap
 */

import { TOKEN_TICKERS, type TokenTicker, type McMap } from "@/constants/token";
import {
  WORLD_PAINTING_HUMAN_ELEMENT_TEXT,
  WORLD_PAINTING_NEGATIVE_PROMPT,
  WORLD_PAINTING_OPENING_LINE,
  WORLD_PAINTING_STYLE_BASE,
  WORLD_PAINTING_TOKEN_PHRASES,
} from "@/constants/prompts/world-painting";

/**
 * Configuration for dominance weight calculation
 */
export type DominanceWeightConfig = {
  /** Minimum weight value (applied to lowest market cap tokens) */
  minWeight: number;
  /** Maximum weight value (applied to highest market cap token) */
  maxWeight: number;
  /** Exponent for non-linear transformation (higher = stronger dominance emphasis) */
  exponent: number;
  /** List of tokens to process */
  tokens: readonly TokenTicker[];
};

/**
 * Default configuration for dominance weight calculation
 */
export const DEFAULT_DOMINANCE_CONFIG: DominanceWeightConfig = {
  minWeight: 0.1,
  maxWeight: 2.0,
  exponent: 2.0,
  tokens: TOKEN_TICKERS,
};

/**
 * Pure function: Calculate relative dominance-based weights
 *
 * Emphasizes differences between tokens by using relative ratios
 * and applying non-linear transformation to amplify dominance.
 *
 * This is a pure function with all dependencies injected, making it
 * easy to test with different configurations.
 *
 * @param mc - Market cap map for all tokens
 * @param config - Configuration for weight calculation
 * @returns Map of token ticker to calculated weight
 */
export function calculateDominanceWeights(
  mc: McMap,
  config: DominanceWeightConfig = DEFAULT_DOMINANCE_CONFIG,
): Record<TokenTicker, number> {
  const { minWeight, maxWeight, exponent, tokens } = config;

  const clamp = (x: number, min = minWeight, max = maxWeight) => Math.max(min, Math.min(max, x));

  // Find max market cap (dominant token)
  const maxMc = Math.max(...tokens.map(t => mc[t] || 0));

  if (maxMc === 0) {
    // All zeros: return uniform minimum weights
    return tokens.reduce((acc, t) => ({ ...acc, [t]: minWeight }), {} as Record<TokenTicker, number>);
  }

  // Calculate relative ratios (0 to 1)
  const ratios = tokens.reduce(
    (acc, t) => {
      const ratio = (mc[t] || 0) / maxMc;
      acc[t] = ratio;
      return acc;
    },
    {} as Record<TokenTicker, number>,
  );

  // Apply non-linear transformation to emphasize dominance
  // Higher exponent makes dominant tokens stand out more
  const transformed = tokens.reduce(
    (acc, t) => {
      const ratio = ratios[t];
      // Apply power function: ratio^exponent
      // This makes small differences more pronounced
      const transformedRatio = Math.pow(ratio, exponent);
      // Map to weight range: minWeight to maxWeight
      const weight = minWeight + transformedRatio * (maxWeight - minWeight);
      acc[t] = clamp(weight);
      return acc;
    },
    {} as Record<TokenTicker, number>,
  );

  return transformed;
}

const safeWeight = (w: number, minWeight: number = DEFAULT_DOMINANCE_CONFIG.minWeight) => (w === 0 ? minWeight : w);

const HUMAN_ELEMENT = {
  text: WORLD_PAINTING_HUMAN_ELEMENT_TEXT,
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
 * Uses relative dominance-based weighting to emphasize differences
 * Sorted by weight (descending) for generation stability
 */
export function toWeightedFragments(
  mc: McMap,
  config: DominanceWeightConfig = DEFAULT_DOMINANCE_CONFIG,
): WeightedFragment[] {
  const { tokens, minWeight } = config;

  // Calculate dominance-based weights
  const weights = calculateDominanceWeights(mc, config);

  const fragments = tokens.map(ticker => ({
    text: WORLD_PAINTING_TOKEN_PHRASES[ticker],
    weight: safeWeight(weights[ticker], minWeight),
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
 *
 * Template structure:
 * - Opening line with theme
 * - Weighted fragments (sorted by weight descending)
 * - Style base (fixed)
 * - Negative prompt (included in the prompt string)
 * - All elements are always included, weighted by market cap
 */
export function buildSDXLPrompt(mc: McMap): { prompt: string; negative: string } {
  const fragments = toWeightedFragments(mc);

  const weightedLines = fragments.map(f => `(${f.text}:${f.weight.toFixed(2)})`).join(",\n");

  // Deterministic summary to increase sensitivity without changing weight formatting
  const weightsOnly = fragments.map(f => f.weight);
  const sum = weightsOnly.reduce((a, b) => a + b, 0);
  const min = Math.min(...weightsOnly);
  const max = Math.max(...weightsOnly);
  const summary = `weights summary: sum=${sum.toFixed(3)}, min=${min.toFixed(3)}, max=${max.toFixed(3)}`;

  const prompt = [
    WORLD_PAINTING_OPENING_LINE,
    weightedLines + ",",
    WORLD_PAINTING_STYLE_BASE + ",",
    summary + ",",
    `negative prompt: ${WORLD_PAINTING_NEGATIVE_PROMPT}`,
  ].join("\n");

  return {
    prompt,
    negative: WORLD_PAINTING_NEGATIVE_PROMPT,
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
  const { width = 1024, height = 1024, steps = 30, cfg = 5.5, seed = 42 } = options;

  return {
    style: WORLD_PAINTING_STYLE_BASE,
    negatives: WORLD_PAINTING_NEGATIVE_PROMPT,
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

  const prompt = [WORLD_PAINTING_OPENING_LINE, weightedPhrases + ",", WORLD_PAINTING_STYLE_BASE].join(" ");

  return {
    prompt,
    negative: WORLD_PAINTING_NEGATIVE_PROMPT,
  };
}
