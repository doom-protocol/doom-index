import type { VisualParams } from "@/lib/pure/mapping";
import { createImageGenerationService } from "@/services/image-generation";
import type { TokenMetaInput } from "@/services/token-analysis-service";
import type { PromptComposition, WorldPromptService } from "@/services/world-prompt-service";
import type { AppError } from "@/types/app-error";
import type { ImageProvider, ImageRequest } from "@/types/domain";
import type { PaintingContext } from "@/types/painting-context";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { err, ok } from "neverthrow";

const paintingContext: PaintingContext = {
  t: { n: "Doom Token", c: "solana" },
  m: { mc: 1_000_000_000, bd: 450_000_000, fg: 65 },
  s: { p: 12.5, p7: 10.2, v: 50_000_000, mc: 800_000_000, vol: 0.55 },
  c: "cooling",
  a: "meme-ascendant",
  e: { k: "rally", i: 2 },
  o: "procession",
  p: "solar-gold",
  d: { dir: "up", vol: "medium" },
  f: ["idol", "crowd"],
  h: ["procession marches across neon-lit bridges"],
};

const visualParams: VisualParams = {
  fogDensity: 0.6,
  skyTint: 0.2,
  reflectivity: 0.45,
  blueBalance: 0.75,
  vegetationDensity: 0.35,
  organicPattern: 0.55,
  radiationGlow: 0.5,
  debrisIntensity: 0.4,
  mechanicalPattern: 0.3,
  metallicRatio: 0.65,
  fractalDensity: 0.5,
  bioluminescence: 0.4,
  shadowDepth: 0.3,
  redHighlight: 0.2,
  lightIntensity: 0.6,
  warmHue: 0.5,
};

const composition: PromptComposition = {
  seed: "abcdef012345",
  minuteBucket: "2025-11-21T10:00",
  vp: visualParams,
  prompt: {
    text: "A cinematic description of a meme procession under golden skies",
    negative: "blurry, watermark",
    size: { w: 1024, h: 1024 },
    format: "webp",
    seed: "abcdef012345",
    filename: "2025-11-21T10-00-00abcdef.webp",
  },
  paramsHash: "deadbeef",
};

const tokenMeta: TokenMetaInput = {
  id: "doom-token",
  name: "Doom Token",
  symbol: "DOOM",
  chainId: "solana",
  contractAddress: null,
  createdAt: "2025-11-21T10:00:00Z",
};

const createDeps = () => {
  const promptService: WorldPromptService = {
    composeTokenPrompt: mock(() =>
      Promise.resolve(ok(composition)),
    ) as unknown as WorldPromptService["composeTokenPrompt"],
  };

  const mockGenerate = mock(() =>
    Promise.resolve(
      ok({
        imageBuffer: new ArrayBuffer(8),
        providerMeta: { provider: "mock" },
      }),
    ),
  );

  const imageProvider: ImageProvider = {
    name: "mock",
    generate: mockGenerate as unknown as ImageProvider["generate"],
  };

  return { promptService, imageProvider, mockGenerate };
};

describe("ImageGenerationService.generateTokenImage", () => {
  beforeEach(() => {
    mock.restore();
  });

  it("passes sanitized reference image URLs to the provider", async () => {
    const { promptService, imageProvider, mockGenerate } = createDeps();
    const service = createImageGenerationService({
      promptService,
      imageProvider,
    });

    const result = await service.generateTokenImage({
      paintingContext,
      tokenMeta,
      referenceImageUrl: "http://assets.example.com/logo.png?size=large",
    });

    expect(result.isOk()).toBe(true);
    expect(mockGenerate.mock.calls.length).toBe(1);
    const calls = mockGenerate.mock.calls as unknown as Array<[ImageRequest, unknown?]>;
    const request = calls[0][0];
    expect(request).toBeDefined();
    expect(request?.referenceImageUrl).toBe("https://assets.example.com/logo.png?size=large");
  });

  it("drops unsafe reference URLs before calling the provider", async () => {
    const { promptService, imageProvider, mockGenerate } = createDeps();
    const service = createImageGenerationService({
      promptService,
      imageProvider,
    });

    const result = await service.generateTokenImage({
      paintingContext,
      tokenMeta,
      referenceImageUrl: "javascript:alert(1)",
    });

    expect(result.isOk()).toBe(true);
    const calls = mockGenerate.mock.calls as unknown as Array<[ImageRequest, unknown?]>;
    const request = calls[0][0];
    expect(request).toBeDefined();
    expect(request?.referenceImageUrl).toBeUndefined();
  });

  it("propagates prompt composition errors", async () => {
    const promptError: AppError = {
      type: "ExternalApiError",
      provider: "WorkersAI",
      message: "prompt failed",
    };

    const { promptService, imageProvider } = createDeps();
    promptService.composeTokenPrompt = mock(() =>
      Promise.resolve(err(promptError)),
    ) as unknown as WorldPromptService["composeTokenPrompt"];

    const service = createImageGenerationService({
      promptService,
      imageProvider,
    });

    const result = await service.generateTokenImage({
      paintingContext,
      tokenMeta,
      referenceImageUrl: "https://assets.example.com/logo.png",
    });

    expect(result.isErr()).toBe(true);
    expect(result.isErr() && result.error).toEqual(promptError);
    expect(imageProvider.generate).not.toHaveBeenCalled();
  });
});
