/**
 * Painting Generation Orchestrator
 *
 * Orchestrates the hourly painting generation pipeline:
 * 1. Generate hourBucket and check idempotency
 * 2. Select token from trending or force list
 * 3. Fetch market data and store snapshot
 * 4. Build painting context
 * 5. Generate prompt
 * 6. Generate image
 * 7. Store painting to R2 and D1
 *
 * Requirements: 10, 12
 */

import { Result, ok, err } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { getHourBucket } from "@/utils/time";
import { logger } from "@/utils/logger";
import { TokenSelectionService } from "./token-selection";
import { MarketDataService } from "./market-data";
import { PaintingContextBuilder } from "./painting-context-builder";
import { MarketSnapshotsRepository } from "@/repositories/market-snapshots-repository";
import { TokensRepository } from "@/repositories/tokens-repository";
import { createWorldPromptService } from "@/services/world-prompt-service";
import { createImageGenerationService } from "@/services/image-generation";
import { createImageProvider } from "@/lib/image-generation-providers";
import { createPaintingsService } from "./index";
import { resolveBucketOrThrow } from "@/lib/r2";
import { extractIdFromFilename, buildPaintingKey } from "@/utils/paintings";
import { createWorkersAiClient } from "@/lib/workers-ai-client";
import { createTokenContextService } from "@/services/token-context-service";
import { createTavilyClient } from "@/lib/tavily-client";
import type { SelectedToken } from "@/types/paintings";
import type { PaintingMetadata } from "@/types/paintings";
import { env } from "@/env";

/**
 * Painting Generation Result
 */
export type PaintingGenerationResult = {
  status: "skipped" | "generated";
  hourBucket: string;
  selectedToken?: SelectedToken;
  imageUrl?: string;
  paramsHash?: string;
  seed?: string;
};

/**
 * Painting Generation Orchestrator Dependencies
 */
type OrchestratorDeps = {
  tokenSelectionService: TokenSelectionService;
  marketDataService: MarketDataService;
  paintingContextBuilder: PaintingContextBuilder;
  marketSnapshotsRepository: MarketSnapshotsRepository;
  tokensRepository: TokensRepository;
  r2Bucket?: R2Bucket;
  d1Binding?: D1Database;
};

/**
 * Painting Generation Orchestrator
 * Executes hourly painting generation pipeline
 */
