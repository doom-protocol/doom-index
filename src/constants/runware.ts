/**
 * Runware Configuration Constants
 *
 * Centralized configuration for Runware image generation models.
 * Supports both Runware AIR format (runware:aid@version) and Civitai format (civitai:modelId@versionId).
 *
 * @see https://docs.runware.ai/en/image-inference/models/air-models
 */

/**
 * Runware AIR Model Configuration
 * Format: runware:aid@version
 */
export type RunwareAirModel = {
  /** Model identifier in Runware AIR format */
  model: `runware:${number}@${number}`;
  /** Human-readable model name */
  name: string;
  /** Model description */
  description?: string;
};

/**
 * Civitai Model Configuration
 * Format: civitai:modelId@versionId
 */
export type CivitaiModel = {
  /** Model identifier in Civitai format */
  model: `civitai:${number}@${number}`;
  /** Human-readable model name */
  name: string;
  /** Model description */
  description?: string;
};

export type RunwareModel = RunwareAirModel | CivitaiModel;

/**
 * Predefined Runware AIR Models
 * Add your frequently used models here for easy reference
 */
export const RUNWARE_AIR_MODELS = {
  /** Default model: FLUX.1 Kontext [dev] - High-quality image generation with extended context */
  DEFAULT: {
    model: "runware:106@1",
    name: "FLUX.1 Kontext [dev]",
    description: "FLUX.1 Kontext development model with extended context understanding",
  },
  /** FLUX.1 [schnell] - Fast image generation model */
  FLUX_SCHNELL: {
    model: "runware:100@1",
    name: "FLUX.1 [schnell]",
    description: "FLUX.1 Schnell model for fast image generation",
  },
} as const satisfies Record<string, RunwareAirModel>;

/**
 * Predefined Civitai Models
 * Add your frequently used Civitai models here for easy reference
 */
export const CIVITAI_MODELS = {
  /** Example Civitai model */
  EXAMPLE: {
    model: "civitai:38784@44716",
    name: "Civitai Example",
    description: "Example Civitai model",
  },
} as const satisfies Record<string, CivitaiModel>;

/**
 * Default model to use when no model is specified
 * Currently set to FLUX.1 Kontext [dev] (runware:106@1)
 */
export const DEFAULT_RUNWARE_MODEL = RUNWARE_AIR_MODELS.DEFAULT.model;

/**
 * Default image size for Runware generation
 */
export const DEFAULT_IMAGE_SIZE = 1024;

/**
 * Default timeout for Runware API requests (in milliseconds)
 */
export const DEFAULT_RUNWARE_TIMEOUT = 30_000;

/**
 * Type guard to check if a model string is a valid Runware AIR format
 */
export const isRunwareAirModel = (model: string): model is `runware:${number}@${number}` => {
  return model.startsWith("runware:");
};

/**
 * Type guard to check if a model string is a valid Civitai format
 */
export const isCivitaiModel = (model: string): model is `civitai:${number}@${number}` => {
  return /^civitai:\d+@\d+$/.test(model);
};

/**
 * Type guard to check if a model string is a valid Runware model
 */
export const isRunwareModel = (model: string): boolean => {
  return isRunwareAirModel(model) || isCivitaiModel(model);
};
