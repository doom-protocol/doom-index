import { logger } from "@/utils/logger";

const API_BASE_URL = "https://api.runware.ai/v1";

/**
 * Default model for FLUX kontext [dev] on Runware
 * Used for dynamic-draw flow (1h auto-generation with reference image).
 */
export const FLUX_KONTEXT_DEV_MODEL = "runware:106@1";

export type RunwareImageInferenceRequest = {
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
   * Optional reference image URL (e.g. token logo) for image-to-image / guided generation.
   * This is passed through to Runware's FLUX kontext models when provided.
   */
  referenceImageUrl?: string;
  outputFormat?: "JPEG" | "PNG" | "WEBP";
  outputType?: ("URL" | "base64Data" | "dataURI")[] | "URL" | "base64Data" | "dataURI";
  outputQuality?: number;
  includeCost?: boolean;
  checkNSFW?: boolean;
};

export type RunwareImageInferenceResponse = {
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

export type RunwareClientOptions = {
  apiKey: string;
  timeoutMs?: number;
};

/**
 * Runware API Client using fetch (compatible with Cloudflare Workers)
 * Text-to-image generation only
 */
export class RunwareClient {
  private apiKey: string;
  private timeoutMs: number;

  constructor(options: RunwareClientOptions) {
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  /**
   * Generate images from text prompt
   */
  async requestImages(
    params: Omit<RunwareImageInferenceRequest, "taskType" | "taskUUID">,
  ): Promise<RunwareImageInferenceResponse[]> {
    const taskUUID = crypto.randomUUID();
    const request: RunwareImageInferenceRequest = {
      taskType: "imageInference",
      taskUUID,
      ...params,
    };

    logger.debug("runware.requestImages.start", {
      taskUUID,
      model: params.model,
      promptSample: params.positivePrompt.substring(0, 80),
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
