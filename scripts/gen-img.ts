#!/usr/bin/env bun

/**
 * Image Generation Script (Production Flow Simulation)
 *
 * This script executes the full painting generation pipeline using local resources:
 * - Local Wrangler D1 SQLite state
 * - Cloudflare REST API (instead of Workers AI binding)
 * - Local file system writeout (instead of Arweave upload)
 *
 * Usage:
 *   bun run --env-file=.env.local scripts/gen-img.ts
 */

import { DEFAULT_RUNWARE_MODEL } from "@/constants/runware";
import { env } from "@/env";
import { AlternativeMeClient } from "@/lib/alternative-me-client";
import { CoinGeckoClient } from "@/lib/coingecko-client";
import { createRunwareProvider } from "@/lib/image-generation-providers/runware";
import { createTavilyClient } from "@/lib/tavily-client";
import { createWorkersAiClient } from "@/lib/workers-ai-client";
import { resolveLocalD1SqlitePath, setupLocalDb } from "@/server/db/helper";
import type * as schema from "@/server/db/schema";
import { paintings } from "@/server/db/schema/paintings";
import { MarketSnapshotsRepository } from "@/server/repositories/market-snapshots-repository";
import type { PaintingsRepository } from "@/server/repositories/paintings-repository";
import { TokensRepository } from "@/server/repositories/tokens-repository";
import { createImageGenerationService } from "@/server/services/image-generation";
import type { PaintingsService } from "@/server/services/paintings";
import { MarketDataService } from "@/server/services/paintings/market-data";
import { PaintingContextBuilder } from "@/server/services/paintings/painting-context-builder";
import { PaintingGenerationOrchestrator } from "@/server/services/paintings/painting-generation-orchestrator";
import { TokenDataFetchService } from "@/server/services/paintings/token-data-fetch";
import { TokenSelectionService } from "@/server/services/paintings/token-selection";
import { createTokenAnalysisService } from "@/server/services/token-analysis-service";
import { createWorldPromptService } from "@/server/services/world-prompt-service";
import type { AppError } from "@/types/app-error";
import type { PaintingMetadata } from "@/types/paintings";
import { logger } from "@/utils/logger";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { err, ok } from "neverthrow";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

interface Args {
  seed?: string;
  model?: string;
  width: number;
  height: number;
  format: "webp" | "png";
  output: string;
}

type BunWithOptionalExit = typeof Bun & {
  exit?: (code?: number) => never;
};

const safeExit = (code: number): never => {
  const bunWithExit = Bun as BunWithOptionalExit;
  if (typeof bunWithExit.exit === "function") {
    return bunWithExit.exit(code);
  }
  return process.exit(code);
};

const parseArgs = (): Args => {
  const args = Bun.argv.slice(2);
  const parsed: Partial<Args> = {
    width: 1280,
    height: 720,
    format: "webp",
    output: "out",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "--seed":
        parsed.seed = next;
        i++;
        break;
      case "--model":
        parsed.model = next;
        i++;
        break;
      case "--w":
      case "--width":
        parsed.width = Number.parseInt(next, 10);
        i++;
        break;
      case "--h":
      case "--height":
        parsed.height = Number.parseInt(next, 10);
        i++;
        break;
      case "--format":
        parsed.format = next as "webp" | "png";
        i++;
        break;
      case "--output":
        parsed.output = next;
        i++;
        break;
      case "--help":
        console.log(`
Usage: bun scripts/gen-img.ts [options]

Options:
  --seed <string>      Custom seed (default: auto-generated)
  --model <name>       Model name: runware:106@1, etc. (default: runware:106@1)
  --w, --width <num>   Image width (default: 1280)
  --h, --height <num>  Image height (default: 720)
  --format <fmt>       Output format: webp, png (default: webp)
  --output <path>      Output directory (default: ./out)
  --help               Show this help
        `);
        safeExit(0);
    }
  }

  return parsed as Args;
};

// Create local paintings repository adapter
const createLocalPaintingsRepository = (db: BunSQLiteDatabase<typeof schema>): PaintingsRepository => {
  return {
    list: async () => Promise.resolve(ok({ items: [], hasMore: false })),
    insert: async (record) => {
      try {
        const ts = Math.floor(new Date(record.timestamp).getTime() / 1000);

        await db
          .insert(paintings)
          .values({
            id: record.id,
            ts,
            timestamp: record.timestamp,
            minuteBucket: record.minuteBucket,
            paramsHash: record.paramsHash,
            seed: record.seed,
            imageTxId: record.imageTxId,
            glbTxId: record.glbTxId ?? null,
            imageUrl: record.imageUrl,
            glbUrl: record.glbUrl ?? null,
            fileSize: record.fileSize,
            visualParamsJson: JSON.stringify(record.visualParams),
            prompt: record.prompt,
            negative: record.negative,
          })
          .onConflictDoNothing();

        return ok(undefined);
      } catch (e) {
        console.error("Failed to insert painting locally:", e);
        return err({
          type: "StorageError",
          op: "put",
          key: record.id,
          message: `Failed to insert painting locally: ${e instanceof Error ? e.message : String(e)}`,
        } satisfies AppError);
      }
    },
    findById: async () => Promise.resolve(ok(null)),
    updateMintAssetRefs: async () => Promise.resolve(ok(undefined)),
  };
};

