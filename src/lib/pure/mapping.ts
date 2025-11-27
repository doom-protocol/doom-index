export type VisualParams = {
  fogDensity: number;
  skyTint: number;
  reflectivity: number;
  blueBalance: number;
  vegetationDensity: number;
  organicPattern: number;
  radiationGlow: number;
  debrisIntensity: number;
  mechanicalPattern: number;
  metallicRatio: number;
  fractalDensity: number;
  bioluminescence: number;
  shadowDepth: number;
  redHighlight: number;
  lightIntensity: number;
  warmHue: number;
  tokenWeights?: Record<string, number>;
  worldPrompt?: string;
};

/**
 * Legacy function: mapToVisualParams
 * @deprecated This function is part of the legacy 8-token system and should not be used.
 * It returns default visual parameters for backward compatibility.
 */
export function mapToVisualParams(_normalized: Record<string, number>): VisualParams {
  // Legacy system is deprecated - return default visual parameters
  return {
    fogDensity: 0,
    skyTint: 0,
    reflectivity: 0,
    blueBalance: 0,
    vegetationDensity: 0,
    organicPattern: 0,
    radiationGlow: 0,
    debrisIntensity: 0,
    mechanicalPattern: 0,
    metallicRatio: 0,
    fractalDensity: 0,
    bioluminescence: 0,
    shadowDepth: 0,
    redHighlight: 0,
    lightIntensity: 0,
    warmHue: 0,
  };
}
