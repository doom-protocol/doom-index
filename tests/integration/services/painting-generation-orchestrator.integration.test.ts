/**
 * Painting Generation Orchestrator Integration Tests
 *
 * Tests the full flow of PaintingGenerationOrchestrator including:
 * - Normal flow (successful generation)
 * - Idempotency check (duplicate hourBucket)
 * - Error handling (API failures, D1 failures)
 */

import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ok, err } from "neverthrow";
import { PaintingGenerationOrchestrator } from "@/services/paintings/painting-generation-orchestrator";
import { TokenSelectionService } from "@/services/paintings/token-selection";
import { MarketDataService } from "@/services/paintings/market-data";
import { PaintingContextBuilder } from "@/services/paintings/painting-context-builder";
import { MarketSnapshotsRepository } from "@/repositories/market-snapshots-repository";
import { TokensRepository } from "@/repositories/tokens-repository";
import type { AppError } from "@/types/app-error";
import type { SelectedToken, MarketSnapshot } from "@/types/paintings";
import type { PaintingContext } from "@/types/painting-context";

// Mock env module
mock.module("@/env", () => ({
  env: { NODE_ENV: "development" },
}));

const mockSelectedToken: SelectedToken = {
  id: "bitcoin",
  symbol: "BTC",
  name: "Bitcoin",
  logoUrl: "https://example.com/btc.png",
  priceUsd: 50000,
  priceChange24h: 2.5,
  priceChange7d: 5.0,
  volume24hUsd: 1000000000,
  marketCapUsd: 1000000000000,
  categories: ["store-of-value"],
  source: "coingecko-trending-search",
  scores: {
    trend: 0.8,
    impact: 0.9,
    mood: 0.7,
    final: 0.8,
  },
};

const mockMarketSnapshot: MarketSnapshot = {
  totalMarketCapUsd: 2000000000000,
  totalVolumeUsd: 50000000000,
  marketCapChangePercentage24hUsd: 1.5,
  btcDominance: 50.0,
  ethDominance: 20.0,
  activeCryptocurrencies: 10000,
  markets: 500,
  fearGreedIndex: 65,
  updatedAt: Math.floor(Date.now() / 1000),
};

const mockPaintingContext: PaintingContext = {
  t: { n: "Bitcoin", c: "bitcoin" },
  m: { mc: 2000000000000, bd: 1000000000000, fg: 65 },
  s: { p: 50000, p7: 48000, v: 1000000000, mc: 1000000000000, vol: 0.5 },
  c: "cooling",
  a: "l1-sovereign",
  e: { k: "rally", i: 2 },
  o: "cosmic-horizon",
  p: "ivory-marble",
  d: { dir: "up", vol: "medium" },
  f: ["temple", "pillar"],
  h: ["cosmic horizon stretches across the void"],
};

