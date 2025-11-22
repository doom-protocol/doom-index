/**
 * Simple archive utility functions
 * For complex validation and business logic, see lib/pure/archive-*.ts
 */

import { env } from "@/env";

/**
 * Build public API path for an R2 object key.
 * If NEXT_PUBLIC_R2_DOMAIN is set, returns absolute URL (e.g. https://assets.domain.com/key)
 * Otherwise returns relative API path (e.g. /api/r2/key)
 *
 * Supports both formats:
 * - With protocol: "https://storage.doomindex.fun"
 * - Without protocol: "storage.doomindex.fun" (will default to https, or http for localhost)
 */
export function buildPublicR2Path(key: string): string {
  const normalized = key.replace(/^\/+/, "");

  if (env.NEXT_PUBLIC_R2_DOMAIN) {
    // Remove trailing slashes
    let domain = env.NEXT_PUBLIC_R2_DOMAIN.replace(/\/+$/, "");

    // Check if URL already includes protocol
    if (domain.startsWith("http://") || domain.startsWith("https://")) {
      // Already has protocol, use as-is
      return `${domain}/${normalized}`;
    }

    // No protocol, determine based on domain
    const protocol = domain.startsWith("localhost") ? "http" : "https";
    return `${protocol}://${domain}/${normalized}`;
  }

  return `/api/r2/${normalized}`;
}

/**
 * Build archive key with date prefix
 * @param dateString - Date string in YYYY-MM-DD format or ISO timestamp
 * @param filename - Filename (e.g., "DOOM_202511141234_abc12345_def45678.webp")
 * @returns Full R2 key path
 */
export function buildPaintingKey(dateString: string, filename: string): string {
  // Extract YYYY-MM-DD from ISO timestamp if needed
  const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) {
    throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD or ISO timestamp.`);
  }

  const [, year, month, day] = dateMatch;
  const prefix = `images/${year}/${month}/${day}/`;
  return `${prefix}${filename}`;
}

/**
 * Validate filename pattern matches DOOM_{YYYYMMDDHHmm}_{paramsHash}_{seed}.webp
 * @param filename - Filename to validate
 * @returns true if filename matches the pattern
 */
export function isValidPaintingFilename(filename: string): boolean {
  const pattern = /^DOOM_\d{12}_[a-z0-9]{8}_[a-z0-9]{12}\.webp$/;
  return pattern.test(filename);
}

/**
 * Extract ID from filename (filename without extension)
 * @param filename - Filename (e.g., "DOOM_202511141234_abc12345_def45678.webp")
 * @returns ID (e.g., "DOOM_202511141234_abc12345_def45678")
 */
export function extractIdFromFilename(filename: string): string {
  return filename.replace(/\.webp$/, "");
}
