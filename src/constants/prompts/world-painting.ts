/**
 * Prompt constants for Doom Index "world allegorical painting" style.
 * Centralized management of base styles and token-specific motifs that are
 * "prepared statement" style strings shared across the entire image generation pipeline.
 */

/**
 * Negative prompt always applied during image generation.
 * Used to suppress artifacts and unwanted elements.
 */
export const WORLD_PAINTING_NEGATIVE_PROMPT =
  "watermark, text, logo, oversaturated colors, low detail hands, extra limbs";

/**
 * Base opening line for all medieval allegorical painting prompts.
 * This establishes the core concept: a world-scale painting with weighted forces.
 */
export const MEDIEVAL_ALLEGORICAL_OPENING =
  "a grand medieval allegorical oil painting of the world, all forces visible and weighted by real-time power,";

/**
 * Fixed style description that ends all prompts.
 * Defines the artistic style, technique, and composition approach.
 */
export const MEDIEVAL_ALLEGORICAL_STYLE_DESCRIPTION =
  "medieval renaissance allegorical oil painting, Bosch and Bruegel influence, chiaroscuro lighting, thick oil texture, symbolic architecture, detailed human figures, cohesive single landscape,";

/**
 * Fixed human element that must be included in all prompts.
 * Represents observers/participants in the allegorical scene.
 */
export const MEDIEVAL_FIGURES_ELEMENT = "(medieval figures praying, trading, recording the scene:1.00)";

/**
 * Symbolic visual elements mapped to archetype and climate combinations.
 * These elements represent different forces in the allegorical painting.
 */
export const SYMBOLIC_ELEMENTS = {
  "dense toxic smog in the sky": "dense toxic smog in the sky",
  "glittering blue glaciers and cold reflections": "glittering blue glaciers and cold reflections",
  "lush emerald forests and living roots": "lush emerald forests and living roots",
  "blinding nuclear flash on the horizon": "blinding nuclear flash on the horizon",
  "colossal dystopian machine towers and metal grids": "colossal dystopian machine towers and metal grids",
  "bioluminescent spores and organic clusters": "bioluminescent spores and organic clusters",
  "oppressive darkness with many red eyes": "oppressive darkness with many red eyes",
  "radiant golden divine light breaking the clouds": "radiant golden divine light breaking the clouds",
} as const;

/**
 * Mapping of archetype and climate to symbolic visual elements.
 * Used to determine which elements should appear based on token characteristics.
 */
export const ARCHETYPE_CLIMATE_ELEMENT_MAP: Record<string, Record<string, keyof typeof SYMBOLIC_ELEMENTS>> = {
  "l1-sovereign": {
    euphoria: "radiant golden divine light breaking the clouds",
    cooling: "glittering blue glaciers and cold reflections",
    despair: "oppressive darkness with many red eyes",
    panic: "dense toxic smog in the sky",
    transition: "lush emerald forests and living roots",
  },
  "meme-ascendant": {
    euphoria: "bioluminescent spores and organic clusters",
    cooling: "glittering blue glaciers and cold reflections",
    despair: "oppressive darkness with many red eyes",
    panic: "blinding nuclear flash on the horizon",
    transition: "lush emerald forests and living roots",
  },
  privacy: {
    euphoria: "radiant golden divine light breaking the clouds",
    cooling: "glittering blue glaciers and cold reflections",
    despair: "oppressive darkness with many red eyes",
    panic: "dense toxic smog in the sky",
    transition: "lush emerald forests and living roots",
  },
  "ai-oracle": {
    euphoria: "colossal dystopian machine towers and metal grids",
    cooling: "glittering blue glaciers and cold reflections",
    despair: "oppressive darkness with many red eyes",
    panic: "blinding nuclear flash on the horizon",
    transition: "bioluminescent spores and organic clusters",
  },
  political: {
    euphoria: "radiant golden divine light breaking the clouds",
    cooling: "dense toxic smog in the sky",
    despair: "oppressive darkness with many red eyes",
    panic: "blinding nuclear flash on the horizon",
    transition: "lush emerald forests and living roots",
  },
  "perp-liquidity": {
    euphoria: "colossal dystopian machine towers and metal grids",
    cooling: "glittering blue glaciers and cold reflections",
    despair: "oppressive darkness with many red eyes",
    panic: "dense toxic smog in the sky",
    transition: "bioluminescent spores and organic clusters",
  },
} as const;

/**
 * Default symbolic element when archetype/climate combination is not found.
 */
export const DEFAULT_SYMBOLIC_ELEMENT: keyof typeof SYMBOLIC_ELEMENTS = "lush emerald forests and living roots";

/**
 * Get symbolic element for a given archetype and climate combination.
 *
 * @param archetype - Token archetype (e.g., "l1-sovereign", "meme-ascendant")
 * @param climate - Market climate (e.g., "euphoria", "cooling", "despair")
 * @returns Symbolic element key
 */
export function getSymbolicElementForArchetypeClimate(
  archetype: string,
  climate: string,
): keyof typeof SYMBOLIC_ELEMENTS {
  return (
    ARCHETYPE_CLIMATE_ELEMENT_MAP[archetype]?.[climate] ||
    ARCHETYPE_CLIMATE_ELEMENT_MAP["unknown"]?.[climate] ||
    DEFAULT_SYMBOLIC_ELEMENT
  );
}