describe("PaintingGenerationOrchestrator Integration", () => {
  let mockTokenSelectionService: TokenSelectionService;
  let mockMarketDataService: MarketDataService;
  let mockPaintingContextBuilder: PaintingContextBuilder;
  let mockMarketSnapshotsRepository: MarketSnapshotsRepository;
  let mockTokensRepository: TokensRepository;
  let mockR2Bucket: R2Bucket;
  let mockD1Binding: D1Database;
  let mockCloudflareEnv: Cloudflare.Env;

  beforeEach(() => {
    mock.restore();

    // Mock R2Bucket
    mockR2Bucket = {
      put: mock(() =>
        Promise.resolve({
          key: "test-key",
          version: "1",
          httpEtag: "etag",
          checksums: {},
          uploaded: new Date(),
        }),
      ),
    } as unknown as R2Bucket;

    // Mock D1Database
    mockD1Binding = {} as D1Database;

    // Mock Cloudflare Env
    mockCloudflareEnv = {
      R2_BUCKET: mockR2Bucket,
      DB: mockD1Binding,
      AI: {} as Ai,
    } as Cloudflare.Env;

    // Mock MarketSnapshotsRepository
    mockMarketSnapshotsRepository = {
      findByHourBucket: mock(() => Promise.resolve(ok(null))),
      upsert: mock(() => Promise.resolve(ok(undefined))),
    } as unknown as MarketSnapshotsRepository;

    // Mock TokensRepository
    mockTokensRepository = {
      findById: mock(() => Promise.resolve(ok(null))),
      insert: mock(() => Promise.resolve(ok(undefined))),
      update: mock(() => Promise.resolve(ok(undefined))),
      findRecentlySelected: mock(() => Promise.resolve(ok([]))),
    } as unknown as TokensRepository;

    // Mock TokenSelectionService
    mockTokenSelectionService = {
      selectToken: mock(() => Promise.resolve(ok(mockSelectedToken))),
    } as unknown as TokenSelectionService;

    // Mock MarketDataService
    mockMarketDataService = {
      fetchGlobalMarketData: mock(() => Promise.resolve(ok(mockMarketSnapshot))),
      storeMarketSnapshot: mock(() => Promise.resolve(ok(undefined))),
    } as unknown as MarketDataService;

    // Mock PaintingContextBuilder
    mockPaintingContextBuilder = {
      buildContext: mock(() => Promise.resolve(ok(mockPaintingContext))),
    } as unknown as PaintingContextBuilder;
  });

  describe("execute", () => {
    it("should skip execution when hourBucket already exists (idempotency)", async () => {
      // Mock env module to return production mode for this test
      mock.module("@/env", () => ({
        env: { NODE_ENV: "production" },
      }));

      // Mock existing snapshot
      mockMarketSnapshotsRepository.findByHourBucket = mock(() =>
        Promise.resolve(ok(mockMarketSnapshot)),
      ) as unknown as typeof mockMarketSnapshotsRepository.findByHourBucket;

      const orchestrator = new PaintingGenerationOrchestrator({
        tokenSelectionService: mockTokenSelectionService,
        marketDataService: mockMarketDataService,
        paintingContextBuilder: mockPaintingContextBuilder,
        marketSnapshotsRepository: mockMarketSnapshotsRepository,
        tokensRepository: mockTokensRepository,
        r2Bucket: mockR2Bucket,
        d1Binding: mockD1Binding,
      });

      const result = await orchestrator.execute(mockCloudflareEnv);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status).toBe("skipped");
        expect(result.value.hourBucket).toBeDefined();
        expect(result.value.selectedToken).toBeUndefined();
        expect(result.value.imageUrl).toBeUndefined();
      }

      // Verify token selection was not called
      expect(mockTokenSelectionService.selectToken).not.toHaveBeenCalled();
    });

    it("should handle token selection errors", async () => {
      const mockError: AppError = {
        type: "ExternalApiError",
        provider: "coingecko",
        message: "API rate limit exceeded",
      };

      mockTokenSelectionService.selectToken = mock(() =>
        Promise.resolve(err(mockError)),
      ) as unknown as typeof mockTokenSelectionService.selectToken;

      const orchestrator = new PaintingGenerationOrchestrator({
        tokenSelectionService: mockTokenSelectionService,
        marketDataService: mockMarketDataService,
        paintingContextBuilder: mockPaintingContextBuilder,
        marketSnapshotsRepository: mockMarketSnapshotsRepository,
        tokensRepository: mockTokensRepository,
        r2Bucket: mockR2Bucket,
        d1Binding: mockD1Binding,
      });

      const result = await orchestrator.execute(mockCloudflareEnv);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ExternalApiError");
        if (result.error.type === "ExternalApiError") {
          expect(result.error.provider).toBe("coingecko");
        }
      }
    });

    it("should handle market data fetch errors", async () => {
      const mockError: AppError = {
        type: "ExternalApiError",
        provider: "coingecko",
        message: "Network error",
      };

      mockMarketDataService.fetchGlobalMarketData = mock(() =>
        Promise.resolve(err(mockError)),
      ) as unknown as typeof mockMarketDataService.fetchGlobalMarketData;

      const orchestrator = new PaintingGenerationOrchestrator({
        tokenSelectionService: mockTokenSelectionService,
        marketDataService: mockMarketDataService,
        paintingContextBuilder: mockPaintingContextBuilder,
        marketSnapshotsRepository: mockMarketSnapshotsRepository,
        tokensRepository: mockTokensRepository,
        r2Bucket: mockR2Bucket,
        d1Binding: mockD1Binding,
      });

      const result = await orchestrator.execute(mockCloudflareEnv);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ExternalApiError");
      }
    });

    it("should handle context building errors", async () => {
      const mockError: AppError = {
        type: "InternalError",
        message: "Context building failed",
      };

      mockPaintingContextBuilder.buildContext = mock(() =>
        Promise.resolve(err(mockError)),
      ) as unknown as typeof mockPaintingContextBuilder.buildContext;

      const orchestrator = new PaintingGenerationOrchestrator({
        tokenSelectionService: mockTokenSelectionService,
        marketDataService: mockMarketDataService,
        paintingContextBuilder: mockPaintingContextBuilder,
        marketSnapshotsRepository: mockMarketSnapshotsRepository,
        tokensRepository: mockTokensRepository,
        r2Bucket: mockR2Bucket,
        d1Binding: mockD1Binding,
      });

      const result = await orchestrator.execute(mockCloudflareEnv);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("InternalError");
      }
    });

    it("should handle market snapshot storage errors", async () => {
      const mockError: AppError = {
        type: "StorageError",
        op: "put",
        key: "market_snapshots",
        message: "D1 write failed",
      };

      mockMarketDataService.storeMarketSnapshot = mock(() =>
        Promise.resolve(err(mockError)),
      ) as unknown as typeof mockMarketDataService.storeMarketSnapshot;

      const orchestrator = new PaintingGenerationOrchestrator({
        tokenSelectionService: mockTokenSelectionService,
        marketDataService: mockMarketDataService,
        paintingContextBuilder: mockPaintingContextBuilder,
        marketSnapshotsRepository: mockMarketSnapshotsRepository,
        tokensRepository: mockTokensRepository,
        r2Bucket: mockR2Bucket,
        d1Binding: mockD1Binding,
      });

      const result = await orchestrator.execute(mockCloudflareEnv);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("StorageError");
      }
    });

    it("should handle D1 binding errors gracefully", async () => {
      const mockError: AppError = {
        type: "StorageError",
        op: "get",
        key: "market_snapshots",
        message: "D1 query failed",
      };

      mockMarketSnapshotsRepository.findByHourBucket = mock(() =>
        Promise.resolve(err(mockError)),
      ) as unknown as typeof mockMarketSnapshotsRepository.findByHourBucket;

      const orchestrator = new PaintingGenerationOrchestrator({
        tokenSelectionService: mockTokenSelectionService,
        marketDataService: mockMarketDataService,
        paintingContextBuilder: mockPaintingContextBuilder,
        marketSnapshotsRepository: mockMarketSnapshotsRepository,
        tokensRepository: mockTokensRepository,
        r2Bucket: mockR2Bucket,
        d1Binding: mockD1Binding,
      });

      const result = await orchestrator.execute(mockCloudflareEnv);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("StorageError");
      }
    });
  });
});
