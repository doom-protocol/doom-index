import { ok } from "neverthrow";
import type { ImageGenerationOptions, ImageProvider, ImageRequest, ImageResponse } from "@/types/domain";
import { logger } from "@/utils/logger";
import { estimateTokenCount } from "@/utils/text";

export const createMockImageProvider = (): ImageProvider => ({
  name: "mock",
  async generate(input: ImageRequest, _options?: ImageGenerationOptions) {
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