export class PaintingGenerationOrchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  /**
   * Execute hourly painting generation (Requirement 10)
   */
  async execute(cloudflareEnv: Cloudflare.Env): Promise<Result<PaintingGenerationResult, AppError>> {
    try {
      const hourBucket = getHourBucket();
      logger.info(`[PaintingGenerationOrchestrator] Starting execution for hourBucket: ${hourBucket}`);

      // Step 1: Check idempotency (Requirement 10)
      const existingSnapshot = await this.deps.marketSnapshotsRepository.findByHourBucket(hourBucket);
      if (existingSnapshot.isErr()) {
        return err(existingSnapshot.error);
      }

      if (existingSnapshot.value !== null) {
        logger.info(`[PaintingGenerationOrchestrator] Skipping duplicate hourBucket: ${hourBucket}`);
        return ok({
          status: "skipped",
          hourBucket,
        });
      }

      // Step 2: Select token (Requirement 1D)
      // FORCE_TOKEN_LIST is optional env var, accessed via process.env or Cloudflare env
      const forceTokenList = env.FORCE_TOKEN_LIST;
      const tokenSelectionResult = await this.deps.tokenSelectionService.selectToken({
        forceTokenList,
        excludeRecentlySelected: true,
        recentSelectionWindowHours: 24,
      });

      if (tokenSelectionResult.isErr()) {
        logger.error(`[PaintingGenerationOrchestrator] Token selection failed`, {
          error: tokenSelectionResult.error,
        });
        return err(tokenSelectionResult.error);
      }

      const selectedToken = tokenSelectionResult.value;
      logger.info(`[PaintingGenerationOrchestrator] Selected token: ${selectedToken.id} (${selectedToken.symbol})`, {
        tokenId: selectedToken.id,
        symbol: selectedToken.symbol,
        name: selectedToken.name,
        source: selectedToken.source,
        scores: selectedToken.scores,
      });

      // Step 3: Fetch and store market data (Requirement 3, 9)
      const marketDataResult = await this.deps.marketDataService.fetchGlobalMarketData();
      if (marketDataResult.isErr()) {
        logger.error(`[PaintingGenerationOrchestrator] Market data fetch failed`, {
          error: marketDataResult.error,
        });
        return err(marketDataResult.error);
      }

      const marketSnapshot = marketDataResult.value;
      const storeSnapshotResult = await this.deps.marketDataService.storeMarketSnapshot(marketSnapshot, hourBucket);
      if (storeSnapshotResult.isErr()) {
        logger.error(`[PaintingGenerationOrchestrator] Market snapshot storage failed`, {
          error: storeSnapshotResult.error,
        });
        return err(storeSnapshotResult.error);
      }

      // Step 4: Build painting context (Requirement 5)
      const contextResult = await this.deps.paintingContextBuilder.buildContext({
        selectedToken,
        marketSnapshot,
      });

      if (contextResult.isErr()) {
        logger.error(`[PaintingGenerationOrchestrator] Context building failed`, {
          error: contextResult.error,
        });
        return err(contextResult.error);
      }

      const paintingContext = contextResult.value;
      logger.info(`[PaintingGenerationOrchestrator] Built painting context`, {
        climate: paintingContext.c,
        archetype: paintingContext.a,
        composition: paintingContext.o,
        palette: paintingContext.p,
      });

      // Step 5: Initialize services for image generation
      const bucket = resolveBucketOrThrow({ r2Bucket: this.deps.r2Bucket ?? cloudflareEnv.R2_BUCKET });
      const d1Binding = this.deps.d1Binding ?? cloudflareEnv.DB;

      // Initialize Workers AI client and token context service
      const workersAiClient = createWorkersAiClient({ aiBinding: cloudflareEnv.AI });
      const tavilyClient = createTavilyClient();
      const tokenContextService = createTokenContextService({
        tavilyClient,
        workersAiClient,
      });

      const promptService = createWorldPromptService({
        tokenContextService,
        tokensRepository: this.deps.tokensRepository,
        workersAiClient,
      });

      const tokenMeta = {
        id: selectedToken.id,
        name: selectedToken.name,
        symbol: selectedToken.symbol,
        chainId: "unknown",
        contractAddress: null,
        createdAt: new Date().toISOString(),
      };

      // Step 6: Generate image (Requirement 7)
      const imageProvider = createImageProvider();
      const imageGenerationService = createImageGenerationService({
        promptService,
        imageProvider,
        log: logger,
      });

      const imageResult = await imageGenerationService.generateTokenImage({
        paintingContext,
        tokenMeta,
        referenceImageUrl: selectedToken.logoUrl,
      });

      if (imageResult.isErr()) {
        logger.error(`[PaintingGenerationOrchestrator] Image generation failed`, {
          error: imageResult.error,
        });
        return err(imageResult.error);
      }

      const { composition: finalComposition, imageBuffer } = imageResult.value;
      logger.info(`[PaintingGenerationOrchestrator] Generated image`, {
        paramsHash: finalComposition.paramsHash,
        seed: finalComposition.seed,
        bufferSize: imageBuffer.byteLength,
      });

      // Step 7: Store painting (Requirement 9)
      const paintingsService = createPaintingsService({
        r2Bucket: bucket,
        d1Binding,
      });

      const metadataId = extractIdFromFilename(finalComposition.prompt.filename);
      const timestamp = `${finalComposition.minuteBucket}:00Z`;

      const metadata: PaintingMetadata = {
        id: metadataId,
        timestamp,
        minuteBucket: timestamp,
        paramsHash: finalComposition.paramsHash,
        seed: finalComposition.seed,
        visualParams: finalComposition.vp,
        imageUrl: "",
        fileSize: imageBuffer.byteLength,
        prompt: finalComposition.prompt.text,
        negative: finalComposition.prompt.negative,
      };

      const storeResult = await paintingsService.storeImageWithMetadata(
        finalComposition.minuteBucket,
        finalComposition.prompt.filename,
        imageBuffer,
        metadata,
      );

      if (storeResult.isErr()) {
        logger.error(`[PaintingGenerationOrchestrator] Painting storage failed`, {
          error: storeResult.error,
        });
        return err(storeResult.error);
      }

      const imageUrl = storeResult.value.imageUrl;
      const finalMetadata: PaintingMetadata = { ...metadata, imageUrl };

      // Step 8: Index in D1 (non-blocking error)
      const r2Key = buildPaintingKey(finalComposition.minuteBucket, finalComposition.prompt.filename);
      const indexResult = await paintingsService.insertPainting(finalMetadata, r2Key);
      if (indexResult.isErr()) {
        logger.error(`[PaintingGenerationOrchestrator] Painting indexing failed`, {
          error: indexResult.error,
          id: finalMetadata.id,
        });
        // Continue execution even if indexing fails
      }

      logger.info(`[PaintingGenerationOrchestrator] Completed successfully`, {
        hourBucket,
        tokenId: selectedToken.id,
        symbol: selectedToken.symbol,
        imageUrl,
        paramsHash: finalComposition.paramsHash,
        seed: finalComposition.seed,
      });

      return ok({
        status: "generated",
        hourBucket,
        selectedToken,
        imageUrl,
        paramsHash: finalComposition.paramsHash,
        seed: finalComposition.seed,
      });
    } catch (error) {
      logger.error(`[PaintingGenerationOrchestrator] Unexpected error`, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      return err({
        type: "InternalError" as const,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
