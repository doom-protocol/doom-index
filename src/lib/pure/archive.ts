import type { ArchiveMetadata, DatePrefix } from "@/types/archive";
import { TOKEN_TICKERS } from "@/constants/token";
import type { VisualParams } from "@/lib/pure/mapping";

/**
 * Build public API path for an R2 object key.
 * Do not encode segments to avoid double-encoding with Next route params.
 */
export function buildPublicR2Path(key: string): string {
  const normalized = key.replace(/^\/+/, "");
  return `/api/r2/${normalized}`;
}

/**
 * Type guard for ArchiveMetadata
 * Validates that all required fields are present and have correct types
 */
export function isArchiveMetadata(value: unknown): value is ArchiveMetadata {
  if (!value || typeof value !== "object") {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Check required string fields
  const requiredStringFields = [
    "id",
    "timestamp",
    "minuteBucket",
    "paramsHash",
    "seed",
    "imageUrl",
    "prompt",
    "negative",
  ];
  for (const field of requiredStringFields) {
    if (typeof obj[field] !== "string") {
      return false;
    }
  }

  // Check fileSize is a number
  if (typeof obj.fileSize !== "number" || !Number.isFinite(obj.fileSize)) {
    return false;
  }

  // Check mcRounded structure
  if (!obj.mcRounded || typeof obj.mcRounded !== "object") {
    return false;
  }
  const mcRounded = obj.mcRounded as Record<string, unknown>;
  for (const ticker of TOKEN_TICKERS) {
    if (typeof mcRounded[ticker] !== "number" || !Number.isFinite(mcRounded[ticker])) {
      return false;
    }
  }

  // Check visualParams structure
  if (!obj.visualParams || typeof obj.visualParams !== "object") {
    return false;
  }
  const visualParams = obj.visualParams as Record<string, unknown>;
  const requiredVisualParams: (keyof VisualParams)[] = [
    "fogDensity",
    "skyTint",
    "reflectivity",
    "blueBalance",
    "vegetationDensity",
    "organicPattern",
    "radiationGlow",
    "debrisIntensity",
    "mechanicalPattern",
    "metallicRatio",
    "fractalDensity",
    "bioluminescence",
    "shadowDepth",
    "redHighlight",
    "lightIntensity",
    "warmHue",
  ];
  for (const param of requiredVisualParams) {
    if (typeof visualParams[param] !== "number" || !Number.isFinite(visualParams[param])) {
      return false;
    }
  }

  return true;
}

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
 * Build archive key with date prefix
 * @param dateString - Date string in YYYY-MM-DD format or ISO timestamp
 * @param filename - Filename (e.g., "DOOM_202511141234_abc12345_def45678.webp")
 * @returns Full R2 key path
 */
export function buildArchiveKey(dateString: string, filename: string): string {
  const prefix = parseDatePrefix(dateString);
  return `${prefix.prefix}${filename}`;
}

/**
 * Extract date prefix from minute bucket
 * @param minuteBucket - Minute bucket string (e.g., "2025-11-14T12:34")
 * @returns Date prefix structure
 */
export function extractDatePrefixFromMinuteBucket(minuteBucket: string): DatePrefix {
  return parseDatePrefix(minuteBucket);
}

/**
 * Validate filename pattern matches DOOM_{YYYYMMDDHHmm}_{paramsHash}_{seed}.webp
 * @param filename - Filename to validate
 * @returns true if filename matches the pattern
 */
export function isValidArchiveFilename(filename: string): boolean {
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
