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
import type { McMapRounded } from "@/constants/token";
import type { ImageProvider } from "@/types/domain";
import type { AppError } from "@/types/app-error";
import type { PromptService, PromptComposition } from "@/services/prompt";

export type ImageGenerationResult = {
  composition: PromptComposition;
  imageBuffer: ArrayBuffer;
  providerMeta: Record<string, unknown>;
};

export type ImageGenerationService = {
  generateImage(mcRounded: McMapRounded): Promise<Result<ImageGenerationResult, AppError>>;
};

type ImageGenerationDeps = {
  promptService: PromptService;
  imageProvider: ImageProvider;
  generationTimeoutMs?: number;
  log?: typeof logger;
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
   * Generate image from market cap data
   *
   * @param mcRounded - Rounded market cap map
   * @returns Generation result with image buffer and metadata
   */
  async function generateImage(mcRounded: McMapRounded): Promise<Result<ImageGenerationResult, AppError>> {
    // Step 1: Compose prompt
    const promptResult = await promptService.composePrompt(mcRounded);
    if (promptResult.isErr()) return err(promptResult.error);

    const composition = promptResult.value;

    // Log visual parameters and prompt composition
    log.info("image-generation.composition", {
      visualParams: composition.vp,
      paramsHash: composition.paramsHash,
      seed: composition.seed,
      size: `${composition.prompt.size.w}x${composition.prompt.size.h}`,
    });

    // Estimate token count from prompt
    const promptTokens = estimateTokenCount(composition.prompt.text);
    const negativeTokens = estimateTokenCount(composition.prompt.negative);
    const totalTokens = {
      charBased: promptTokens.charBased + negativeTokens.charBased,
      wordBased: promptTokens.wordBased + negativeTokens.wordBased,
    };

    // Log final prompt before image generation
    log.info("image-generation.prompt", {
      prompt: composition.prompt.text,
      negative: composition.prompt.negative,
      seed: composition.prompt.seed,
      model: env.IMAGE_MODEL,
      size: `${composition.prompt.size.w}x${composition.prompt.size.h}`,
      tokens: {
        prompt: promptTokens,
        negative: negativeTokens,
        total: totalTokens,
      },
    });

    // Step 2: Generate image
    const imageResult = await imageProvider.generate(
      {
        prompt: composition.prompt.text,
        negative: composition.prompt.negative,
        width: composition.prompt.size.w,
        height: composition.prompt.size.h,
        format: composition.prompt.format,
        seed: composition.prompt.seed,
        model: env.IMAGE_MODEL,
      },
      {
        timeoutMs: generationTimeoutMs,
      },
    );

    if (imageResult.isErr()) return err(imageResult.error);

    log.info("image-generation.success", {
      paramsHash: composition.paramsHash,
      seed: composition.seed,
      bufferSize: imageResult.value.imageBuffer.byteLength,
    });

    return ok({
      composition,
      imageBuffer: imageResult.value.imageBuffer,
      providerMeta: imageResult.value.providerMeta,
    });
  }

  return { generateImage };
}
