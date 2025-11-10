import { err, ok, Result } from "neverthrow";
import { normalizeMcMap } from "@/lib/pure/normalize";
import { mapToVisualParams, type VisualParams } from "@/lib/pure/mapping";
import { hashVisualParams, seedForMinute, buildGenerationFileName } from "@/lib/pure/hash";
import { buildSDXLPrompt } from "@/lib/pure/doom-prompt";
import { getMinuteBucket } from "@/lib/time";
import { logger } from "@/utils/logger";
import type { McMapRounded } from "@/constants/token";
import type { AppError } from "@/types/app-error";

export type PromptComposition = {
  seed: string;
  minuteBucket: string;
  vp: VisualParams;
  prompt: {
    text: string;
    negative: string;
    size: { w: number; h: number };
    format: "webp";
    seed: string;
    filename: string;
  };
  paramsHash: string;
};

type PromptServiceDeps = {
  getMinuteBucket?: () => string;
  log?: typeof logger;
};

export type PromptService = {
  composePrompt(input: McMapRounded): Promise<Result<PromptComposition, AppError>>;
};

export function createPromptService({
  getMinuteBucket: minuteBucketFn = () => getMinuteBucket(),
  log = logger,
}: PromptServiceDeps = {}): PromptService {
  async function composePrompt(mcRounded: McMapRounded): Promise<Result<PromptComposition, AppError>> {
    try {
      const normalized = normalizeMcMap(mcRounded);
      const vp = mapToVisualParams(normalized);
      const paramsHash = await hashVisualParams(vp);
      const minuteBucket = minuteBucketFn();
      const seed = await seedForMinute(minuteBucket, paramsHash);

      // Build weighted prompt using doom-prompt
      const { prompt: promptText, negative: negativePrompt } = buildSDXLPrompt(mcRounded);
      const filename = buildGenerationFileName(minuteBucket, paramsHash, seed);

      const composition: PromptComposition = {
        seed,
        minuteBucket,
        vp,
        prompt: {
          text: promptText,
          negative: negativePrompt,
          size: { w: 1280, h: 720 },
          format: "webp",
          seed,
          filename,
        },
        paramsHash,
      };

      log.debug("prompt.compose", { paramsHash, seed, minuteBucket });
      return ok(composition);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown prompt composition error";
      log.error("prompt.compose.error", { message });
      return err({ type: "InternalError", message, cause: error });
    }
  }

  return { composePrompt };
}
