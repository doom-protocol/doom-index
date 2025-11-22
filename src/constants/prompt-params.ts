export type PromptTuning = {
  imageSize: { w: number; h: number };
  secondaryElement: {
    threshold: number;
    weightScale: number;
    weightMax: number;
    maxElements: number;
    climateShadowFallback: number;
    climateLightFallback: number;
  };
  primaryElement: {
    minWeight: number;
    maxWeight: number;
    volatilityScale: number;
    offset: number;
  };
};

/**
 * Master prompt tuning parameters.
 * Edit values here to quickly adjust generation behavior without touching logic code.
 */
export const PROMPT_TUNING: PromptTuning = {
  imageSize: { w: 1024, h: 1024 },
  secondaryElement: {
    threshold: 0.3, // include a symbolic element if vp value exceeds this
    weightScale: 1.5, // scale vp value to weight
    weightMax: 1.5, // cap weight
    maxElements: 6, // pick top N secondary elements
    climateShadowFallback: 0.5, // fallback value when climate boosts shadows
    climateLightFallback: 0.5, // fallback value when climate boosts light
  },
  primaryElement: {
    minWeight: 0.75,
    maxWeight: 1.5,
    volatilityScale: 1.5,
    offset: 0.5,
  },
};
