import { ok, err } from "neverthrow";
import { experimental_generateImage as generateImage } from "ai";
import { openai } from "@ai-sdk/openai";
import type { ImageModel } from "ai";
import type { ImageGenerationOptions, ImageProvider, ImageRequest } from "@/types/domain";
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

  async generate(input: ImageRequest, options?: ImageGenerationOptions) {
    const timeoutMs = options?.timeoutMs ?? 15_000;
    try {
      const model = input.model || "dall-e-3";

      // Always use 1024x1024 for consistent image generation
      const width = 1024;
      const height = 1024;

      logger.debug("ai-sdk.generate.start", {
        model,
        prompt: input.prompt.substring(0, 100),
        requestedSize: `${input.width}x${input.height}`,
        actualSize: `${width}x${height}`,
        seed: input.seed,
      });

      const requestedSize = `${width}x${height}` as ImageSize;
      const resolvedModel = resolveAiSdkModel(model);

      // Estimate token count from prompt
      const estimateTokenCount = (text: string): { charBased: number; wordBased: number } => {
        const charCount = text.length;
        const wordCount = text
          .trim()
          .split(/\s+/)
          .filter(w => w.length > 0).length;
        // 1 token ≈ 4 characters (English)
        // 1 token ≈ 0.75 words (English)
        return {
          charBased: Math.ceil(charCount / 4),
          wordBased: Math.ceil(wordCount / 0.75),
        };
      };

      const promptTokens = estimateTokenCount(input.prompt);
      const negativeTokens = estimateTokenCount(input.negative);
      const totalTokens = {
        charBased: promptTokens.charBased + negativeTokens.charBased,
        wordBased: promptTokens.wordBased + negativeTokens.wordBased,
      };

      // Log final prompt before image generation
      logger.info("ai-sdk.prompt.final", {
        prompt: input.prompt,
        negative: input.negative,
        model,
        size: requestedSize,
        seed: input.seed,
        tokens: {
          prompt: promptTokens,
          negative: negativeTokens,
          total: totalTokens,
        },
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const result = await generateImage({
        model: resolvedModel,
        prompt: input.prompt,
        size: requestedSize,
        n: 1,
        abortSignal: controller.signal,
      }).finally(() => {
        clearTimeout(timeoutId);
      });

      logger.info("ai-sdk.generate.success", {
        model,
        size: result.image.uint8Array.byteLength,
        warnings: result.warnings,
      });

      // Convert Uint8Array to ArrayBuffer
      const uint8Array = result.image.uint8Array;
      const buffer = uint8Array.buffer;
      const imageBuffer: ArrayBuffer =
        buffer instanceof ArrayBuffer
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
      if (error instanceof Error && error.name === "AbortError") {
        return err({
          type: "ExternalApiError",
          provider: "ImageProvider",
          message: `Image generation timeout after ${timeoutMs}ms`,
        } as AppError);
      }
      return err({
        type: "ExternalApiError",
        provider: "ImageProvider",
        message: error instanceof Error ? error.message : String(error),
      } as AppError);
    }
  },
});
