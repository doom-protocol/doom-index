import { describe, it, expect, mock } from "bun:test";
import { ok, err } from "neverthrow";
import { createGenerationService } from "@/services/generation";
import { hashRoundedMap } from "@/lib/pure/hash";
import { roundMc4 } from "@/lib/round";
import { TOKEN_TICKERS, MARKET_CAP_ROUND_MULTIPLIER, type McMap, type McMapRounded } from "@/constants/token";
import type { PromptComposition } from "@/services/prompt";
import type { AppError } from "@/types/app-error";
import type { RevenueReport, TradeSnapshot } from "@/types/domain";
import { LogLevel } from "@/utils/logger";

const makeMap = (base: number): McMap =>
  TOKEN_TICKERS.reduce((acc, ticker, idx) => {
    acc[ticker] = Math.round((base + idx * 10.5) * MARKET_CAP_ROUND_MULTIPLIER) / MARKET_CAP_ROUND_MULTIPLIER;
    return acc;
  }, {} as McMap);

const toRounded = (map: McMap): McMapRounded => roundMc4(map);

const createPromptComposition = (): PromptComposition => ({
  seed: "abcdef123456",
  minuteBucket: "2025-11-09T12:34",
  vp: {
    fogDensity: 0.5,
    skyTint: 0.6,
    reflectivity: 0.4,
    blueBalance: 0.7,
    vegetationDensity: 0.8,
    organicPattern: 0.3,
    radiationGlow: 0.2,
    debrisIntensity: 0.1,
    mechanicalPattern: 0.5,
    metallicRatio: 0.6,
    fractalDensity: 0.4,
    bioluminescence: 0.7,
    shadowDepth: 0.8,
    redHighlight: 0.3,
    lightIntensity: 0.9,
    warmHue: 0.4,
  },
  prompt: {
    text: "composed prompt",
    negative: "negative prompt",
    size: { w: 1024, h: 1024 },
    format: "webp",
    seed: "abcdef123456",
    filename: "DOOM_202511091234_abcd1234_abcdef123456.webp",
  },
  paramsHash: "abcd1234",
});

const createRevenueReport = (): RevenueReport => ({
  perTokenFee: TOKEN_TICKERS.reduce(
    (acc, ticker) => {
      acc[ticker] = 1;
      return acc;
    },
    {} as Record<(typeof TOKEN_TICKERS)[number], number>,
  ),
  totalFee: 8,
  monthlyCost: 100,
  netProfit: -92,
});

