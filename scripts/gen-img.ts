#!/usr/bin/env bun

/**
 * Image Generation Script (Production Flow Simulation)
 *
 * This script executes the full painting generation pipeline using local resources:
 * - Local SQLite database (instead of D1)
 * - Cloudflare REST API (instead of Workers AI binding)
 * - Local file system (instead of R2)
 *
 * Usage:
 *   bun run --env-file=.dev.vars scripts/gen-img.ts
 */

import { setupLocalDb } from "@/db/helper";
import type * as schema from "@/db/schema";
import { paintings } from "@/db/schema/paintings";
import { env } from "@/env";
import { AlternativeMeClient } from "@/lib/alternative-me-client";
import { CoinGeckoClient } from "@/lib/coingecko-client";
import { createRunwareProvider } from "@/lib/image-generation-providers/runware";
import { createTavilyClient } from "@/lib/tavily-client";
import { createWorkersAiClient } from "@/lib/workers-ai-client";
import { MarketSnapshotsRepository } from "@/repositories/market-snapshots-repository";
import type { PaintingsRepository } from "@/repositories/paintings-repository";
import { TokensRepository } from "@/repositories/tokens-repository";
import { createImageGenerationService } from "@/services/image-generation";
import { createPaintingsService } from "@/services/paintings";
import { MarketDataService } from "@/services/paintings/market-data";
import { PaintingContextBuilder } from "@/services/paintings/painting-context-builder";
import { PaintingGenerationOrchestrator } from "@/services/paintings/painting-generation-orchestrator";
import { TokenDataFetchService } from "@/services/paintings/token-data-fetch";
import { TokenSelectionService } from "@/services/paintings/token-selection";
import { createTokenAnalysisService } from "@/services/token-analysis-service";
import { createWorldPromptService } from "@/services/world-prompt-service";
import type { PaintingMetadata } from "@/types/paintings";
import { logger } from "@/utils/logger";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { ok } from "neverthrow";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

type Args = {
  seed?: string;
  model?: string;
  width: number;
  height: number;
  format: "webp" | "png";
  output: string;
};

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
        parsed.width = parseInt(next, 10);
        i++;
        break;
      case "--h":
      case "--height":
        parsed.height = parseInt(next, 10);
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

// Mock R2 Bucket for local storage
const createLocalBucket = (outputDir: string): R2Bucket => {
  return {
    put: async (key: string, value: unknown) => {
      const filePath = join(outputDir, key);
      // Ensure directory exists
      const dir = filePath.split("/").slice(0, -1).join("/");
      await mkdir(dir, { recursive: true });

      let buffer: Uint8Array;
      if (value instanceof ArrayBuffer) {
        buffer = new Uint8Array(value);
      } else if (ArrayBuffer.isView(value)) {
        buffer = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      } else if (typeof value === "string") {
        buffer = new TextEncoder().encode(value);
      } else {
        // Fallback for other types (e.g. Blob which is not easily handled in sync context without await, but R2 put expects body)
        // Here we assume it's stringifiable
        buffer = new TextEncoder().encode(String(value));
      }

      await Bun.write(filePath, buffer);
      return null;
    },
    get: async () => null,
  } as unknown as R2Bucket;
};

// Create local paintings repository adapter
const createLocalPaintingsRepository = (db: BunSQLiteDatabase<typeof schema>): PaintingsRepository => {
  return {
    list: async () => ok({ items: [], hasMore: false }),
    insert: async (metadata: PaintingMetadata, r2Key: string) => {
      try {
        const ts = Math.floor(new Date(metadata.timestamp).getTime() / 1000);

        await db
          .insert(paintings)
          .values({
            id: metadata.id,
            ts,
            timestamp: metadata.timestamp,
            minuteBucket: metadata.minuteBucket,
            paramsHash: metadata.paramsHash,
            seed: metadata.seed,
            r2Key,
            imageUrl: metadata.imageUrl,
            fileSize: metadata.fileSize,
            visualParamsJson: JSON.stringify(metadata.visualParams),
            prompt: metadata.prompt,
            negative: metadata.negative,
          })
          .onConflictDoNothing();

        return ok(undefined);
      } catch (e) {
        console.error("Failed to insert painting locally:", e);
        return ok(undefined);
      }
    },
    findById: async () => ok(null),
  };
};

const main = async () => {
  const args = parseArgs();

  // Default model if not provided
  if (!args.model) {
    args.model = "runware:106@1";
  }

  logger.info("gen-img.start", {
    model: args.model,
    mode: "local-simulation",
    hasCoingeckoKey: !!env.COINGECKO_API_KEY,
    hasRunwareKey: !!env.RUNWARE_API_KEY,
    hasTavilyKey: !!env.TAVILY_API_KEY,
  });

  // Setup Local DB (reuse existing file if present)
  const dbPath = "local-test.db";
  const db = await setupLocalDb(dbPath);
  logger.info(`Using local DB: ${dbPath}`);

  // Output directory for "R2"
  const outputDir = join(args.output, "r2-storage");
  const bucket = createLocalBucket(outputDir);

  // Initialize Clients
  const workersAiClient = createWorkersAiClient(); // Uses REST API fallback via env
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

  const paintingsService = createPaintingsService({
    r2Bucket: bucket,
    archiveRepository: paintingsRepository,
  });

  // Initialize Orchestrator
  const orchestrator = new PaintingGenerationOrchestrator({
    tokenSelectionService,
    marketDataService,
    paintingContextBuilder,
    marketSnapshotsRepository,
    tokensRepository,
    paintingsService,
    r2Bucket: bucket,
  });

  // Run Orchestrator
  // Mock Cloudflare Env
  const mockEnv = {
    AI: undefined, // Will trigger REST API fallback
    DB: undefined,
    R2_BUCKET: bucket,
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
      console.log(`Token: ${value.selectedToken?.name} (${value.selectedToken?.symbol})`);
      console.log(`Image URL: ${value.imageUrl}`);
      console.log(`Local Path: ${join(outputDir, value.imageUrl?.split("/").pop() || "")}`);

      if (value.selectedToken?.logoUrl) {
        try {
          const logoUrl = value.selectedToken.logoUrl;
          console.log(`Fetching token logo from: ${logoUrl}`);
          const response = await fetch(logoUrl);
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const ext = logoUrl.split(".").pop()?.split("?")[0] || "png";
            const tokenFileName = `token_${value.selectedToken.symbol}_${Date.now()}.${ext}`;
            const tokenPath = join(outputDir, tokenFileName);

            await Bun.write(tokenPath, buffer);
            console.log(`Token Logo Saved: ${tokenPath}`);
          } else {
            console.warn(`Failed to download token logo: ${response.status} ${response.statusText}`);
          }
        } catch (error) {
          console.warn("Failed to download token logo:", error);
        }
      }
    }
  }
};

main()
  .then(() => safeExit(0))
  .catch(error => {
    console.error("\n❌ Unexpected error:", error);
    safeExit(1);
  });
