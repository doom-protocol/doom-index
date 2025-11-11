import { ok } from "neverthrow";
import type { ImageGenerationOptions, ImageProvider, ImageRequest, ImageResponse } from "@/types/domain";
import { logger } from "@/utils/logger";

export const createMockImageProvider = (): ImageProvider => ({
  name: "mock",
  async generate(input: ImageRequest, _options?: ImageGenerationOptions) {
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
