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
 * Enhanced to resist reference image style influence with more explicit oil painting characteristics.
 */
export const MEDIEVAL_ALLEGORICAL_STYLE_DESCRIPTION =
  "classical oil painting technique, realistic brushwork with visible impasto and texture, renaissance master style with deep chiaroscuro lighting, rich pigmented colors, detailed human figures with naturalistic anatomy, symbolic medieval architecture, cohesive panoramic landscape, traditional oil on canvas appearance, maintaining classical painting aesthetic regardless of reference image style,";

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
const ARCHETYPE_CLIMATE_ELEMENT_MAP: Record<string, Record<string, keyof typeof SYMBOLIC_ELEMENTS>> = {
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
const DEFAULT_SYMBOLIC_ELEMENT: keyof typeof SYMBOLIC_ELEMENTS = "lush emerald forests and living roots";

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

/**
 * Narrative moment templates based on market dynamics.
 * Each template describes a specific dramatic moment with characters, actions, and consequences.
 * These follow FLUX's context-focused prompt structure: Setting → Action → Style → Context
 */
export type NarrativeMoment = {
  /** The scene/setting - what is happening where */
  scene: string;
  /** The main action - the decisive moment being captured */
  mainAction: string;
  /** Supporting figures and their actions */
  figures: string;
  /** Atmospheric conditions and lighting */
  atmosphere: string;
  /** Symbolic elements that reinforce the narrative */
  symbols: string;
};

export const NARRATIVE_MOMENTS: Record<string, NarrativeMoment> = {
  // Token rising + Market euphoria = "Coronation"
  "rising-euphoria": {
    scene: "triumphant coronation ceremony at golden dawn",
    mainAction:
      "a divine monarch ascending a thousand-step stairway to heaven, golden crown being placed by celestial hands",
    figures:
      "jubilant crowds throwing flowers and golden coins, priests blessing the ascent with sacred oils, angels descending with crowns and banners",
    atmosphere:
      "radiant golden light breaking through clouds, rainbow halos surrounding the monarch, warm sunrise colors",
    symbols:
      "banners unfurling in divine wind, doves taking flight, fountains overflowing with liquid light, hourglasses filling with gold",
  },

  // Token rising + Market despair = "Savior emerging"
  "rising-despair": {
    scene: "a lone hero emerging from darkness into battlefield",
    mainAction: "a glowing figure lifting a sacred sword from ruins, light spreading from the blade",
    figures:
      "desperate survivors turning toward the light with hope, fallen warriors beginning to rise, shadows fleeing from the radiance",
    atmosphere: "single beam of golden light piercing apocalyptic darkness, contrast between light and shadow",
    symbols: "chains breaking, dead flowers blooming, tears turning to stars, bridges being rebuilt",
  },

  // Token falling + Market euphoria = "Betrayal"
  "falling-euphoria": {
    scene: "tragic fall during grand celebration",
    mainAction: "a crumbling throne collapsing as feast continues around it, monarch falling backward",
    figures:
      "oblivious dancers celebrating in foreground, blind merchants counting gold, prophets ignored while pointing at doom",
    atmosphere: "bright festive lights casting ominous shadows, warm colors contrasting with cold reality",
    symbols: "masks cracking, mirrors shattering, wine turning to blood, hourglasses emptying rapidly",
  },

  // Token falling + Market panic = "Apocalypse"
  "falling-panic": {
    scene: "final moments before total collapse",
    mainAction: "massive temple splitting in half as crowds flee, sacred flame extinguished",
    figures:
      "merchants abandoning treasure chests, priests dropping holy books, children crying, warriors running in all directions",
    atmosphere: "crimson sky with ash falling, meteors streaking overhead, reality cracking like glass",
    symbols: "hourglasses shattering, scales tipping violently, bridges collapsing, chains binding everything",
  },

  // High volatility = "Battle/Storm"
  "extreme-volatility": {
    scene: "cosmic battle between opposing forces",
    mainAction: "armies of light and shadow clashing at the world's center, reality tearing at the seams",
    figures:
      "warriors frozen mid-strike, angels and demons locked in combat, wizards casting spells, merchants caught between sides",
    atmosphere:
      "lightning splitting the sky, multiple suns and moons appearing and vanishing, ground erupting with geysers",
    symbols:
      "spinning wheels of fortune, colliding celestial bodies, time itself fragmenting, scales tipping back and forth",
  },

  // Token stable + Market transition = "Pilgrimage"
  "stable-transition": {
    scene: "sacred pilgrimage through changing seasons",
    mainAction: "a long procession crossing from autumn into spring, pilgrims carrying relics forward",
    figures:
      "pilgrims carrying sacred objects, merchants on the road, monks in meditation, guards watching the horizon",
    atmosphere: "half the sky sunset orange, half sunrise pink, gentle transition of colors",
    symbols: "scales perfectly balanced, rivers meeting, compass pointing both ways, hourglasses flowing steadily",
  },
};

/**
 * Action elements that describe immediate price movements as physical actions.
 * These add "happening right now" moments to the narrative.
 */
export const ACTION_ELEMENTS = {
  priceUp: {
    immediate: "coins raining from the sky, catching fire as they fall",
    dramatic: "golden seeds sprouting into towers before our eyes",
    violent: "tsunami of molten gold flooding the landscape",
  },
  priceDown: {
    immediate: "statues crumbling into dust, piece by piece",
    dramatic: "earth opening beneath a palace, slowly swallowing it",
    violent: "meteor striking the central temple, explosion frozen in time",
  },
} as const;

/**
 * Character narratives - specific actions for figures in the scene.
 * These provide concrete actions rather than abstract descriptions.
 */
export const CHARACTER_NARRATIVES = {
  protagonist: {
    hero: "a lone armored figure raising a broken sword toward heaven, divine light responding",
    prophet: "robed oracle pointing at approaching doom, crowd ignoring the warning",
    merchant: "desperate trader clutching final treasures as palace burns behind",
    innocent: "child planting a seed in scorched earth, first sprout emerging",
  },
  crowd_action: {
    worship: "thousands kneeling in perfect circles, prayers visible as light rising",
    flee: "cascading exodus down mountainside, belongings abandoned mid-flight",
    celebrate: "wine-drunk crowd lifting hero on shoulders, confetti frozen mid-air",
    revolt: "mob storming golden gates, battering rams mid-swing",
    sacrifice: "priests lifting offerings toward sky beam, transformation beginning",
  },
} as const;

/**
 * Temporal elements - transformations happening in real-time.
 * FLUX excels at capturing "the moment of change."
 */
export const TEMPORAL_ELEMENTS = {
  transformation: {
    "ice melting into flowers in real-time": "recovery phase",
    "flowers withering into ash before our eyes": "decline phase",
    "statues coming to life, stone skin cracking": "awakening/pump",
    "living beings turning to gold statues": "peak/top",
    "shadows consuming light from edges inward": "fear spreading",
    "dawn breaking darkness, shadows fleeing": "hope rising",
  },
  split_scene: {
    "left half: barren wasteland / right half: blooming paradise": "dramatic reversal",
    "foreground: ruins / background: rebuilt city glowing": "recovery narrative",
    "bottom: drowning city / top: floating island ascending": "escape/salvation",
  },
} as const;

/**
 * Get narrative moment key based on token trend and market climate.
 *
 * @param isTokenPositive - Whether token price is rising (p7 >= 0)
 * @param climate - Market climate
 * @param volatility - Volatility level (high = extreme-volatility)
 * @returns Narrative moment key
 */
export function getNarrativeMomentKey(
  isTokenPositive: boolean,
  climate: string,
  volatility: number,
): keyof typeof NARRATIVE_MOMENTS {
  // High volatility overrides other conditions
  if (volatility > 0.7) {
    return "extreme-volatility";
  }

  const trendKey = isTokenPositive ? "rising" : "falling";
  const momentKey = `${trendKey}-${climate}`;

  // Return matching moment or default to stable-transition
  if (momentKey in NARRATIVE_MOMENTS) {
    return momentKey as keyof typeof NARRATIVE_MOMENTS;
  }

  return "stable-transition";
}

/**
 * Get action element based on price change magnitude and direction.
 *
 * @param priceChange7d - 7-day price change percentage
 * @returns Action element description
 */
export function getActionElement(priceChange7d: number): string {
  if (priceChange7d > 20) {
    return ACTION_ELEMENTS.priceUp.dramatic;
  } else if (priceChange7d > 5) {
    return ACTION_ELEMENTS.priceUp.immediate;
  } else if (priceChange7d < -20) {
    return ACTION_ELEMENTS.priceDown.violent;
  } else if (priceChange7d < -5) {
    return ACTION_ELEMENTS.priceDown.dramatic;
  }
  return "";
}
