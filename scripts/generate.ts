#!/usr/bin/env bun

/**
 * Image Generation Script (Manual Testing)
 *
 * This script is for manual testing and development purposes only.
 * It allows you to generate images with custom parameters.
 *
 * For production hourly painting generation with dynamic token selection,
 * see src/cron.ts and PaintingGenerationOrchestrator.
 *
 * Usage:
 *   bun scripts/generate.ts --model "dall-e-3"
 *   bun scripts/generate.ts --model "runware:100@1" --seed abc123def456 --w 1280 --h 720
 *   bun scripts/generate.ts --model "civitai:38784@44716" --output ./test-output
 *   bun scripts/generate.ts --model "dall-e-3" --w 1024 --h 1024
 */

import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { ok } from "neverthrow";
import { createWorldPromptService } from "@/services/world-prompt-service";
import { createImageGenerationService } from "@/services/image-generation";
import { createImageProvider } from "@/lib/image-generation-providers";
import { logger } from "@/utils/logger";
import { extractIdFromFilename } from "@/utils/paintings";
import type { PaintingMetadata } from "@/types/paintings";
import { TokenSelectionService } from "@/services/paintings/token-selection";
import { TokenDataFetchService } from "@/services/paintings/token-data-fetch";
import { MarketDataService } from "@/services/paintings/market-data";
import { PaintingContextBuilder } from "@/services/paintings/painting-context-builder";
import { CoinGeckoClient } from "@/lib/coingecko-client";
import { AlternativeMeClient } from "@/lib/alternative-me-client";
import { MarketSnapshotsRepository } from "@/repositories/market-snapshots-repository";
import { TokensRepository } from "@/repositories/tokens-repository";
import { createWorkersAiClient } from "@/lib/workers-ai-client";
import { createTokenContextService, FALLBACK_TOKEN_CONTEXT } from "@/services/token-context-service";
import { createTavilyClient } from "@/lib/tavily-client";
import { env } from "@/env";

