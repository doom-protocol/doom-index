#!/usr/bin/env bun

/**
 * Image Generation Script
 *
 * Usage:
 *   bun scripts/generate.ts --model "dall-e-3" --mc "CO2=1300000,ICE=200000,FOREST=900000,NUKE=50000,MACHINE=1450000,PANDEMIC=700000,FEAR=1100000,HOPE=400000"
 *   bun scripts/generate.ts --model "runware:100@1" --seed abc123def456 --w 1280 --h 720
 *   bun scripts/generate.ts --model "civitai:38784@44716" --output ./test-output
 *   bun scripts/generate.ts --model "dall-e-3" --w 1024 --h 1024
 */

import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import type { McMapRounded } from "@/constants/token";
import { createPromptService } from "@/services/prompt";
import { resolveProviderWithMock, createAutoResolveProvider } from "@/lib/providers";
import { logger } from "@/utils/logger";
import { createArchiveStorageService } from "@/services/archive-storage";
import { createTestR2Bucket } from "@/testing/memory-r2";
import { extractIdFromFilename } from "@/lib/pure/archive";
import type { ArchiveMetadata } from "@/types/archive";

type Args = {
  mock?: boolean;
  mc?: string;
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
      case "--mc":
        parsed.mc = next;
        i++;
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
  --mc <values>        Market cap values: "CO2=1000000,ICE=2000000,..." (default: all 1000000)
  --seed <string>      Custom seed (default: generated from MC)
  --model <name>       Model name: dall-e-3, runware:100@1, civitai:xxx@xxx, etc.
                       Provider will be automatically resolved based on the model
  --w, --width <num>   Image width (default: 1280)
  --h, --height <num>  Image height (default: 720)
  --format <fmt>       Output format: webp, png (default: webp)
  --output <path>      Output directory (default: ./scripts/.out)
  --help               Show this help

Examples:
  bun scripts/generate.ts --model "dall-e-3"
  bun scripts/generate.ts --model "runware:100@1"
  bun scripts/generate.ts --model "civitai:38784@44716"
  bun scripts/generate.ts --model "dall-e-3" --mc "CO2=1300000,ICE=200000,FOREST=900000,NUKE=50000,MACHINE=1450000,PANDEMIC=700000,FEAR=1100000,HOPE=400000"
  bun scripts/generate.ts --model "dall-e-3" --seed custom123 --w 1024 --h 1024
        `);
        safeExit(0);
    }
  }

  return parsed as Args;
};

const parseMcString = (mcString?: string): McMapRounded => {
  const defaultMc: McMapRounded = {
    CO2: 1_000_000,
    ICE: 1_000_000,
    FOREST: 1_000_000,
    NUKE: 1_000_000,
    MACHINE: 1_000_000,
    PANDEMIC: 1_000_000,
    FEAR: 1_000_000,
    HOPE: 1_000_000,
  };

  if (!mcString) return defaultMc;

  const pairs = mcString.split(",");
  for (const pair of pairs) {
    const [ticker, value] = pair.split("=");
    if (ticker && value && ticker in defaultMc) {
      defaultMc[ticker as keyof McMapRounded] = parseFloat(value);
    }
  }

  return defaultMc;
};

const main = async () => {
  const args = parseArgs();

  logger.info("generate.start", {
    model: args.model,
    mock: args.mock,
    width: args.width,
    height: args.height,
    format: args.format,
  });

  // Parse MC values
  const mcRounded = parseMcString(args.mc);
  logger.info("generate.mc", mcRounded);

  // Compose prompt
  const promptService = createPromptService();
  const promptResult = await promptService.composePrompt(mcRounded);

  if (promptResult.isErr()) {
    logger.error("generate.prompt.error", promptResult.error);
    safeExit(1);
    return;
  }

  const composition = promptResult.value;
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

  // Generate image
  // Provider is automatically resolved based on the model
  const provider = args.mock ? resolveProviderWithMock("mock") : createAutoResolveProvider();
  logger.info("generate.provider", { name: provider.name, model: args.model });

  const imageRequest = {
    prompt: composition.prompt.text,
    negative: composition.prompt.negative,
    width: args.width,
    height: args.height,
    format: args.format,
    seed: args.seed || composition.seed,
    model: args.model,
  };

  console.log("\n=== Generating Image ===");
  console.log(`Provider: ${provider.name}`);
  console.log(`Dimensions: ${args.width}x${args.height}`);
  console.log(`Format: ${args.format}`);
  console.log("Please wait...\n");

  const generateResult = await provider.generate(imageRequest);

  if (generateResult.isErr()) {
    logger.error("generate.error", generateResult.error);
    console.error("\n❌ Generation failed:", generateResult.error);
    safeExit(1);
    return;
  }

  const imageResponse = generateResult.value;
  logger.info("generate.success", {
    size: imageResponse.imageBuffer.byteLength,
    provider: imageResponse.providerMeta,
  });

  // Create output directory with timestamp and hash
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const folderName = `DOOM_${timestamp}_${composition.paramsHash}_${composition.seed.slice(0, 8)}`;
  const outputFolder = join(args.output, folderName);

  await mkdir(outputFolder, { recursive: true });

  // Use archive storage service (same method as archive)
  // In script environment, use memory R2 client
  const { bucket } = createTestR2Bucket();
  const archiveStorageService = createArchiveStorageService({ r2Bucket: bucket });

  // Build archive metadata (same structure as archive)
  const metadataId = extractIdFromFilename(composition.prompt.filename);
  const minuteBucketIso = `${composition.minuteBucket}:00Z`;
  const archiveMetadata: ArchiveMetadata = {
    id: metadataId,
    timestamp: minuteBucketIso,
    minuteBucket: minuteBucketIso,
    paramsHash: composition.paramsHash,
    seed: composition.seed,
    mcRounded,
    visualParams: composition.vp,
    imageUrl: "", // Will be set by archiveStorageService
    fileSize: imageResponse.imageBuffer.byteLength,
    prompt: composition.prompt.text,
    negative: composition.prompt.negative,
  };

  // Store image and metadata using archive storage service
  const archiveResult = await archiveStorageService.storeImageWithMetadata(
    composition.minuteBucket,
    composition.prompt.filename,
    imageResponse.imageBuffer,
    archiveMetadata,
  );

  if (archiveResult.isErr()) {
    logger.error("generate.archive.error", archiveResult.error);
    console.error("\n⚠️ Archive storage failed:", archiveResult.error.message);
    console.error("Continuing with local file save...");
  } else {
    logger.info("generate.archive.success", {
      imageUrl: archiveResult.value.imageUrl,
      metadataUrl: archiveResult.value.metadataUrl,
    });
  }

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
    provider: provider.name,
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

  if (archiveResult.isOk()) {
    console.log(`\n=== Archive Storage ===`);
    console.log(`Archive Image URL: ${archiveResult.value.imageUrl}`);
    console.log(`Archive Metadata URL: ${archiveResult.value.metadataUrl}`);
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
