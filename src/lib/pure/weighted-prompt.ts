/**
 * Doom Index Prompt Generation
 * World-scale baroque allegorical painting with weighted elements based on market cap
 *
 * @deprecated This module is part of the legacy 8-token system and should not be used.
 * Use composeTokenPrompt from world-prompt-service instead.
 */

import { WORLD_PAINTING_NEGATIVE_PROMPT } from "@/constants/prompts/world-painting";
import type { McMap } from "@/constants/token";

/**
 * Legacy function: buildSDXLPrompt
 * @deprecated This function is part of the legacy 8-token system and should not be used.
 * Returns a default prompt for backward compatibility.
 */
export function buildSDXLPrompt(_mc: McMap): { prompt: string; negative: string } {
  // Legacy system is deprecated - return default prompt
  const prompt = "a grand baroque allegorical oil painting of the world";
  return {
    prompt,
    negative: WORLD_PAINTING_NEGATIVE_PROMPT,
  };
}
