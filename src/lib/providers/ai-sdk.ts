import { ok, err } from "neverthrow";
import { experimental_generateImage as generateImage } from "ai";
import { openai } from "@ai-sdk/openai";
import type { ImageModel } from "ai";
import type { ImageProvider, ImageRequest } from "@/types/domain";
import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";

type OpenAiProviderMetadata = {
  images?: Array<{
    revisedPrompt?: string;
  }>;
};

type ImageSize = `${number}x${number}`;

/**
 * Resolves the AI SDK model from the model name
 * Currently supports OpenAI models directly
 * For other providers, returns the default OpenAI model
 */
const resolveAiSdkModel = (modelName?: string): ImageModel => {
  const model = modelName || "dall-e-3";

  // OpenAI models
  if (model.startsWith("dall-e-") || model === "gpt-image-1") {
    return openai.image(model);
  }

  // For other providers (Fal, DeepInfra, Replicate, Google, xAI, etc.)
  // Default to dall-e-3 for now
  // To support other providers, install the respective SDK packages:
  // - @ai-sdk/google for Google models
  // - @ai-sdk/xai for xAI models
  // - @fal-ai/serverless-client for Fal models
  // - replicate for Replicate models
  logger.warn("ai-sdk.unsupported.model", {
    requested: model,
    fallback: "dall-e-3",
    message: "Model not directly supported, falling back to dall-e-3",
  });

  return openai.image("dall-e-3");
};

/**
 * AI SDK Provider for Image Generation
 * Supports multiple models through AI SDK's unified interface
 * @see https://ai-sdk.dev/docs/ai-sdk-core/image-generation
 */
export const createAiSdkProvider = (): ImageProvider => ({
  name: "ai-sdk",

  async generate(input: ImageRequest) {
    try {
      const model = input.model || "dall-e-3";

      logger.debug("ai-sdk.generate.start", {
        model,
        prompt: input.prompt.substring(0, 100),
        size: `${input.width}x${input.height}`,
        seed: input.seed,
      });

      const requestedSize = `${input.width}x${input.height}` as ImageSize;
      const resolvedModel = resolveAiSdkModel(model);

      const result = await generateImage({
        model: resolvedModel,
        prompt: input.prompt,
        size: requestedSize,
      });

      logger.info("ai-sdk.generate.success", {
        model,
        size: result.image.uint8Array.byteLength,
        warnings: result.warnings,
      });

      // Convert Uint8Array to ArrayBuffer
      const uint8Array = result.image.uint8Array;
      const buffer = uint8Array.buffer;
      const imageBuffer: ArrayBuffer = buffer instanceof ArrayBuffer
        ? buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength)
        : new ArrayBuffer(uint8Array.byteLength).slice(0);

      return ok({
        imageBuffer,
        providerMeta: {
          provider: "ai-sdk",
          model,
          revisedPrompt: (result.providerMetadata?.openai as OpenAiProviderMetadata)?.images?.[0]?.revisedPrompt,
          warnings: result.warnings,
        },
      });
    } catch (error) {
      logger.error("ai-sdk.generate.error", { error });
      return err({
        type: "ExternalApiError",
        provider: "ImageProvider",
        message: error instanceof Error ? error.message : String(error),
      } as AppError);
    }
  },
});
