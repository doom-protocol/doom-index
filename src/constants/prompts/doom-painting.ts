import type { TokenTicker } from "@/constants/token";

/**
 * Prompt constants for Doom Index baroque painting style
 * Centralized management of "prepared statement" style strings shared across the entire image generation pipeline.
 */

/**
 * Theme line placed at the beginning of prompts
 */
export const DOOM_PAINTING_OPENING_LINE =
  "a grand baroque allegorical oil painting of the world, all forces visible and weighted by real-time power,";

/**
 * Base description for painting style
 */
export const DOOM_PAINTING_STYLE_BASE =
  "baroque allegorical oil painting, Caravaggio and Rubens influence, dramatic tenebrism with intense chiaroscuro, dynamic composition with diagonal movement, rich vibrant colors, emotional expression, thick impasto oil texture, theatrical lighting, detailed human figures, cohesive single landscape";

/**
 * Negative prompt always applied during image generation
 */
export const DOOM_PAINTING_NEGATIVE_PROMPT =
  "watermark, text, logo, oversaturated colors, low detail hands, extra limbs";

/**
 * Fixed fragment text expressing human elements
 */
export const DOOM_PAINTING_HUMAN_ELEMENT_TEXT = "figures praying, trading, recording the scene";

/**
 * Allegorical motif descriptions for each token
 * Referenced from weighted-prompt.
 */
export const DOOM_PAINTING_TOKEN_PHRASES: Record<TokenTicker, string> = {
  CO2: "dense toxic smog in the sky",
  ICE: "melting glaciers submerging cities as rising oceans engulf skyscrapers and drown civilizations",
  FOREST:
    "endless expanses of vibrant green canopies, intertwined roots reclaiming abandoned structures, and wildlife thriving in the untouched wilderness",
  NUKE: "ashen wastelands under nuclear fallout, with radioactive winds sweeping through ruins and a towering mushroom cloud dominating the sky",
  MACHINE:
    "cold robotic automatons marching in formation, towering AI surveillance systems with glowing electronic eyes, automated factories with mechanical arms and assembly lines, cybernetic beings fused with technology, dystopian machinery controlling and monitoring everything",
  PANDEMIC:
    "masked figures wandering through unsanitary streets filled with viral clouds, bio-contaminants, and microscopic pathogens dominating the air",
  FEAR: "oppressive darkness with many red eyes",
  HOPE: "radiant golden divine light breaking the clouds",
};
