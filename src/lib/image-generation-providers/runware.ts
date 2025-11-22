import { ok, err } from "neverthrow";
import type { ImageGenerationOptions, ImageProvider, ImageRequest } from "@/types/domain";
import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";
import { base64ToArrayBuffer } from "@/utils/image";
import { getErrorMessage } from "@/utils/error";
import { env } from "@/env";
import { RunwareClient, FLUX_KONTEXT_DEV_MODEL } from "@/lib/runware-client";
import { DEFAULT_RUNWARE_MODEL, DEFAULT_IMAGE_SIZE, DEFAULT_RUNWARE_TIMEOUT } from "@/constants/runware";

/**
 * Runware Provider for Image Generation
 * Uses fetch-based client compatible with Cloudflare Workers
 */
export const createRunwareProvider = (): ImageProvider => ({
  name: "runware",

  async generate(input: ImageRequest, options?: ImageGenerationOptions) {
    const apiKey = env.RUNWARE_API_KEY;
    if (!apiKey) {
      logger.error("runware.generate.missingApiKey");
      return err({
        type: "ConfigurationError",
        message: "RUNWARE_API_KEY is required to generate images",
        missingVar: "RUNWARE_API_KEY",
      } as AppError);
    }

    try {
      const timeoutMs = options?.timeoutMs ?? DEFAULT_RUNWARE_TIMEOUT;
      const runware = new RunwareClient({
        apiKey,
        timeoutMs,
      });

      const seedInt = input.seed ? parseInt(input.seed.substring(0, 8), 16) : undefined;

      // For image-to-image, always use FLUX.1 Kontext [dev] model
      // Otherwise, use the provided model or default
      const isImageToImage = Boolean(input.referenceImageUrl);
      const model = isImageToImage ? FLUX_KONTEXT_DEV_MODEL : input.model || DEFAULT_RUNWARE_MODEL;

      const width = DEFAULT_IMAGE_SIZE;
      const height = DEFAULT_IMAGE_SIZE;

      logger.debug("runware.generate.start", {
        model,
        timeoutMs,
        promptSample: input.prompt.substring(0, 80),
        hasReferenceImage: Boolean(input.referenceImageUrl),
        isImageToImage,
      });

      // For FLUX Kontext models with reference images, use optimized parameters
      const images = await runware.requestImages({
        positivePrompt: input.prompt,
        negativePrompt: input.negative,
        height,
        width,
        model,
        numberResults: 1,
        outputFormat: input.format === "png" ? "PNG" : "WEBP",
        outputType: ["base64Data"],
        steps: isImageToImage ? 18 : undefined,
        CFGScale: isImageToImage ? 2.5 : undefined,
        scheduler: isImageToImage ? "Default" : undefined,
        includeCost: true,
        checkNSFW: true,
        ...(seedInt !== undefined && { seed: seedInt }),
        ...(input.referenceImageUrl && {
          referenceImages: [input.referenceImageUrl],
        }),
      });

      const image = images?.[0];

      if (!image) {
        logger.error("runware.generate.noImage", {
          imagesCount: images?.length ?? 0,
          images,
        });
        return err({
          type: "ExternalApiError",
          provider: "ImageProvider",
          message: `Runware request returned no image data. Response count: ${images?.length ?? 0}`,
        } as AppError);
      }

      if (!image.imageBase64Data) {
        logger.error("runware.generate.noImageData", {
          image,
          hasImageURL: !!image.imageURL,
          hasImageDataURI: !!image.imageDataURI,
        });
        return err({
          type: "ExternalApiError",
          provider: "ImageProvider",
          message: `Runware request returned image but no base64Data. Has URL: ${!!image.imageURL}, Has DataURI: ${!!image.imageDataURI}`,
        } as AppError);
      }

      logger.info("runware.generate.success", {
        taskUUID: image.taskUUID,
        model,
        size: image.imageBase64Data.length,
      });

      const imageBuffer = base64ToArrayBuffer(image.imageBase64Data);

      return ok({
        imageBuffer,
        providerMeta: {
          provider: "runware",
          taskUUID: image.taskUUID,
          model,
          seed: seedInt,
        },
      });
    } catch (error) {
      logger.error("runware.generate.error", { error });
      return err({
        type: "ExternalApiError",
        provider: "ImageProvider",
        message: getErrorMessage(error),
      } as AppError);
    }
  },
});