type Args = {
  mock?: boolean;
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
    mock: false,
    width: 1280,
    height: 720,
    format: "webp",
    output: "out",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "--mock":
        parsed.mock = true;
        break;
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
Usage: bun scripts/generate.ts [options]

Options:
  --mock               Use mock provider (for testing only)
  --seed <string>      Custom seed (default: auto-generated)
  --model <name>       Model name: dall-e-3, runware:100@1, civitai:xxx@xxx, etc.
                       Provider will be automatically resolved based on the model
  --w, --width <num>   Image width (default: 1280)
  --h, --height <num>  Image height (default: 720)
  --format <fmt>       Output format: webp, png (default: webp)
  --output <path>      Output directory (default: ./out)
  --help               Show this help

Examples:
  bun scripts/generate.ts --model "dall-e-3"
  bun scripts/generate.ts --model "runware:100@1"
  bun scripts/generate.ts --model "civitai:38784@44716"
  bun scripts/generate.ts --model "dall-e-3" --seed custom123 --w 1024 --h 1024
        `);
        safeExit(0);
    }
  }

  return parsed as Args;
};

/**
 * Create mock repositories for script testing
 * These return empty results since we don't need database persistence in scripts
 */
const createMockTokensRepository = (): TokensRepository => {
  return {
    findById: async () => ok(null),
    insert: async () => ok(undefined),
    update: async () => ok(undefined),
    findRecentlySelected: async () => ok([]),
  } as unknown as TokensRepository;
};

const createMockMarketSnapshotsRepository = (): MarketSnapshotsRepository => {
  return {
    findByHourBucket: async () => ok(null),
    upsert: async () => ok(undefined),
  } as unknown as MarketSnapshotsRepository;
};

const main = async () => {
  const args = parseArgs();

  logger.info("generate.start", {
    model: args.model,
    width: args.width,
    height: args.height,
    format: args.format,
  });

  // Validate required environment variables
  if (!env.COINGECKO_API_KEY) {
    console.error("\n❌ Error: COINGECKO_API_KEY environment variable is required");
    console.error("   Please set it in your .env file or environment");
    safeExit(1);
    return;
  }

  if (!env.TAVILY_API_KEY) {
    console.warn("\n⚠️ Warning: TAVILY_API_KEY not set. Token context generation may fail.");
  }

  // Initialize actual API clients
  const coinGeckoClient = new CoinGeckoClient(env.COINGECKO_API_KEY);
  const alternativeMeClient = new AlternativeMeClient();

  // Create mock repositories (no database needed for script)
  const tokensRepository = createMockTokensRepository();
  const marketSnapshotsRepository = createMockMarketSnapshotsRepository();

  // Initialize services with actual data fetching
  const tokenDataFetchService = new TokenDataFetchService(coinGeckoClient);
  const marketDataService = new MarketDataService(
    coinGeckoClient,
    alternativeMeClient,
    marketSnapshotsRepository,
  );
  const tokenSelectionService = new TokenSelectionService(
    tokenDataFetchService,
    marketDataService,
    tokensRepository,
  );
  const paintingContextBuilder = new PaintingContextBuilder(tokensRepository);

  console.log("\n=== Step 1: Selecting Token ===");
  console.log("Fetching trending tokens from CoinGecko...");

  // Step 1: Select token (same as production)
  const forceTokenList = env.FORCE_TOKEN_LIST;
  const tokenSelectionResult = await tokenSelectionService.selectToken({
    forceTokenList,
    excludeRecentlySelected: false, // Don't exclude in script mode
    recentSelectionWindowHours: 24,
  });

  if (tokenSelectionResult.isErr()) {
    logger.error("generate.token-selection.error", tokenSelectionResult.error);
    console.error("\n❌ Token selection failed:", tokenSelectionResult.error);
    safeExit(1);
    return;
  }

  const selectedToken = tokenSelectionResult.value;
  console.log(`✅ Selected token: ${selectedToken.name} (${selectedToken.symbol})`);
  console.log(`   ID: ${selectedToken.id}`);
  console.log(`   Price: $${selectedToken.priceUsd.toFixed(4)}`);
  console.log(`   24h Change: ${selectedToken.priceChange24h.toFixed(2)}%`);

  console.log("\n=== Step 2: Fetching Market Data ===");
  console.log("Fetching global market data from CoinGecko...");

  // Step 2: Fetch market data (same as production)
  const marketDataResult = await marketDataService.fetchGlobalMarketData();
  if (marketDataResult.isErr()) {
    logger.error("generate.market-data.error", marketDataResult.error);
    console.error("\n❌ Market data fetch failed:", marketDataResult.error);
    safeExit(1);
    return;
  }

  const marketSnapshot = marketDataResult.value;
  console.log(`✅ Market data fetched`);
  console.log(`   Total Market Cap: $${marketSnapshot.totalMarketCapUsd.toLocaleString()}`);
  console.log(`   24h Change: ${marketSnapshot.marketCapChangePercentage24hUsd.toFixed(2)}%`);
  console.log(`   Fear & Greed Index: ${marketSnapshot.fearGreedIndex ?? "N/A"}`);

  console.log("\n=== Step 3: Building Painting Context ===");

  // Step 3: Build painting context (same as production)
  const contextResult = await paintingContextBuilder.buildContext({
    selectedToken,
    marketSnapshot,
  });

  if (contextResult.isErr()) {
    logger.error("generate.context.error", contextResult.error);
    console.error("\n❌ Context building failed:", contextResult.error);
    safeExit(1);
    return;
  }

  const paintingContext = contextResult.value;
  console.log(`✅ Painting context built`);
  console.log(`   Climate: ${paintingContext.c}`);
  console.log(`   Archetype: ${paintingContext.a}`);
  console.log(`   Composition: ${paintingContext.o}`);
  console.log(`   Palette: ${paintingContext.p}`);

  // Step 4: Initialize token context service (optional, requires Workers AI and Tavily)
  // Note: Workers AI requires Cloudflare environment, so we'll use fallback context for scripts
  let tokenContext;
  let tokenContextService;
  let workersAiClient;

  if (env.TAVILY_API_KEY) {
    try {
      const tavilyClient = createTavilyClient();
      // Note: Workers AI requires Cloudflare environment, so we'll use a mock for script
      // In production, this would use cloudflareEnv.AI
      workersAiClient = createWorkersAiClient({
        aiBinding: {} as Ai, // Mock AI binding for script
      });
      tokenContextService = createTokenContextService({
        tavilyClient,
        workersAiClient,
        tokensRepository,
      });

      console.log("\n=== Step 4: Generating Token Context ===");
      console.log("Fetching token context from Tavily and Workers AI...");

      const tokenMeta = {
        id: selectedToken.id,
        name: selectedToken.name,
        symbol: selectedToken.symbol,
        chainId: "unknown",
        contractAddress: null,
        createdAt: new Date().toISOString(),
      };

      const tokenContextResult = await tokenContextService.generateTokenContext(tokenMeta);
      if (tokenContextResult.isOk()) {
        tokenContext = tokenContextResult.value;
        console.log(`✅ Token context generated`);
        console.log(`   Category: ${tokenContext.category}`);
        console.log(`   Tags: ${tokenContext.tags.join(", ")}`);
      } else {
        console.warn(`⚠️ Token context generation failed, using fallback`);
        console.warn(`   Error: ${tokenContextResult.error.message}`);
        tokenContext = FALLBACK_TOKEN_CONTEXT;
      }
    } catch (error) {
      console.warn(`⚠️ Token context service initialization failed, using fallback`);
      console.warn(`   Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      tokenContext = FALLBACK_TOKEN_CONTEXT;
    }
  } else {
    console.warn("\n⚠️ Warning: TAVILY_API_KEY not set. Using fallback token context.");
    tokenContext = FALLBACK_TOKEN_CONTEXT;
  }

  // Step 5: Initialize prompt and image generation services
  const promptService = createWorldPromptService({
    tokenContextService,
    tokensRepository,
    workersAiClient,
  });
  const imageProvider = createImageProvider();
  const imageGenerationService = createImageGenerationService({
    promptService,
    imageProvider,
    log: logger,
  });

  logger.info("generate.provider", { name: imageProvider.name, model: args.model });

  const tokenMeta = {
    id: selectedToken.id,
    name: selectedToken.name,
    symbol: selectedToken.symbol,
    chainId: "unknown",
    contractAddress: null,
    createdAt: new Date().toISOString(),
  };

  console.log("\n=== Step 5: Generating Image ===");
  console.log(`Provider: ${imageProvider.name}`);
  console.log(`Dimensions: ${args.width}x${args.height}`);
  console.log(`Format: ${args.format}`);
  console.log("Please wait...\n");

  // Step 6: Generate image using latest token-based generation process
  const generateResult = await imageGenerationService.generateTokenImage({
    paintingContext,
    tokenMeta,
    tokenContext, // Provide token context directly to avoid service dependency
    referenceImageUrl: selectedToken.logoUrl,
  });

  if (generateResult.isErr()) {
    logger.error("generate.error", generateResult.error);
    console.error("\n❌ Generation failed:", generateResult.error);
    safeExit(1);
    return;
  }

  const { composition, imageBuffer, providerMeta } = generateResult.value;
  logger.info("generate.success", {
    size: imageBuffer.byteLength,
    provider: providerMeta,
  });

  logger.info("generate.prompt", {
    seed: composition.seed,
    paramsHash: composition.paramsHash,
    promptLength: composition.prompt.text.length,
  });

  console.log("\n=== Prompt ===");
  console.log(composition.prompt.text);
  console.log("\n=== Negative ===");
  console.log(composition.prompt.negative);
  console.log("\n=== Visual Parameters ===");
  console.log(JSON.stringify(composition.vp, null, 2));
  console.log("\n=== Metadata ===");
  console.log(`Seed: ${composition.seed}`);
  console.log(`Params Hash: ${composition.paramsHash}`);

  const imageResponse = {
    imageBuffer,
    providerMeta,
  };
  logger.info("generate.success", {
    size: imageResponse.imageBuffer.byteLength,
    provider: imageResponse.providerMeta,
  });

  // Create output directory with timestamp and hash
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const folderName = `DOOM_${timestamp}_${composition.paramsHash}_${composition.seed.slice(0, 8)}`;
  const outputFolder = join(args.output, folderName);

  await mkdir(outputFolder, { recursive: true });

  // Build archive metadata (same structure as archive)
  const metadataId = extractIdFromFilename(composition.prompt.filename);
  const minuteBucketIso = `${composition.minuteBucket}:00Z`;
  const archiveMetadata: PaintingMetadata = {
    id: metadataId,
    timestamp: minuteBucketIso,
    minuteBucket: minuteBucketIso,
    paramsHash: composition.paramsHash,
    seed: composition.seed,
    visualParams: composition.vp,
    imageUrl: "", // Not used in script mode
    fileSize: imageResponse.imageBuffer.byteLength,
    prompt: composition.prompt.text,
    negative: composition.prompt.negative,
  };

  // Save image locally (as binary)
  const imageFilename = `image.${args.format}`;
  const imagePath = join(outputFolder, imageFilename);

  // Ensure we have a proper ArrayBuffer slice (handle byteOffset/byteLength if needed)
  // This matches the approach used in ai-sdk provider
  let imageBufferToWrite: ArrayBuffer;
  if (imageResponse.imageBuffer instanceof ArrayBuffer) {
    imageBufferToWrite = imageResponse.imageBuffer;
  } else {
    // Fallback: create a new ArrayBuffer from the data
    const uint8Array = new Uint8Array(imageResponse.imageBuffer);
    imageBufferToWrite = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength);
  }

  // Convert to Uint8Array for reliable binary write
  const imageBytes = new Uint8Array(imageBufferToWrite);
  await Bun.write(imagePath, imageBytes);

  // Save metadata locally (with additional script-specific fields)
  const metadataPath = join(outputFolder, "params.json");
  const localMetadata = {
    ...archiveMetadata,
    timestamp: timestamp,
    provider: imageProvider.name,
    dimensions: { width: args.width, height: args.height },
    format: args.format,
    providerMeta: imageResponse.providerMeta,
  };

  await Bun.write(metadataPath, JSON.stringify(localMetadata, null, 2));

  // Verify image file was written correctly
  const imageFile = Bun.file(imagePath);
  const imageFileExists = await imageFile.exists();
  let imageFileSize = 0;
  let imageFileType = "unknown";
  let imageFileBuffer: ArrayBuffer | null = null;

  if (imageFileExists) {
    imageFileBuffer = await imageFile.arrayBuffer();
    imageFileSize = imageFileBuffer.byteLength;
    imageFileType = imageFile.type || "unknown";
  }

  // Verify image file header (for webp: should start with "RIFF" and contain "WEBP")
  let isValidImage = false;
  if (imageFileBuffer && imageFileSize > 0) {
    const header = new Uint8Array(imageFileBuffer.slice(0, Math.min(12, imageFileSize)));
    const headerText = Array.from(header.slice(0, 4))
      .map(b => String.fromCharCode(b))
      .join("");
    const hasWebpMarker = Array.from(header.slice(8, 12))
      .map(b => String.fromCharCode(b))
      .join("")
      .includes("WEBP");
    isValidImage = headerText === "RIFF" && hasWebpMarker;
  }

  console.log("\n✅ Generation complete!");
  console.log(`Folder: ${outputFolder}`);
  console.log(`Image: ${imagePath}`);
  console.log(`Metadata: ${metadataPath}`);
  console.log(`Size: ${(imageResponse.imageBuffer.byteLength / 1024).toFixed(2)} KB`);
  console.log(`\n=== File Verification ===`);
  console.log(`Image file exists: ${imageFileExists}`);
  console.log(`Image file size: ${(imageFileSize / 1024).toFixed(2)} KB`);
  console.log(`Image file type: ${imageFileType}`);
  console.log(`Buffer size matches file size: ${imageResponse.imageBuffer.byteLength === imageFileSize}`);
  if (imageFileSize > 0) {
    console.log(`Image file header valid: ${isValidImage ? "✅" : "❌"}`);
    if (!isValidImage) {
      const headerPreview = imageFileBuffer
        ? Array.from(new Uint8Array(imageFileBuffer.slice(0, Math.min(20, imageFileSize))))
            .map(b => b.toString(16).padStart(2, "0"))
            .join(" ")
        : "N/A";
      console.log(`File header (hex): ${headerPreview}`);
    }
  }

  // Warn if image buffer is empty (mock provider)
  if (imageResponse.imageBuffer.byteLength === 0) {
    console.log(`\n⚠️ Warning: Image buffer is empty (likely using mock provider)`);
    console.log(`   To generate actual images, use a real provider like --model "dall-e-3"`);
  }
};

main()
  .then(() => {
    safeExit(0);
  })
  .catch(error => {
    logger.error("generate.fatal", { error: error.message });
    console.error("\n❌ Fatal error:", error);
    safeExit(1);
  });
