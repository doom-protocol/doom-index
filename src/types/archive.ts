import type { McMapRounded } from "@/constants/token";
import type { VisualParams } from "@/lib/pure/mapping";

/**
 * Archive metadata structure stored as JSON alongside images
 */
export type ArchiveMetadata = {
  id: string; // File name base (without extension)
  timestamp: string; // ISO 8601 format
  minuteBucket: string; // Minute bucket (e.g., "2025-11-14T12:34:00Z")
  paramsHash: string; // Visual parameters hash (8 characters, lowercase)
  seed: string; // Seed value (12 characters, lowercase)
  mcRounded: McMapRounded; // Market cap values for each token (rounded)
  visualParams: VisualParams; // Visual parameters
  imageUrl: string; // Public URL
  fileSize: number; // Size in bytes
  prompt: string; // Prompt text
  negative: string; // Negative prompt
};

/**
 * Archive item returned by API (includes imageUrl for display)
 */
export type ArchiveItem = ArchiveMetadata;

/**
 * Date prefix structure for R2 storage
 */
export type DatePrefix = {
  year: string; // YYYY
  month: string; // MM
  day: string; // DD
  prefix: string; // images/YYYY/MM/DD/
};
