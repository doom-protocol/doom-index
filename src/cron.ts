/**
 * Cloudflare Workers Cron Handler
 *
 * Executes every minute to:
 * 1. Fetch current market cap data
 * 2. Decide if generation is needed (hash comparison)
 * 3. Generate image if needed
 * 4. Store to archive (R2 + D1)
 * 5. Update global and token states
 */

import { err, ok, Result } from "neverthrow";
import { roundMc } from "./lib/round";
import { hashRoundedMap } from "./lib/pure/hash";
import { logger } from "./utils/logger";
import { getErrorMessage, getErrorStack } from "./utils/error";
import { TOKEN_TICKERS, type McMap, type McMapRounded } from "./constants/token";
import { extractIdFromFilename, buildArchiveKey } from "./utils/archive";
import { createMarketCapService } from "./services/market-cap";
import { createWorldPaintingPromptService } from "./services/world-painting-prompt";
import { createImageGenerationService } from "./services/image-generation";
import { createStateService } from "./services/state";
import { createArchiveService } from "./services/archive";
import { createImageProvider } from "./lib/image-generation-providers";
import { resolveBucketOrThrow } from "./lib/r2";
import type { GlobalState, TokenState } from "./types/domain";
import type { AppError } from "./types/app-error";
import type { ArchiveMetadata } from "./types/archive";
import type { VisualParams } from "./lib/pure/mapping";

// ============================================================================
// Helper Functions
// ============================================================================

type EvaluationDecision =
  | { shouldGenerate: false; reason: "no-change"; hash: string }
  | { shouldGenerate: true; hash: string };

function decideGeneration(currentHash: string, prevState: GlobalState | null): EvaluationDecision {
  const prevHash = prevState?.prevHash ?? null;

  // NOTE: Hash check is currently disabled for testing
  if (prevHash && prevHash === currentHash) {
    // TODO: Re-enable hash check after testing period
    // return { shouldGenerate: false, reason: "no-change", hash: currentHash };
  }

  return { shouldGenerate: true, hash: currentHash };
}

function minuteBucketToIso(minuteBucket: string): string {
  return `${minuteBucket}:00Z`;
}

function buildArchiveMetadata(params: {
  id: string;
  timestamp: string;
  paramsHash: string;
  seed: string;
  mcRounded: McMapRounded;
  visualParams: VisualParams;
  fileSize: number;
  prompt: string;
  negative: string;
}): ArchiveMetadata {
  return {
    id: params.id,
    timestamp: params.timestamp,
    minuteBucket: params.timestamp,
    paramsHash: params.paramsHash,
    seed: params.seed,
    mcRounded: params.mcRounded,
    visualParams: params.visualParams,
    imageUrl: "",
    fileSize: params.fileSize,
    prompt: params.prompt,
    negative: params.negative,
  };
}

function createTokenStates(imageUrl: string, minuteBucket: string): TokenState[] {
  return TOKEN_TICKERS.map(ticker => ({
    ticker,
    thumbnailUrl: imageUrl,
    updatedAt: minuteBucketToIso(minuteBucket),
  }));
}

// ============================================================================
// Minute Generation Pipeline
// ============================================================================

type MinuteEvaluation = {
  status: "skipped" | "generated";
  hash: string;
  roundedMap: McMapRounded;
  imageUrl?: string;
  paramsHash?: string;
  seed?: string;
};

