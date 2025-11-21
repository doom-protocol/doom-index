/**
 * Number of decimal places to quantize visual parameters
 * Used for hashing visual parameters to create a stable seed
 */
export const QUANTIZE_DECIMALS = 3;

/**
 * Visual parameter keys for image generation
 */
export type VisualParamKey =
  | "fogDensity"
  | "skyTint"
  | "reflectivity"
  | "blueBalance"
  | "vegetationDensity"
  | "organicPattern"
  | "radiationGlow"
  | "debrisIntensity"
  | "mechanicalPattern"
  | "metallicRatio"
  | "fractalDensity"
  | "bioluminescence"
  | "shadowDepth"
  | "redHighlight"
  | "lightIntensity"
  | "warmHue";

/**
 * Legacy type aliases for backward compatibility
 * These are deprecated and should be replaced with Record<string, number>
 */
export type McMapRounded = Record<string, number>;
export type NormalizedMcMap = Record<string, number>;
export type McMap = Record<string, number>;
