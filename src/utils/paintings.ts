/**
 * Simple archive utility functions
 * For complex validation and business logic, see lib/pure/archive-*.ts
 */

import { env } from "@/env";
import { IMAGE_CACHE_VERSION } from "@/constants";

/**
 * Build public API path for an R2 object key.
 * If NEXT_PUBLIC_R2_URL is set, returns absolute URL (e.g. https://storage.doomindex.fun/key)
 * Otherwise returns relative API path (e.g. /api/r2/key)
 *
 * NOTE: This returns a URL WITHOUT version query param.
 * Use `addVersionToImageUrl()` when returning URLs to clients to add cache busting version.
 *
 * Supports both formats:
 * - With protocol: "https://storage.doomindex.fun" or "http://localhost:8787/api/r2"
 * - Without protocol: "storage.doomindex.fun" (will default to https, or http for localhost)
 *
 * @param key - R2 object key (e.g. "images/2025/11/27/DOOM_...webp")
 * @returns URL without version query param (for DB storage)
 */
export function buildPublicR2Path(key: string): string {
  const normalized = key.replace(/^\/+/, "");

  if (env.NEXT_PUBLIC_R2_URL) {
    // Remove trailing slashes
    const baseUrl = env.NEXT_PUBLIC_R2_URL.replace(/\/+$/, "");

    // Check if URL already includes protocol
    if (baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
      // Already has protocol, use as-is
      return `${baseUrl}/${normalized}`;
    }

    // No protocol, determine based on domain
    const protocol = baseUrl.startsWith("localhost") ? "http" : "https";
    return `${protocol}://${baseUrl}/${normalized}`;
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

/**
 * Add or replace version query parameter to an existing image URL.
 * This is useful for URLs retrieved from database that may not have version,
 * or may have an outdated version.
 *
 * @param imageUrl - Existing image URL (may or may not have version)
 * @param version - Version string to add (defaults to IMAGE_CACHE_VERSION)
 * @returns URL with version query parameter
 */
export function addVersionToImageUrl(imageUrl: string, version: string = IMAGE_CACHE_VERSION): string {
  if (!version) {
    return imageUrl;
  }

  try {
    const url = new URL(imageUrl, "https://placeholder.com");
    url.searchParams.set("v", version);
    // If it was a relative URL, return just the pathname + search
    if (imageUrl.startsWith("/")) {
      return `${url.pathname}${url.search}`;
    }
    return url.toString();
  } catch {
    // Fallback for malformed URLs: simple string manipulation
    const baseUrl = imageUrl.split("?")[0];
    return `${baseUrl}?v=${version}`;
  }
}
