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
 * 7. Store painting to Arweave and D1
 *
 * NOTE: The cron trigger in wrangler.toml must match NEXT_PUBLIC_GENERATION_INTERVAL_MS
 */

import type { Result } from "neverthrow";
import { getDB } from "./server/db";
import { env as runtimeEnv } from "./env";
import { AlternativeMeClient } from "./lib/alternative-me-client";
import { CoinGeckoClient } from "./lib/coingecko-client";
import { reportError } from "./lib/error-reporter";
import { MarketSnapshotsRepository } from "./server/repositories/market-snapshots-repository";
import { TokensRepository } from "./server/repositories/tokens-repository";
import { MarketDataService } from "./server/services/paintings/market-data";
import { PaintingContextBuilder } from "./server/services/paintings/painting-context-builder";
import type { PaintingGenerationResult } from "./server/services/paintings/painting-generation-orchestrator";
import { PaintingGenerationOrchestrator } from "./server/services/paintings/painting-generation-orchestrator";
import { TokenDataFetchService } from "./server/services/paintings/token-data-fetch";
import { TokenSelectionService } from "./server/services/paintings/token-selection";
import type { AppError } from "./types/app-error";
import { getErrorMessage, getErrorStack } from "./utils/error";
import { logger } from "./utils/logger";

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
    d1Binding: env.DB,
    assetsFetcher: env.ASSETS,
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
  event: ScheduledController,
  env: Cloudflare.Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const startTime = Date.now();

  logger.info("cron.started", {
    scheduledTime: new Date(event.scheduledTime).toISOString(),
    cron: event.cron,
    generationIntervalMinutes: runtimeEnv.NEXT_PUBLIC_GENERATION_INTERVAL_MS / 60000,
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

    logger.info("cron.success", {
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
