import { logger } from "@/utils/logger";

const API_BASE_URL = "https://api.runware.ai/v1";

/**
 * Parameters for image inference request
 */
export type RunwareImageInferenceParams = {
  model: string;
  positivePrompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  steps?: number;
  CFGScale?: number;
  scheduler?: string;
  seed?: number;
  numberResults?: number;
  /**
   * Reference images array.
   * Used to provide reference images that will be integrated into the generated image.
   * Can be specified as:
   * - Array of UUID v4 strings of previously uploaded images
   * - Array of public URLs pointing to images
   * - Array of data URI strings (data:image/png;base64,...)
   * - Array of base64 encoded image strings
   */
  referenceImages?: string[];
  /**
   * Transformation strength for image-to-image (0.0 to 1.0).
   * Controls how much noise is added to the input image in latent space.
   * Lower values preserve more of the original image, higher values allow more creative deviation.
   * For FLUX models, values below 0.8 typically have minimal effect.
   * Default: 0.8
   */
  strength?: number;
  outputFormat?: "JPEG" | "PNG" | "WEBP";
  outputType?: ("URL" | "base64Data" | "dataURI")[] | "URL" | "base64Data" | "dataURI";
  outputQuality?: number;
  includeCost?: boolean;
  checkNSFW?: boolean;
};

/**
 * Actual API request format sent to Runware
 * Reference images must be nested inside the inputs object
 */
type RunwareImageInferenceRequest = {
  taskType: "imageInference";
  taskUUID: string;
  model: string;
  positivePrompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  steps?: number;
  CFGScale?: number;
  scheduler?: string;
  seed?: number;
  numberResults?: number;
  strength?: number;
  outputFormat?: "JPEG" | "PNG" | "WEBP";
  outputType?: ("URL" | "base64Data" | "dataURI")[] | "URL" | "base64Data" | "dataURI";
  outputQuality?: number;
  includeCost?: boolean;
  checkNSFW?: boolean;
  /**
   * Inputs object containing reference images.
   * Reference images must be nested inside the inputs object, not at the top level.
   * Only included when reference images are provided.
   */
  inputs?: {
    referenceImages: string[];
  };
};

type RunwareImageInferenceResponse = {
  taskType: "imageInference";
  taskUUID: string;
  imageUUID: string;
  imageURL?: string;
  imageBase64Data?: string;
  imageDataURI?: string;
  seed?: number;
  NSFWContent?: boolean;
  cost?: number;
};

type RunwareClientOptions = {
  apiKey: string;
  timeoutMs?: number;
};

/**
 * Builds the API request from parameters.
 * Only includes fields that are defined (excludes undefined values).
 */
function buildApiRequest(params: RunwareImageInferenceParams, taskUUID: string): RunwareImageInferenceRequest {
  return {
    taskType: "imageInference",
    taskUUID,
    model: params.model,
    positivePrompt: params.positivePrompt,
    width: params.width,
    height: params.height,
    ...(params.negativePrompt !== undefined && { negativePrompt: params.negativePrompt }),
    ...(params.steps !== undefined && { steps: params.steps }),
    ...(params.CFGScale !== undefined && { CFGScale: params.CFGScale }),
    ...(params.scheduler !== undefined && { scheduler: params.scheduler }),
    ...(params.seed !== undefined && { seed: params.seed }),
    ...(params.numberResults !== undefined && { numberResults: params.numberResults }),
    ...(params.strength !== undefined && { strength: params.strength }),
    ...(params.outputFormat !== undefined && { outputFormat: params.outputFormat }),
    ...(params.outputType !== undefined && { outputType: params.outputType }),
    ...(params.outputQuality !== undefined && { outputQuality: params.outputQuality }),
    ...(params.includeCost !== undefined && { includeCost: params.includeCost }),
    ...(params.checkNSFW !== undefined && { checkNSFW: params.checkNSFW }),
    // Reference images must be nested inside inputs object
    ...(params.referenceImages && {
      inputs: {
        referenceImages: params.referenceImages,
      },
    }),
  };
}

/**
 * Parses the API response, handling both array and wrapped formats.
 */
function parseApiResponse(responseData: unknown, taskUUID: string): RunwareImageInferenceResponse[] {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  if (responseData && typeof responseData === "object" && "data" in responseData && Array.isArray(responseData.data)) {
    return responseData.data;
  }

  logger.error("runware.requestImages.invalidResponse", {
    taskUUID,
    responseData,
  });
  throw new Error(`Invalid Runware API response format: ${JSON.stringify(responseData)}`);
}

/**
 * Runware API Client using fetch (compatible with Cloudflare Workers)
 * Supports both text-to-image and image-to-image generation
 */
export class RunwareClient {
  private apiKey: string;
  private timeoutMs: number;

  constructor(options: RunwareClientOptions) {
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  /**
   * Generate images from text prompt or transform images using image-to-image
   */
  async requestImages(params: RunwareImageInferenceParams): Promise<RunwareImageInferenceResponse[]> {
    const taskUUID = crypto.randomUUID();

    logger.debug("runware.requestImages.start", {
      taskUUID,
      model: params.model,
      promptSample: params.positivePrompt.substring(0, 80),
      hasReferenceImages: Boolean(params.referenceImages),
      referenceImagesCount: params.referenceImages?.length ?? 0,
      strength: params.strength,
    });

    const request = buildApiRequest(params, taskUUID);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(API_BASE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([request]),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        logger.error("runware.requestImages.error", {
          taskUUID,
          status: response.status,
          statusText: response.statusText,
          errorText,
        });
        throw new Error(`Runware API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const responseData = await response.json();
      const data = parseApiResponse(responseData, taskUUID);

      logger.debug("runware.requestImages.complete", {
        taskUUID,
        count: data.length,
      });

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Runware API timeout after ${this.timeoutMs}ms`);
      }
      throw error;
    }
  }
}
