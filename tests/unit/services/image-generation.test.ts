import { describe, it, expect, beforeEach, mock } from "bun:test";
import { ok, err } from "neverthrow";
import { createImageGenerationService } from "@/services/image-generation";
import type { WorldPromptService, PromptComposition } from "@/services/world-prompt-service";
import type { ImageProvider } from "@/types/domain";
import type { PaintingContext } from "@/types/painting-context";
import type { McMapRounded } from "@/constants/token";
import type { TokenMetaInput } from "@/services/token-context-service";
import type { AppError } from "@/types/app-error";
import type { VisualParams } from "@/lib/pure/mapping";

const mcRounded: McMapRounded = {
  CO2: 500_000,
  ICE: 420_000,
  FOREST: 510_000,
  NUKE: 300_000,
  MACHINE: 480_000,
  PANDEMIC: 250_000,
  FEAR: 200_000,
  HOPE: 550_000,
};

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
  brilliance: 0.6,
  decay: 0.2,
  entropy: 0.45,
  flux: 0.75,
  gravity: 0.35,
  resonance: 0.55,
  saturation: 0.5,
  spread: 0.4,
  symmetry: 0.3,
  tempo: 0.65,
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
    composePrompt: mock(() => Promise.resolve(ok(composition))) as unknown as WorldPromptService["composePrompt"],
    composeTokenPrompt: mock(() =>
      Promise.resolve(ok(composition)),
    ) as unknown as WorldPromptService["composeTokenPrompt"],
  };

  const imageProvider: ImageProvider = {
    name: "mock",
    generate: mock(() =>
      Promise.resolve(
        ok({
          imageBuffer: new ArrayBuffer(8),
          providerMeta: { provider: "mock" },
        }),
      ),
    ) as unknown as ImageProvider["generate"],
  };

  return { promptService, imageProvider };
};

describe("ImageGenerationService.generateTokenImage", () => {
  beforeEach(() => {
    mock.restore();
  });

  it("passes sanitized reference image URLs to the provider", async () => {
    const { promptService, imageProvider } = createDeps();
    const service = createImageGenerationService({
      promptService,
      imageProvider,
    });

    const result = await service.generateTokenImage({
      mcRounded,
      paintingContext,
      tokenMeta,
      referenceImageUrl: "http://assets.example.com/logo.png?size=large",
    });

    expect(result.isOk()).toBe(true);
    expect(imageProvider.generate.mock.calls.length).toBe(1);
    const [request] = imageProvider.generate.mock.calls[0];
    expect(request.referenceImageUrl).toBe("https://assets.example.com/logo.png?size=large");
  });

  it("drops unsafe reference URLs before calling the provider", async () => {
    const { promptService, imageProvider } = createDeps();
    const service = createImageGenerationService({
      promptService,
      imageProvider,
    });

    const result = await service.generateTokenImage({
      mcRounded,
      paintingContext,
      tokenMeta,
      referenceImageUrl: "javascript:alert(1)",
    });

    expect(result.isOk()).toBe(true);
    const [request] = imageProvider.generate.mock.calls[0];
    expect(request.referenceImageUrl).toBeUndefined();
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
      mcRounded,
      paintingContext,
      tokenMeta,
      referenceImageUrl: "https://assets.example.com/logo.png",
    });

    expect(result.isErr()).toBe(true);
    expect(result.isErr() && result.error).toEqual(promptError);
    expect(imageProvider.generate).not.toHaveBeenCalled();
  });
});