describe("GenerationService orchestration (4.x)", () => {
  it("skips when the rounded hash matches the stored prevHash", async () => {
    const rawMap = makeMap(100);
    const rounded = toRounded(rawMap);
    const expectedHash = await hashRoundedMap(rounded);

    const marketCapService = {
      getMcMap: mock(async () => ok(rawMap)),
    };
    const promptService = { composePrompt: mock(async () => ok(createPromptComposition())) };
    const imageProvider = {
      name: "runware" as const,
      generate: mock(async () => {
        throw new Error("should not be called");
      }),
    };
    const stateService = {
      readGlobalState: mock(async () =>
        ok({ prevHash: expectedHash, lastTs: "2025-11-09T12:33:00Z", imageUrl: "https://existing" }),
      ),
      writeGlobalState: mock(async () => ok(undefined)),
      readTokenState: mock(async () => ok(null)),
      writeTokenStates: mock(async () => ok(undefined)),
      storeImage: mock(async () => ok("https://new-image")),
      writeRevenue: mock(async () => ok(undefined)),
      readRevenue: mock(async () => ok(null)),
    };
    const revenueEngine = {
      calculateMinuteRevenue: mock(() => ok(createRevenueReport())),
    };
    const tradeFetcher = mock(async () => [] as TradeSnapshot[]);
    const logger = {
      log: mock(() => undefined),
      debug: mock(() => undefined),
      info: mock(() => undefined),
      warn: mock(() => undefined),
      error: mock(() => undefined),
      getCurrentLevel: mock(() => LogLevel.INFO),
      getLevels: mock(() => []),
    };

    const service = createGenerationService({
      marketCapService,
      promptService,
      imageProvider,
      stateService,
      revenueEngine,
      fetchTradeSnapshots: tradeFetcher,
      log: logger,
    });

    const result = await service.evaluateMinute();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.status).toBe("skipped");
      expect(result.value.hash).toBe(expectedHash);
      expect(result.value.roundedMap).toEqual(rounded);
      expect(result.value.imageUrl).toBeUndefined();
    }
    expect(promptService.composePrompt.mock.calls.length).toBe(0);
    expect(imageProvider.generate.mock.calls.length).toBe(0);
    expect(stateService.writeGlobalState.mock.calls.length).toBe(0);
    expect(logger.info.mock.calls.length).toBeGreaterThan(0);
  });

  it("executes the generation pipeline when the hash changes", async () => {
    const rawMap = makeMap(200);
    const rounded = toRounded(rawMap);
    const promptComposition = createPromptComposition();
    const expectedHash = await hashRoundedMap(rounded);
    const imageBuffer = new ArrayBuffer(8);

    const marketCapService = {
      getMcMap: mock(async () => ok(rawMap)),
    };
    const promptService = { composePrompt: mock(async () => ok(promptComposition)) };
    const imageProvider = {
      name: "runware" as const,
      generate: mock(async () => ok({ imageBuffer, providerMeta: { stub: true } })),
    };
    const stateService = {
      readGlobalState: mock(async () =>
        ok({ prevHash: "old-hash", lastTs: "2025-11-09T12:33:00Z", imageUrl: "https://old" }),
      ),
      writeGlobalState: mock(async () => ok(undefined)),
      readTokenState: mock(async () => ok(null)),
      writeTokenStates: mock(async () => ok(undefined)),
      storeImage: mock(async () => ok("https://cdn/new-image.webp")),
      writeRevenue: mock(async () => ok(undefined)),
      readRevenue: mock(async () => ok(null)),
    };
    const revenueEngine = {
      calculateMinuteRevenue: mock(() => ok(createRevenueReport())),
    };
    const tradeSnapshots: TradeSnapshot[] = TOKEN_TICKERS.map(ticker => ({
      ticker,
      tradesPerMinute: 10,
      averageTradeUsd: 5,
    }));
    const tradeFetcher = mock(async () => tradeSnapshots);
    const logger = {
      log: mock(() => undefined),
      debug: mock(() => undefined),
      info: mock(() => undefined),
      warn: mock(() => undefined),
      error: mock(() => undefined),
      getCurrentLevel: mock(() => LogLevel.INFO),
      getLevels: mock(() => []),
    };

    const service = createGenerationService({
      marketCapService,
      promptService,
      imageProvider,
      stateService,
      revenueEngine,
      fetchTradeSnapshots: tradeFetcher,
      log: logger,
    });

    const result = await service.evaluateMinute();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.status).toBe("generated");
      expect(result.value.hash).toBe(expectedHash);
      expect(result.value.roundedMap).toEqual(rounded);
      expect(result.value.imageUrl).toBe("https://cdn/new-image.webp");
      expect(result.value.paramsHash).toBe(promptComposition.paramsHash);
      expect(result.value.seed).toBe(promptComposition.seed);
      expect(result.value.revenue?.totalFee).toBe(8);
    }

    expect(promptService.composePrompt.mock.calls.length).toBe(1);
    expect(imageProvider.generate.mock.calls.length).toBe(1);
    expect(stateService.storeImage.mock.calls.length).toBe(1);
    expect(stateService.writeGlobalState.mock.calls.length).toBe(1);
    expect(stateService.writeTokenStates.mock.calls.length).toBe(1);
    expect(stateService.writeRevenue.mock.calls.length).toBe(1);
    expect(revenueEngine.calculateMinuteRevenue.mock.calls.length).toBe(1);
  });

  it("propagates provider failures as Result.err", async () => {
    const rawMap = makeMap(300);
    const promptComposition = createPromptComposition();
    const providerError: AppError = {
      type: "ExternalApiError",
      provider: "ImageProvider",
      message: "generation failed",
    };

    const marketCapService = {
      getMcMap: mock(async () => ok(rawMap)),
    };
    const promptService = { composePrompt: mock(async () => ok(promptComposition)) };
    const imageProvider = {
      name: "runware" as const,
      generate: mock(async () => err(providerError)),
    };
    const stateService = {
      readGlobalState: mock(async () => ok({ prevHash: null, lastTs: null, imageUrl: null })),
      writeGlobalState: mock(async () => ok(undefined)),
      readTokenState: mock(async () => ok(null)),
      writeTokenStates: mock(async () => ok(undefined)),
      storeImage: mock(async () => ok("https://cdn/new-image.webp")),
      writeRevenue: mock(async () => ok(undefined)),
      readRevenue: mock(async () => ok(null)),
    };
    const revenueEngine = {
      calculateMinuteRevenue: mock(() => ok(createRevenueReport())),
    };
    const tradeFetcher = mock(async () => [] as TradeSnapshot[]);
    const logger = {
      log: mock(() => undefined),
      debug: mock(() => undefined),
      info: mock(() => undefined),
      warn: mock(() => undefined),
      error: mock(() => undefined),
      getCurrentLevel: mock(() => LogLevel.INFO),
      getLevels: mock(() => []),
    };

    const service = createGenerationService({
      marketCapService,
      promptService,
      imageProvider,
      stateService,
      revenueEngine,
      fetchTradeSnapshots: tradeFetcher,
      log: logger,
    });

    const result = await service.evaluateMinute();
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toEqual(providerError);
    }
    expect(stateService.storeImage.mock.calls.length).toBe(0);
    expect(stateService.writeGlobalState.mock.calls.length).toBe(0);
  });
});
