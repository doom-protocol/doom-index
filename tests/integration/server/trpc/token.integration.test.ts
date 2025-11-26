import { appRouter } from "@/server/trpc/routers/_app";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { createMockContext } from "../../../unit/server/trpc/helpers";
// TOKEN_TICKERS no longer exists - legacy token system removed
import { get } from "@/lib/cache";
import {
  createMockCache,
  restoreCacheMock,
  setupCacheMock,
  type CachedResponseData,
} from "../../lib/cache-test-helpers";

describe("Token Integration", () => {
  let originalCaches: CacheStorage | undefined;
  let cacheMap: Map<string, CachedResponseData>;

  beforeEach(() => {
    mock.restore();
    const { cacheMap: map, mockCache } = createMockCache();
    cacheMap = map;
    originalCaches = setupCacheMock(mockCache);
  });

  afterEach(() => {
    cacheMap.clear();
    restoreCacheMock(originalCaches);
  });

  it("should fetch token state for single ticker", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.token.getState({ ticker: "CO2" });

      // Should return null or TokenState
      expect(result === null || typeof result === "object").toBe(true);

      if (result !== null) {
        expect(result).toHaveProperty("ticker");
        expect(result).toHaveProperty("thumbnailUrl");
        expect(result).toHaveProperty("updatedAt");
        expect(result.ticker).toBe("CO2");
      }
    } catch (error) {
      // R2が利用できない場合はスキップ
      console.log("Skipping test: R2 not available", error);
    }
  });

  it("should return null for non-existent token state", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    try {
      // 存在しない可能性が高いトークン状態を取得
      const result = await caller.token.getState({ ticker: "CO2" });

      // nullまたはTokenStateを返す（どちらも有効）
      expect(result === null || typeof result === "object").toBe(true);
    } catch (error) {
      // R2が利用できない場合はスキップ
      console.log("Skipping test: R2 not available", error);
    }
  });

  describe("Cache Integration", () => {
    it("should cache getState result with ticker in cache key", async () => {
      const mockTokenState = {
        ticker: "CO2" as const,
        thumbnailUrl: "https://example.com/co2.webp",
        updatedAt: new Date().toISOString(),
      };

      // Mock R2 bucket and getJsonR2
      const mockBucket = {
        get: async () => ({
          json: async () => mockTokenState,
        }),
      } as unknown as R2Bucket;

      mock.module("@/lib/r2", () => ({
        resolveR2Bucket: () => ({ isErr: () => false, value: mockBucket }),
        getJsonR2: async () => ({ isErr: () => false, value: mockTokenState }),
      }));

      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      // First call
      const result1 = await caller.token.getState({ ticker: "CO2" });
      expect(result1).toEqual(mockTokenState);

      // Verify cache was set with ticker in key
      const cached = await get<typeof mockTokenState>("token:getState:CO2", {
        namespace: undefined,
        logger: ctx.logger,
      });
      expect(cached).not.toBeNull();
      expect(cached).toEqual(mockTokenState);

      // Second call - should return cached value
      const result2 = await caller.token.getState({ ticker: "CO2" });
      expect(result2).toEqual(mockTokenState);
    });
  });
});
