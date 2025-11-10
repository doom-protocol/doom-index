#!/usr/bin/env bun

/**
 * Image Generation Script
 *
 * Usage:
 *   bun scripts/generate.ts --provider smart --mc "CO2=1300000,ICE=200000,FOREST=900000,NUKE=50000,MACHINE=1450000,PANDEMIC=700000,FEAR=1100000,HOPE=400000"
 *   bun scripts/generate.ts --provider runware-sdk --seed abc123def456 --w 1280 --h 720
 *   bun scripts/generate.ts --provider mock --output ./test-output
 *   bun scripts/generate.ts --provider smart --model "dall-e-3" --w 1024 --h 1024
 */

import { join } from "path";
import type { McMapRounded } from "@/constants/token";
import { createPromptService } from "@/services/prompt";
import { resolveProviderWithMock, type ProviderNameWithMock } from "@/lib/providers";
import { logger } from "@/utils/logger";

type Args = {
  provider: ProviderNameWithMock;
  mc?: string;
  seed?: string;
  model?: string;
  width: number;
  height: number;
  format: "webp" | "png";
  output: string;
};

const parseArgs = (): Args => {
  const args = process.argv.slice(2);
  const parsed: Partial<Args> = {
    provider: "smart",
    width: 1280,
    height: 720,
    format: "webp",
    output: "out",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "--provider":
        parsed.provider = next as ProviderNameWithMock;
        i++;
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
  --provider <name>    Provider name: smart, ai-sdk, runware-sdk, mock (default: smart)
  --mc <values>        Market cap values: "CO2=1000000,ICE=2000000,..." (default: all 1000000)
  --seed <string>      Custom seed (default: generated from MC)
  --model <name>       Model name: dall-e-3, runware:100@1, civitai:xxx@xxx, etc.
  --w, --width <num>   Image width (default: 1280)
  --h, --height <num>  Image height (default: 720)
  --format <fmt>       Output format: webp, png (default: webp)
  --output <path>      Output directory (default: ./scripts/.out)
  --help               Show this help

Examples:
  bun scripts/generate.ts --provider smart
  bun scripts/generate.ts --provider smart --model "dall-e-3"
  bun scripts/generate.ts --provider runware-sdk --model "civitai:38784@44716"
  bun scripts/generate.ts --mc "CO2=1300000,ICE=200000,FOREST=900000,NUKE=50000,MACHINE=1450000,PANDEMIC=700000,FEAR=1100000,HOPE=400000"
  bun scripts/generate.ts --provider smart --seed custom123 --w 1024 --h 1024
        `);
        process.exit(0);
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
    provider: args.provider,
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
    process.exit(1);
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
  const provider = resolveProviderWithMock(args.provider);
  logger.info("generate.provider", { name: provider.name });

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
    process.exit(1);
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

  await Bun.$`mkdir -p ${outputFolder}`;

  // Save image
  const imageFilename = `image.${args.format}`;
  const imagePath = join(outputFolder, imageFilename);
  await Bun.write(imagePath, imageResponse.imageBuffer);

  // Save metadata
  const metadataPath = join(outputFolder, "params.json");
  const metadata = {
    timestamp,
    provider: provider.name,
    seed: composition.seed,
    paramsHash: composition.paramsHash,
    mcRounded,
    visualParams: composition.vp,
    prompt: composition.prompt.text,
    negative: composition.prompt.negative,
    dimensions: { width: args.width, height: args.height },
    format: args.format,
    providerMeta: imageResponse.providerMeta,
    fileSize: imageResponse.imageBuffer.byteLength,
  };

  await Bun.write(metadataPath, JSON.stringify(metadata, null, 2));

  console.log("\n✅ Generation complete!");
  console.log(`Folder: ${outputFolder}`);
  console.log(`Image: ${imagePath}`);
  console.log(`Metadata: ${metadataPath}`);
  console.log(`Size: ${(imageResponse.imageBuffer.byteLength / 1024).toFixed(2)} KB`);
};

main().catch(error => {
  logger.error("generate.fatal", { error: error.message });
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