async function evaluateMinute(env: Cloudflare.Env): Promise<Result<MinuteEvaluation, AppError>> {
  const bucket = resolveBucketOrThrow({ r2Bucket: env.R2_BUCKET });

  // Initialize services
  const marketCapService = createMarketCapService({ fetch, log: logger });
  const promptService = createWorldPaintingPromptService();
  const stateService = createStateService({ r2Bucket: bucket });
  const archiveService = createArchiveService({ r2Bucket: bucket, d1Binding: env.DB });
  const imageProvider = createImageProvider();
  const imageGenerationService = createImageGenerationService({
    promptService,
    imageProvider,
    log: logger,
  });

  // Step 1: Fetch and hash market cap data
  const mcResult = await marketCapService.getMcMap();
  if (mcResult.isErr()) return err(mcResult.error);

  const mcMap: McMap = mcResult.value;
  const roundedMap = roundMc(mcMap) as McMapRounded;
  const hash = await hashRoundedMap(roundedMap);

  logger.info("cron.mc-evaluated", { mcMap, roundedMap, hash });

  // Step 2: Decide if generation is needed
  const globalStateResult = await stateService.readGlobalState();
  if (globalStateResult.isErr()) return err(globalStateResult.error);

  const decision = decideGeneration(hash, globalStateResult.value);

  if (!decision.shouldGenerate) {
    logger.info("cron.skipped", {
      reason: decision.reason,
      hash: decision.hash,
    });
    return ok({
      status: "skipped" as const,
      hash: decision.hash,
      roundedMap,
    });
  }

  logger.info("cron.triggered", { hash });

  // Step 3: Generate image
  const generationResult = await imageGenerationService.generateImage(roundedMap);
  if (generationResult.isErr()) return err(generationResult.error);

  const { composition, imageBuffer } = generationResult.value;

  // Step 4: Store to archive
  const metadataId = extractIdFromFilename(composition.prompt.filename);
  const timestamp = minuteBucketToIso(composition.minuteBucket);

  const metadata: ArchiveMetadata = buildArchiveMetadata({
    id: metadataId,
    timestamp,
    paramsHash: composition.paramsHash,
    seed: composition.seed,
    mcRounded: roundedMap,
    visualParams: composition.vp,
    fileSize: imageBuffer.byteLength,
    prompt: composition.prompt.text,
    negative: composition.prompt.negative,
  });

  const archiveResult = await archiveService.storeImageWithMetadata(
    composition.minuteBucket,
    composition.prompt.filename,
    imageBuffer,
    metadata,
  );
  if (archiveResult.isErr()) return err(archiveResult.error);

  const imageUrl = archiveResult.value.imageUrl;
  const finalMetadata: ArchiveMetadata = { ...metadata, imageUrl };

  // Step 5: Index in D1 (non-blocking error)
  const r2Key = buildArchiveKey(composition.minuteBucket, composition.prompt.filename);
  const indexResult = await archiveService.insertArchiveItem(finalMetadata, r2Key);
  if (indexResult.isErr()) {
    logger.error("cron.index-failed", {
      error: indexResult.error,
      id: finalMetadata.id,
    });
  }

  // Step 6: Update states
  const globalWrite = await stateService.writeGlobalState({
    prevHash: hash,
    lastTs: timestamp,
    imageUrl,
  });
  if (globalWrite.isErr()) return err(globalWrite.error);

  const tokenStatesResult = await stateService.writeTokenStates(createTokenStates(imageUrl, composition.minuteBucket));
  if (tokenStatesResult.isErr()) return err(tokenStatesResult.error);

  logger.info("cron.completed", {
    hash,
    imageUrl,
    paramsHash: composition.paramsHash,
    seed: composition.seed,
  });

  return ok({
    status: "generated" as const,
    hash,
    roundedMap,
    imageUrl,
    paramsHash: composition.paramsHash,
    seed: composition.seed,
  });
}

// ============================================================================
// Cron Handler
// ============================================================================

export async function handleScheduledEvent(
  event: ScheduledEvent,
  env: Cloudflare.Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const startTime = Date.now();

  logger.debug("cron.started", {
    scheduledTime: new Date(event.scheduledTime).toISOString(),
    cron: event.cron,
  });

  try {
    const result = await evaluateMinute(env);

    if (result.isErr()) {
      logger.error("cron.failed", {
        error: result.error,
        durationMs: Date.now() - startTime,
      });
      return;
    }

    const { status, hash, imageUrl } = result.value;

    logger.info("cron.success", {
      status,
      hash,
      imageUrl,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.error("cron.error", {
      error: getErrorMessage(error),
      stack: getErrorStack(error),
      durationMs: Date.now() - startTime,
    });
  }
}
