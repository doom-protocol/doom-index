import { err, ok, Result } from "neverthrow";
import { roundMc } from "@/lib/round";
import { hashRoundedMap } from "@/lib/pure/hash";
import { logger } from "@/utils/logger";
import { estimateTokenCount } from "@/utils/text";
import { env } from "@/env";
import { TOKEN_TICKERS, type McMap, type McMapRounded } from "@/constants/token";
import type { MarketCapService } from "@/services/market-cap";
import type { PromptService, PromptComposition } from "@/services/prompt";
import type { ImageProvider, StateService, TokenState } from "@/types/domain";
import type { AppError } from "@/types/app-error";
import type { ArchiveStorageService } from "@/services/archive-storage";
import type { ArchiveIndexService } from "@/services/archive-index";
import type { ArchiveMetadata } from "@/types/archive";
import { extractIdFromFilename } from "@/lib/pure/archive";
import { buildArchiveKey } from "@/lib/pure/archive";

export type MinuteEvaluation = {
  status: "skipped" | "generated";
  hash: string;
  roundedMap: McMapRounded;
  imageUrl?: string;
  paramsHash?: string;
  seed?: string;
};

export type GenerationService = {
  evaluateMinute(): Promise<Result<MinuteEvaluation, AppError>>;
};

type GenerationDeps = {
  marketCapService: Pick<MarketCapService, "getMcMap">;
  promptService: PromptService;
  imageProvider: ImageProvider;
  stateService: StateService;
  archiveStorageService: ArchiveStorageService; // Required: uses archive storage for images and metadata
  archiveIndexService: ArchiveIndexService; // Required: uses D1 for archive indexing
  log?: typeof logger;
};

const minuteBucketToIso = (minuteBucket: string): string => `${minuteBucket}:00Z`;

const createTokenStates = (imageUrl: string, minuteBucket: string): TokenState[] =>
  TOKEN_TICKERS.map(ticker => ({
    ticker,
    thumbnailUrl: imageUrl,
    updatedAt: minuteBucketToIso(minuteBucket),
  }));

export function createGenerationService({
  marketCapService,
  promptService,
  imageProvider,
  stateService,
  archiveStorageService,
  archiveIndexService,
  log = logger,
}: GenerationDeps): GenerationService {
  /**
   * Evaluate the minute generation
   * If the generation is skipped, return a result with the status "skipped"
   * If the generation is successful, return a result with the status "generated"
   * If the generation fails, return a result with the error
   * @returns {Promise<Result<MinuteEvaluation, AppError>>}
   */
  async function evaluateMinute(): Promise<Result<MinuteEvaluation, AppError>> {
    const mcResult = await marketCapService.getMcMap();
    if (mcResult.isErr()) return err(mcResult.error);

    const mcMap: McMap = mcResult.value;
    const roundedMap = roundMc(mcMap) as McMapRounded;
    const hash = await hashRoundedMap(roundedMap);

    // Log market cap values and calculated values
    log.info("generation.mc", {
      mcMap,
      roundedMap,
      hash,
    });

    const globalStateResult = await stateService.readGlobalState();
    if (globalStateResult.isErr()) return err(globalStateResult.error);

    const prevState = globalStateResult.value;
    const prevHash = prevState?.prevHash ?? null;

    if (prevHash && prevHash === hash) {
      log.info("generation.skip", { hash, prevHash });
      log.info("DISABLE HASH CHECK RIGHT NOW", { hash, prevHash });
      // NOTE: DISABLE HASH CHECK FOR A WHILE
      // return ok({
      //   status: "skipped" as const,
      //   hash,
      //   roundedMap,
      // });
    }

    log.info("generation.trigger", { hash, prevHash });

    const promptResult = await promptService.composePrompt(roundedMap);
    if (promptResult.isErr()) return err(promptResult.error);
    const composition: PromptComposition = promptResult.value;

    // Log visual parameters and prompt composition
    log.info("generation.composition", {
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
    log.info("generation.prompt.final", {
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

    const generationTimeoutMs = 15_000;
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

    // Build archive metadata
    const metadataId = extractIdFromFilename(composition.prompt.filename);
    const timestamp = minuteBucketToIso(composition.minuteBucket);
    const metadata: ArchiveMetadata = {
      id: metadataId,
      timestamp,
      minuteBucket: timestamp,
      paramsHash: composition.paramsHash,
      seed: composition.seed,
      mcRounded: roundedMap,
      visualParams: composition.vp,
      imageUrl: "", // Will be set by archiveStorageService
      fileSize: imageResult.value.imageBuffer.byteLength,
      prompt: composition.prompt.text,
      negative: composition.prompt.negative,
    };

    const archiveResult = await archiveStorageService.storeImageWithMetadata(
      composition.minuteBucket,
      composition.prompt.filename,
      imageResult.value.imageBuffer,
      metadata,
    );
    if (archiveResult.isErr()) return err(archiveResult.error);
    const imageUrl = archiveResult.value.imageUrl;

    const finalMetadata: ArchiveMetadata = {
      ...metadata,
      imageUrl,
    };

    const r2Key = buildArchiveKey(composition.minuteBucket, composition.prompt.filename);
    const indexResult = await archiveIndexService.insertArchiveItem(finalMetadata, r2Key);
    if (indexResult.isErr()) {
      log.error("generation.d1-index.error", { error: indexResult.error, id: finalMetadata.id });
    }

    const globalWrite = await stateService.writeGlobalState({
      prevHash: hash,
      lastTs: minuteBucketToIso(composition.minuteBucket),
      imageUrl,
    });
    if (globalWrite.isErr()) return err(globalWrite.error);

    const tokenStatesResult = await stateService.writeTokenStates(
      createTokenStates(imageUrl, composition.minuteBucket),
    );
    if (tokenStatesResult.isErr()) return err(tokenStatesResult.error);

    log.info("generation.generated", { hash, imageUrl });

    return ok({
      status: "generated" as const,
      hash,
      roundedMap,
      imageUrl,
      paramsHash: composition.paramsHash,
      seed: composition.seed,
    });
  }

  return { evaluateMinute };
}
