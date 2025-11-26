/**
 * Runware Configuration Constants
 *
 * Centralized configuration for Runware image generation models.
 * Supports Runware AIR format (runware:aid@version).
 *
 * @see https://docs.runware.ai/en/image-inference/models/air-models
 */

/**
 * Runware AIR Model Configuration
 * Format: runware:aid@version
 */
type RunwareAirModel = {
  /** Model identifier in Runware AIR format */
  model: `runware:${number}@${number}`;
  /** Human-readable model name */
  name: string;
  /** Model description */
  description?: string;
};

/**
 * Predefined Runware AIR Models
 * Add your frequently used models here for easy reference
 */
export const RUNWARE_AIR_MODELS = {
  /** Default model: FLUX.2 [dev] - Latest development version of FLUX.2 */
  DEFAULT: {
    model: "runware:400@1",
    name: "FLUX.2 [dev]",
    description: "FLUX.2 development model with latest improvements and capabilities",
  },
  /** FLUX.1 [schnell] - Fast image generation model */
  FLUX_SCHNELL: {
    model: "runware:100@1",
    name: "FLUX.1 [schnell]",
    description: "FLUX.1 Schnell model for fast image generation",
  },
  /** FLUX.1 Kontext [dev] - Previous default model with extended context */
  FLUX_KONTEXT_DEV: {
    model: "runware:106@1",
    name: "FLUX.1 Kontext [dev]",
    description: "FLUX.1 Kontext development model with extended context understanding",
  },
} as const satisfies Record<string, RunwareAirModel>;

/**
 * Default model to use when no model is specified
 * Currently set to FLUX.2 [dev] (runware:400@1)
 */
export const DEFAULT_RUNWARE_MODEL = RUNWARE_AIR_MODELS.DEFAULT.model;

/**
 * Default image size for Runware generation
 */
export const DEFAULT_IMAGE_SIZE = 1024;

/**
 * Default timeout for Runware API requests (in milliseconds)
 */
export const DEFAULT_RUNWARE_TIMEOUT = 90_000;
