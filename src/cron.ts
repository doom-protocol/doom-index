/**
 * Cloudflare Workers Cron Handler
 *
 * Executes at the interval specified by NEXT_PUBLIC_GENERATION_INTERVAL_MS to:
 * 1. Check idempotency (intervalBucket)
 * 2. Select token from trending or force list
 * 3. Fetch market data and store snapshot
 * 4. Build painting context
 * 5. Generate prompt
 * 6. Generate image
 * 7. Store painting to R2 and D1
 *
 * NOTE: The cron trigger in wrangler.toml must match NEXT_PUBLIC_GENERATION_INTERVAL_MS
 */

import { Result } from "neverthrow";
import { logger } from "./utils/logger";
import { getErrorMessage, getErrorStack } from "./utils/error";
import { reportError } from "./lib/error-reporter";
import { PaintingGenerationOrchestrator } from "./services/paintings/painting-generation-orchestrator";
import { TokenSelectionService } from "./services/paintings/token-selection";
import { TokenDataFetchService } from "./services/paintings/token-data-fetch";
import { MarketDataService } from "./services/paintings/market-data";
import { PaintingContextBuilder } from "./services/paintings/painting-context-builder";
import { CoinGeckoClient } from "./lib/coingecko-client";
import { AlternativeMeClient } from "./lib/alternative-me-client";
import { MarketSnapshotsRepository } from "./repositories/market-snapshots-repository";
import { TokensRepository } from "./repositories/tokens-repository";
import { getDB } from "./db";
import type { AppError } from "./types/app-error";
import type { PaintingGenerationResult } from "./services/paintings/painting-generation-orchestrator";
import { env as runtimeEnv } from "./env";

// Generation interval from environment variable (default: 10 minutes = 600000ms)
// This is used for logging purposes only. The actual execution frequency is controlled by the cron trigger.
const GENERATION_INTERVAL_MINUTES = Number(runtimeEnv.NEXT_PUBLIC_GENERATION_INTERVAL_MS || 600000) / (1000 * 60);

// ============================================================================
// Hourly Generation Pipeline
// ============================================================================

/**
 * Create orchestrator with all dependencies
 */
async function createOrchestrator(env: Cloudflare.Env): Promise<PaintingGenerationOrchestrator> {
  const db = await getDB(env.DB);
  const coinGeckoClient = new CoinGeckoClient(runtimeEnv.COINGECKO_API_KEY);
  const alternativeMeClient = new AlternativeMeClient();
  const marketSnapshotsRepository = new MarketSnapshotsRepository(db);
  const tokensRepository = new TokensRepository(db);
  const tokenDataFetchService = new TokenDataFetchService(coinGeckoClient);
  const marketDataService = new MarketDataService(coinGeckoClient, alternativeMeClient, marketSnapshotsRepository);
  const tokenSelectionService = new TokenSelectionService(tokenDataFetchService, marketDataService, tokensRepository);
  const paintingContextBuilder = new PaintingContextBuilder(tokensRepository);

  return new PaintingGenerationOrchestrator({
    tokenSelectionService,
    marketDataService,
    paintingContextBuilder,
    marketSnapshotsRepository,
    tokensRepository,
    r2Bucket: env.R2_BUCKET,
    d1Binding: env.DB,
  });
}

async function executeHourlyGeneration(env: Cloudflare.Env): Promise<Result<PaintingGenerationResult, AppError>> {
  const orchestrator = await createOrchestrator(env);
  return orchestrator.execute(env);
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
    generationIntervalMinutes: GENERATION_INTERVAL_MINUTES,
  });

  try {
    // Execute painting generation
    const result = await executeHourlyGeneration(env);

    if (result.isErr()) {
      logger.error("cron.failed", {
        error: result.error,
        durationMs: Date.now() - startTime,
      });

      // Report critical failures to Slack
      await reportError(result.error, "Cron Job Failed (Painting Generation)");
      return;
    }

    const { status, hourBucket, imageUrl, selectedToken } = result.value;

    logger.debug("cron.success", {
      status,
      hourBucket,
      imageUrl,
      tokenId: selectedToken?.id,
      tokenSymbol: selectedToken?.symbol,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.error("cron.error", {
      error: getErrorMessage(error),
      stack: getErrorStack(error),
      durationMs: Date.now() - startTime,
    });

    // Report unexpected exceptions to Slack
    await reportError(error, "Cron Job Exception");
  }
}
