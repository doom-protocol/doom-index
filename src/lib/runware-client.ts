import { logger } from "@/utils/logger";

const API_BASE_URL = "https://api.runware.ai/v1";

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
  /**
   * Reference images array for FLUX Kontext models.
   * Used to provide reference images that will be integrated into the generated image.
   * Can be specified as:
   * - Array of UUID v4 strings of previously uploaded images
   * - Array of public URLs pointing to images
   * - Array of data URI strings (data:image/png;base64,...)
   * - Array of base64 encoded image strings
   */
  referenceImages?: string[];
  /**
   * Seed image for image-to-image transformation (legacy parameter).
   * @deprecated Use referenceImages instead for FLUX Kontext models
   */
  seedImage?: string;
  /**
   * Transformation strength for image-to-image (0.0 to 1.0).
   * Controls how much noise is added to the input image in latent space.
   * Lower values preserve more of the original image, higher values allow more creative deviation.
   * For FLUX models, values below 0.8 typically have minimal effect.
   * Default: 0.8
   */
  strength?: number;
  /**
   * @deprecated Use referenceImages instead. This parameter is kept for backward compatibility
   * and will be mapped to referenceImages internally.
   */
  referenceImageUrl?: string;
  outputFormat?: "JPEG" | "PNG" | "WEBP";
  outputType?: ("URL" | "base64Data" | "dataURI")[] | "URL" | "base64Data" | "dataURI";
  outputQuality?: number;
  includeCost?: boolean;
  checkNSFW?: boolean;
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
  async requestImages(
    params: Omit<RunwareImageInferenceRequest, "taskType" | "taskUUID">,
  ): Promise<RunwareImageInferenceResponse[]> {
    const taskUUID = crypto.randomUUID();

    // Map referenceImageUrl/seedImage to referenceImages array for FLUX Kontext models
    // Priority: referenceImages > seedImage > referenceImageUrl
    const referenceImages = params.referenceImages
      ? params.referenceImages
      : params.seedImage
        ? [params.seedImage]
        : params.referenceImageUrl
          ? [params.referenceImageUrl]
          : undefined;

    const request: RunwareImageInferenceRequest = {
      taskType: "imageInference",
      taskUUID,
      ...params,
      referenceImages,
      // Remove deprecated parameters from request
      seedImage: undefined,
      referenceImageUrl: undefined,
    };

    logger.debug("runware.requestImages.start", {
      taskUUID,
      model: params.model,
      promptSample: params.positivePrompt.substring(0, 80),
      hasReferenceImages: Boolean(referenceImages),
      referenceImagesCount: referenceImages?.length ?? 0,
      strength: params.strength,
    });

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

      // API response can be either array directly or wrapped in { data: [...] }
      let data: RunwareImageInferenceResponse[];
      if (Array.isArray(responseData)) {
        data = responseData;
      } else if (
        responseData &&
        typeof responseData === "object" &&
        "data" in responseData &&
        Array.isArray(responseData.data)
      ) {
        data = responseData.data;
      } else {
        logger.error("runware.requestImages.invalidResponse", {
          taskUUID,
          responseData,
        });
        throw new Error(`Invalid Runware API response format: ${JSON.stringify(responseData)}`);
      }

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
