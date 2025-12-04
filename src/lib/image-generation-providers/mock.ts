import type { ImageGenerationOptions, ImageProvider, ImageRequest, ImageResponse } from "@/types/domain";
import { logger } from "@/utils/logger";
import { estimateTokenCount } from "@/utils/text";
import { ok } from "neverthrow";

export const createMockImageProvider = (): ImageProvider => ({
  name: "mock",
  // eslint-disable-next-line @typescript-eslint/require-await
  async generate(input: ImageRequest, options?: ImageGenerationOptions) {
    void options;
    // Estimate token count from prompt
    const promptTokens = estimateTokenCount(input.prompt);
    const negativeTokens = estimateTokenCount(input.negative);
    const totalTokens = {
      charBased: promptTokens.charBased + negativeTokens.charBased,
      wordBased: promptTokens.wordBased + negativeTokens.wordBased,
    };

    // Log final prompt before image generation (mock)
    logger.info("mock.prompt.final", {
      prompt: input.prompt,
      negative: input.negative,
      model: input.model,
      size: `${input.width}x${input.height}`,
      seed: input.seed,
      referenceImageUrl: input.referenceImageUrl ?? null,
      tokens: {
        prompt: promptTokens,
        negative: negativeTokens,
        total: totalTokens,
      },
    });

    const response: ImageResponse = {
      imageBuffer: new ArrayBuffer(0),
      providerMeta: { mock: true },
    };
    return ok(response);
  },
});