const createLocalPaintingsService = (outputDir: string, archiveRepository: PaintingsRepository): PaintingsService => ({
  getPaintingById: archiveRepository.findById,
  insertPainting: archiveRepository.insert,
  listImages: async () => {
    await Promise.resolve();
    return ok({ items: [], hasMore: false });
  },
  storePaintingAssets: async (params) => {
    await mkdir(outputDir, { recursive: true });

    const imagePath = join(outputDir, `${params.paintingId}.webp`);
    await Bun.write(imagePath, params.imageBuffer);

    return ok({
      imageTxId: `local-${params.paintingId}-image`,
      imageUrl: pathToFileURL(imagePath).toString(),
    });
  },
});

const main = async () => {
  const args = parseArgs();

  // Default model if not provided
  if (!args.model) {
    args.model = DEFAULT_RUNWARE_MODEL;
  }

  logger.info("gen-img.start", {
    model: args.model,
    mode: "local-simulation",
    hasCoingeckoKey: !!env.COINGECKO_API_KEY,
    hasRunwareKey: !!env.RUNWARE_API_KEY,
    hasTavilyKey: !!env.TAVILY_API_KEY,
  });

  // Setup local Wrangler D1 state
  const dbPath = resolveLocalD1SqlitePath();
  const db = setupLocalDb(dbPath);
  logger.info(`Using local Wrangler D1 DB: ${dbPath}`);

  const outputDir = join(args.output, "arweave-fixture");

  // Initialize Clients
  const workersAiClient = createWorkersAiClient();
  const tavilyClient = createTavilyClient();
  const coingeckoClient = new CoinGeckoClient(env.COINGECKO_API_KEY);
  const alternativeMeClient = new AlternativeMeClient();
  const imageProvider = createRunwareProvider();

  // Initialize Repositories with Local DB
  const tokensRepository = new TokensRepository(db);
  const marketSnapshotsRepository = new MarketSnapshotsRepository(db);

  const paintingsRepository = createLocalPaintingsRepository(db);

  // Initialize Services
  const tokenAnalysisService = createTokenAnalysisService({
    tavilyClient,
    workersAiClient,
    tokensRepository,
  });

  const worldPromptService = createWorldPromptService({
    tokenAnalysisService,
    tokensRepository,
    workersAiClient,
  });

  createImageGenerationService({
    promptService: worldPromptService,
    imageProvider,
    log: logger,
  });

  // Instantiate services in correct order
  const tokenDataFetchService = new TokenDataFetchService(coingeckoClient);

  const marketDataService = new MarketDataService(coingeckoClient, alternativeMeClient, marketSnapshotsRepository);

  const tokenSelectionService = new TokenSelectionService(tokenDataFetchService, marketDataService, tokensRepository);

  const paintingContextBuilder = new PaintingContextBuilder(tokensRepository);

  const paintingsService = createLocalPaintingsService(outputDir, paintingsRepository);

  // Initialize Orchestrator
  const orchestrator = new PaintingGenerationOrchestrator({
    tokenSelectionService,
    marketDataService,
    paintingContextBuilder,
    marketSnapshotsRepository,
    tokensRepository,
    paintingsService,
  });

  // Run Orchestrator
  // Mock Cloudflare Env
  const mockEnv = {
    AI: undefined, // Will trigger REST API fallback
    DB: undefined,
  } as unknown as Cloudflare.Env;

  console.log("\n=== Starting Generation Pipeline (Local Simulation) ===\n");

  const result = await orchestrator.execute(mockEnv);

  if (result.isErr()) {
    logger.error("gen-img.fatal", { error: result.error });
    console.error("\n❌ Fatal error:", result.error);
    safeExit(1);
  } else {
    const value = result.value;
    if (value.status === "skipped") {
      console.log("\n⚠️ Skipped: Generation already exists for this hour");
    } else {
      console.log("\n✅ Generation complete!");
      console.log(`Token: ${String(value.selectedToken?.name)} (${String(value.selectedToken?.symbol)})`);
      console.log(`Image URL: ${String(value.imageUrl)}`);
      console.log(`Local Path: ${join(outputDir, value.imageUrl?.split("/").pop() || "")}`);

      if (value.selectedToken?.logoUrl) {
        try {
          const logoUrl = value.selectedToken.logoUrl;
          console.log(`Fetching token logo from: ${logoUrl}`);
          const response = await fetch(logoUrl);
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const ext = logoUrl.split(".").pop()?.split("?")[0] || "png";
            const tokenFileName = `token_${value.selectedToken.symbol}_${String(Date.now())}.${ext}`;
            const tokenPath = join(outputDir, tokenFileName);

            await Bun.write(tokenPath, buffer);
            console.log(`Token Logo Saved: ${tokenPath}`);
          } else {
            console.warn(`Failed to download token logo: ${String(response.status)} ${response.statusText}`);
          }
        } catch (error: unknown) {
          console.warn("Failed to download token logo:", error);
        }
      }
    }
  }
};

main()
  .then(() => safeExit(0))
  .catch((error: unknown) => {
    console.error("\n❌ Unexpected error:", error);
    safeExit(1);
  });
