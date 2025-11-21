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
