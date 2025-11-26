/**
 * Text Processing Utilities
 *
 * Provides functions for text analysis, token estimation, and text extraction.
 */

import type { ParsingError } from "@/types/app-error";
import { type Result, err, ok } from "neverthrow";

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

/**
 * Parse JSON from text, handling markdown code blocks and extra text
 * Robustly extracts JSON even when surrounded by other text or markdown formatting
 *
 * @param text - Text containing JSON
 * @returns Result containing parsed JSON or ParsingError
 */
export function parseJsonFromText<T>(text: string): Result<T, ParsingError> {
  // Try direct JSON parse first
  try {
    return ok(JSON.parse(text) as T);
  } catch {
    // Try extracting JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return ok(JSON.parse(jsonMatch[1].trim()) as T);
      } catch {
        // Fall through to try other methods
      }
    }

    // Try to find JSON object/array in the text (look for { or [)
    const jsonStart = text.indexOf("{");
    const arrayStart = text.indexOf("[");
    let startIndex = -1;
    if (jsonStart !== -1 && (arrayStart === -1 || jsonStart < arrayStart)) {
      startIndex = jsonStart;
    } else if (arrayStart !== -1) {
      startIndex = arrayStart;
    }

    if (startIndex !== -1) {
      // Try to find the matching closing brace/bracket
      let depth = 0;
      let inString = false;
      let escapeNext = false;
      let endIndex = startIndex;

      for (let i = startIndex; i < text.length; i++) {
        const char = text[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === "\\") {
          escapeNext = true;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          continue;
        }

        if (inString) {
          continue;
        }

        if (char === "{" || char === "[") {
          depth++;
        } else if (char === "}" || char === "]") {
          depth--;
          if (depth === 0) {
            endIndex = i + 1;
            break;
          }
        }
      }

      if (depth === 0 && endIndex > startIndex) {
        const jsonCandidate = text.substring(startIndex, endIndex);
        try {
          return ok(JSON.parse(jsonCandidate) as T);
        } catch {
          // Fall through to error
        }
      }
    }

    return err({
      type: "ParsingError",
      message: "Failed to parse JSON from response",
      rawValue: text.substring(0, 200), // First 200 chars for debugging
    });
  }
}
