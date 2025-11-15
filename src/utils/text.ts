/**
 * Text Processing Utilities
 *
 * Provides functions for text analysis and token estimation.
 */

/**
 * Estimate token count from text using character and word-based heuristics
 *
 * Uses approximate ratios:
 * - 1 token ≈ 4 characters (English)
 * - 1 token ≈ 0.75 words (English)
 *
 * @param text - Text to estimate tokens for
 * @returns Object with charBased and wordBased token estimates
 *
 * @example
 * ```ts
 * const estimate = estimateTokenCount("Hello world");
 * // => { charBased: 3, wordBased: 3 }
 * ```
 */
export function estimateTokenCount(text: string): { charBased: number; wordBased: number } {
  const charCount = text.length;
  const wordCount = text
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0).length;
  // 1 token ≈ 4 characters (English)
  // 1 token ≈ 0.75 words (English)
  return {
    charBased: Math.ceil(charCount / 4),
    wordBased: Math.ceil(wordCount / 0.75),
  };
}
