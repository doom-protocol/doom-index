/**
 * Image Generation Orchestration Service
 *
 * Coordinates the image generation pipeline:
 * 1. Generate prompt from market cap data
 * 2. Request image from provider
 * 3. Return generation result with metadata
 *
 * This service focuses solely on the generation aspect,
 * leaving storage and indexing to other services.
 */

import { err, ok, Result } from "neverthrow";
import { logger } from "@/utils/logger";
import { estimateTokenCount } from "@/utils/text";
import { env } from "@/env";
import type { ImageProvider } from "@/types/domain";
import type { AppError } from "@/types/app-error";
import type { WorldPromptService, PromptComposition } from "@/services/world-prompt-service";
import type { PaintingContext } from "@/types/painting-context";
import type { TokenMetaInput } from "@/services/token-context-service";

type ImageGenerationResult = {
  composition: PromptComposition;
  imageBuffer: ArrayBuffer;
  providerMeta: Record<string, unknown>;
};

type ImageGenerationService = {
  generateTokenImage(input: TokenImageGenerationInput): Promise<Result<ImageGenerationResult, AppError>>;
};

type ImageGenerationDeps = {
  promptService: WorldPromptService;
  imageProvider: ImageProvider;
  generationTimeoutMs?: number;
  log?: typeof logger;
};

type TokenImageGenerationInput = {
  paintingContext: PaintingContext;
  tokenMeta: TokenMetaInput;
  referenceImageUrl?: string | null;
};

/**
 * Create image generation orchestration service
 *
 * @param deps - Service dependencies
 * @returns Image generation service
 */
export function createImageGenerationService({
  promptService,
  imageProvider,
  generationTimeoutMs = 15_000,
  log = logger,
}: ImageGenerationDeps): ImageGenerationService {
  /**
   * Generate image from token context
   *
   * @returns Generation result with image buffer and metadata
   */
  const sanitizeReferenceImageUrl = (url?: string | null): string | null => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
      parsed.protocol = "https:";
      return parsed.toString();
    } catch {
      return null;
    }
  };

  const logPromptDetails = (composition: PromptComposition, referenceImageUrl: string | null) => {
    log.info("image-generation.composition", {
      visualParams: composition.vp,
      paramsHash: composition.paramsHash,
      seed: composition.seed,
      size: `${composition.prompt.size.w}x${composition.prompt.size.h}`,
      referenceImageUrl,
    });

    const promptTokens = estimateTokenCount(composition.prompt.text);
    const negativeTokens = estimateTokenCount(composition.prompt.negative);
    const totalTokens = {
      charBased: promptTokens.charBased + negativeTokens.charBased,
      wordBased: promptTokens.wordBased + negativeTokens.wordBased,
    };

    log.info("image-generation.prompt", {
      prompt: composition.prompt.text,
      negative: composition.prompt.negative,
      seed: composition.prompt.seed,
      model: env.IMAGE_MODEL,
      size: `${composition.prompt.size.w}x${composition.prompt.size.h}`,
      referenceImageUrl,
      tokens: {
        prompt: promptTokens,
        negative: negativeTokens,
        total: totalTokens,
      },
    });
  };

  const requestImage = async (
    composition: PromptComposition,
    options?: { referenceImageUrl?: string | null },
  ): Promise<Result<ImageGenerationResult, AppError>> => {
    const sanitizedReference = sanitizeReferenceImageUrl(options?.referenceImageUrl);
    logPromptDetails(composition, sanitizedReference);

    const imageResult = await imageProvider.generate(
      {
        prompt: composition.prompt.text,
        negative: composition.prompt.negative,
        width: composition.prompt.size.w,
        height: composition.prompt.size.h,
        format: composition.prompt.format,
        seed: composition.prompt.seed,
        model: env.IMAGE_MODEL,
        ...(sanitizedReference ? { referenceImageUrl: sanitizedReference } : {}),
      },
      {
        timeoutMs: generationTimeoutMs,
      },
    );

    if (imageResult.isErr()) {
      log.error("image-generation.failure", {
        paramsHash: composition.paramsHash,
        seed: composition.seed,
        referenceImageUrl: sanitizedReference,
        error: imageResult.error,
      });
      return err(imageResult.error);
    }

    log.info("image-generation.success", {
      paramsHash: composition.paramsHash,
      seed: composition.seed,
      bufferSize: imageResult.value.imageBuffer.byteLength,
      referenceImageUrl: sanitizedReference,
    });

    return ok({
      composition,
      imageBuffer: imageResult.value.imageBuffer,
      providerMeta: imageResult.value.providerMeta,
    });
  };

  async function generateTokenImage(
    input: TokenImageGenerationInput,
  ): Promise<Result<ImageGenerationResult, AppError>> {
    const promptResult = await promptService.composeTokenPrompt({
      paintingContext: input.paintingContext,
      tokenMeta: input.tokenMeta,
      referenceImageUrl: input.referenceImageUrl,
    });

    if (promptResult.isErr()) return err(promptResult.error);

    return requestImage(promptResult.value, { referenceImageUrl: input.referenceImageUrl });
  }

  return { generateTokenImage };
}
