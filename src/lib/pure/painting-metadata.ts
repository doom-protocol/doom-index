import type { VisualParams } from "@/lib/pure/mapping";
import type { PaintingMetadata } from "@/types/paintings";

/**
 * Type guard for PaintingMetadata
 * Validates that all required fields are present and have correct types
 */
export function isPaintingMetadata(value: unknown): value is PaintingMetadata {
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
