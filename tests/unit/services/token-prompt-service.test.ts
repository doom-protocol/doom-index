import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { ok, err } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { createWorldPromptService } from "@/services/world-prompt-service";
import type { TokenContextService, TokenContext, TokenMetaInput } from "@/services/token-context-service";
import type { WorkersAiClient } from "@/lib/workers-ai-client";
import type { PaintingContext } from "@/types/painting-context";
import type { McMapRounded } from "@/constants/token";

describe("WorldPromptService (token mode)", () => {
  let mockTokenContextService: TokenContextService;
  let mockWorkersAiClient: WorkersAiClient;

  const mockPaintingContext: PaintingContext = {
    t: { n: "Test Token", c: "ethereum" },
    m: { mc: 1_000_000, bd: 450_000, fg: 120_000 },
    s: { p: 1.0, p7: 0.85, v: 900_000, mc: 1_200_000, vol: 300_000 },
    c: "bullish",
    a: "meme",
    e: { k: "pump", i: "high" },
    o: "portrait",
    p: "vibrant",
    d: { dir: "up", vol: "high" },
    f: ["pump-fun", "viral"],
    h: ["community-driven"],
  };

  const mockMcRounded: McMapRounded = {
    CO2: 1_000_000,
    ICE: 900_000,
    FOREST: 850_000,
    NUKE: 400_000,
    MACHINE: 600_000,
    PANDEMIC: 350_000,
    FEAR: 250_000,
    HOPE: 300_000,
  };

  const mockTokenContext: TokenContext = {
    shortContext: "A test token designed for experimental blockchain art applications.",
    category: "meme",
    tags: ["testing", "experimental"],
  };

  const tokenMeta: TokenMetaInput = {
    id: "test-token",
    name: "Test Token",
    symbol: "TEST",
    chainId: "ethereum",
    contractAddress: null,
    createdAt: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    mockTokenContextService = {
      generateTokenContext: mock(() => Promise.resolve(ok(mockTokenContext))) as unknown as TokenContextService["generateTokenContext"],
    };

    mockWorkersAiClient = {
      generateText: mock(() =>
        Promise.resolve(
          ok({
            modelId: "@cf/ibm-granite/granite-4.0-h-micro",
            text: "A vivid FLUX prompt describing the Test Token as radiant figures channeling viral energy across a golden landscape.",
          }),
        ),
      ) as unknown as WorkersAiClient["generateText"],
      generateJson: mock(() => Promise.resolve(err({ type: "ExternalApiError", provider: "WorkersAI", message: "unused" }))) as unknown as WorkersAiClient["generateJson"],
    };
  });

  afterEach(() => {
    mock.restore();
  });

  const createService = () =>
    createWorldPromptService({
      tokenContextService: mockTokenContextService,
      workersAiClient: mockWorkersAiClient,
      getMinuteBucket: () => "2025-11-21T10:00",
    });

  it("generates a FLUX-ready prompt composition with controls appended", async () => {
    const service = createService();

    const result = await service.composeTokenPrompt({
      mcRounded: mockMcRounded,
      paintingContext: mockPaintingContext,
      tokenMeta,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const composition = result.value;
      expect(composition.prompt.text).toContain("controls: paramsHash=");
      expect(composition.prompt.negative).toBeTruthy();
      expect(composition.prompt.size).toEqual({ w: 1024, h: 1024 });
      expect(composition.paramsHash).toMatch(/^[a-f0-9]{8}$/);
    }

    expect(mockWorkersAiClient.generateText).toHaveBeenCalled();
  });

  it("propagates Workers AI errors", async () => {
    const aiError: AppError = {
      type: "ExternalApiError",
      provider: "WorkersAI",
      message: "generation failed",
    };

    mockWorkersAiClient.generateText = mock(() => Promise.resolve(err(aiError))) as unknown as WorkersAiClient["generateText"];

    const service = createService();
    const result = await service.composeTokenPrompt({
      mcRounded: mockMcRounded,
      paintingContext: mockPaintingContext,
      tokenMeta,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toEqual(aiError);
    }
  });

  it("returns error when token context resolution fails", async () => {
    const contextError: AppError = {
      type: "ExternalApiError",
      provider: "Tavily",
      message: "context fetch failed",
    };

    mockTokenContextService.generateTokenContext = mock(() => Promise.resolve(err(contextError))) as unknown as TokenContextService["generateTokenContext"];

    const service = createService();
    const result = await service.composeTokenPrompt({
      mcRounded: mockMcRounded,
      paintingContext: mockPaintingContext,
      tokenMeta,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toEqual(contextError);
    }

    expect(mockWorkersAiClient.generateText).not.toHaveBeenCalled();
  });
});
