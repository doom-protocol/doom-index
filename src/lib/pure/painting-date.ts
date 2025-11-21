import type { DatePrefix } from "@/types/paintings";

/**
 * Parse date string (YYYY-MM-DD or ISO timestamp) to date prefix structure
 * @param dateString - Date string in YYYY-MM-DD format or ISO timestamp
 * @returns Date prefix structure
 * @throws Error if date format is invalid
 */
export function parseDatePrefix(dateString: string): DatePrefix {
  // Extract YYYY-MM-DD from ISO timestamp if needed
  const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) {
    throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD or ISO timestamp.`);
  }

  const [, year, month, day] = dateMatch;
  return {
    year,
    month,
    day,
    prefix: `images/${year}/${month}/${day}/`,
  };
}

/**
 * Extract date prefix from minute bucket
 * @param minuteBucket - Minute bucket string (e.g., "2025-11-14T12:34")
 * @returns Date prefix structure
 */
export function extractDatePrefixFromMinuteBucket(minuteBucket: string): DatePrefix {
  return parseDatePrefix(minuteBucket);
}
