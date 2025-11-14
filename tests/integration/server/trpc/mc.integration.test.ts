import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { appRouter } from "@/server/trpc/routers/_app";
import { createMockContext } from "../../../unit/server/trpc/helpers";
import { ok } from "neverthrow";
import { TOKEN_TICKERS } from "@/constants/token";
import { get } from "@/lib/cache";

describe("MC Integration", () => {
  let originalCaches: CacheStorage | undefined;
  let cacheMap: Map<string, { body: string; headers: Headers; status: number; statusText: string }>;

  beforeEach(() => {
    mock.restore();
    // Mock cache for integration tests
    cacheMap = new Map<string, { body: string; headers: Headers; status: number; statusText: string }>();
    const mockCache = {
      match: async (key: string | Request) => {
        const keyStr = typeof key === "string" ? key : key.url;
        const cached = cacheMap.get(keyStr);
        if (!cached) return undefined;
        // Recreate Response from cached data
        return new Response(cached.body, {
          status: cached.status,
          statusText: cached.statusText,
          headers: cached.headers,
        });
      },
      put: async (key: string | Request, response: Response) => {
        const keyStr = typeof key === "string" ? key : key.url;
        // Store response data (body, headers, etc.) to avoid body consumption
        const body = await response.clone().text();
        const headers = new Headers(response.headers);
        cacheMap.set(keyStr, {
          body,
          headers,
          status: response.status,
          statusText: response.statusText,
        });
      },
      delete: async (key: string | Request) => {
        const keyStr = typeof key === "string" ? key : key.url;
        return cacheMap.delete(keyStr);
      },
    } as unknown as Cache;

    originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
    (globalThis as unknown as { caches?: CacheStorage }).caches = {
      default: mockCache,
    } as unknown as CacheStorage;
  });

  afterEach(() => {
    cacheMap.clear();
    (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
  });

  it("should fetch market caps from mocked service", async () => {
    // Create deterministic mock market cap data
    const mockMcMap = TOKEN_TICKERS.reduce(
      (acc, ticker) => {
        acc[ticker] = 1000000;
        return acc;
      },
      {} as Record<(typeof TOKEN_TICKERS)[number], number>,
    );

    // Mock the market cap service to avoid calling real external API
    mock.module("@/services/market-cap", () => ({
      createMarketCapService: () => ({
        getMcMap: async () => ok(mockMcMap),
        getRoundedMcMap: async () => ok(mockMcMap),
      }),
    }));

    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.mc.getMarketCaps();

    expect(result).toHaveProperty("tokens");
    expect(result).toHaveProperty("generatedAt");
    expect(Object.keys(result.tokens).length).toBe(TOKEN_TICKERS.length);
    expect(typeof result.generatedAt).toBe("string");
  });

  it("should return valid market cap values", async () => {
    // Create deterministic mock market cap data with varied values
    const mockMcMap = TOKEN_TICKERS.reduce(
      (acc, ticker, index) => {
        acc[ticker] = (index + 1) * 500000;
        return acc;
      },
      {} as Record<(typeof TOKEN_TICKERS)[number], number>,
    );

    // Mock the market cap service to avoid calling real external API
    mock.module("@/services/market-cap", () => ({
      createMarketCapService: () => ({
        getMcMap: async () => ok(mockMcMap),
        getRoundedMcMap: async () => ok(mockMcMap),
      }),
    }));

    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.mc.getMarketCaps();

    // 全てのトークンが0以上の値を持つことを確認
    for (const [_ticker, value] of Object.entries(result.tokens)) {
      expect(typeof value).toBe("number");
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it("should return rounded market caps", async () => {
    // Create deterministic mock market cap data
    const mockMcMap = TOKEN_TICKERS.reduce(
      (acc, ticker) => {
        acc[ticker] = 1234567.89;
        return acc;
      },
      {} as Record<(typeof TOKEN_TICKERS)[number], number>,
    );

    // Mock the market cap service to avoid calling real external API
    mock.module("@/services/market-cap", () => ({
      createMarketCapService: () => ({
        getMcMap: async () => ok(mockMcMap),
        getRoundedMcMap: async () => ok(mockMcMap),
      }),
    }));

    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.mc.getRoundedMcMap();

    expect(result).toHaveProperty("tokens");
    expect(result).toHaveProperty("generatedAt");
    expect(Object.keys(result.tokens).length).toBe(TOKEN_TICKERS.length);
  });

  describe("Cache Integration", () => {
    it("should cache getMarketCaps result and return cached value on second call", async () => {
      const mockMcMap = TOKEN_TICKERS.reduce(
        (acc, ticker) => {
          acc[ticker] = 1000000;
          return acc;
        },
        {} as Record<(typeof TOKEN_TICKERS)[number], number>,
      );

      let serviceCallCount = 0;
      const serviceMock = {
        getMcMap: async () => {
          serviceCallCount++;
          return ok(mockMcMap);
        },
        getRoundedMcMap: async () => ok(mockMcMap),
      };

      mock.module("@/services/market-cap", () => ({
        createMarketCapService: () => serviceMock,
      }));

      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      // First call - should compute and cache
      const result1 = await caller.mc.getMarketCaps();
      expect(serviceCallCount).toBe(1);
      expect(result1).toHaveProperty("tokens");
      expect(result1).toHaveProperty("generatedAt");

      // Verify cache was set (check tokens only, as generatedAt is added after cache retrieval)
      const cached = await get<{ tokens: Record<string, number> }>("mc:getMarketCaps", {
        logger: ctx.logger,
      });
      expect(cached).not.toBeNull();
      expect(cached?.tokens).toEqual(mockMcMap);

      // Reset call count before second call
      const callCountBeforeSecondCall = serviceCallCount;
      serviceCallCount = 0;

      // Second call - should return cached value
      const result2 = await caller.mc.getMarketCaps();
      // Service should not be called again (callCount should remain 0)
      expect(serviceCallCount).toBe(0);
      expect(result2).toHaveProperty("tokens");
      expect(result2).toHaveProperty("generatedAt");
      // tokens should match (generatedAt may differ as it's updated each time)
      expect(result2.tokens).toEqual(result1.tokens);
      expect(result2.tokens).toEqual(mockMcMap);
    });

    it("should use ctx.logger for cache operations", async () => {
      const mockMcMap = TOKEN_TICKERS.reduce(
        (acc, ticker) => {
          acc[ticker] = 1000000;
          return acc;
        },
        {} as Record<(typeof TOKEN_TICKERS)[number], number>,
      );

      const loggerSpy = {
        debug: mock(() => {}),
        info: mock(() => {}),
        warn: mock(() => {}),
        error: mock(() => {}),
      };

      mock.module("@/services/market-cap", () => ({
        createMarketCapService: () => ({
          getMcMap: async () => ok(mockMcMap),
          getRoundedMcMap: async () => ok(mockMcMap),
        }),
      }));

      const ctx = createMockContext({ logger: loggerSpy as typeof ctx.logger });
      const caller = appRouter.createCaller(ctx);

      await caller.mc.getMarketCaps();

      // Verify logger was called (cache operations use logger)
      expect(loggerSpy.debug.mock.calls.length).toBeGreaterThan(0);
    });

    it("should cache getRoundedMcMap result", async () => {
      const mockMcMap = TOKEN_TICKERS.reduce(
        (acc, ticker) => {
          acc[ticker] = 1234567.89;
          return acc;
        },
        {} as Record<(typeof TOKEN_TICKERS)[number], number>,
      );

      let callCount = 0;
      mock.module("@/services/market-cap", () => ({
        createMarketCapService: () => ({
          getMcMap: async () => ok(mockMcMap),
          getRoundedMcMap: async () => {
            callCount++;
            return ok(mockMcMap);
          },
        }),
      }));

      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      // First call
      const result1 = await caller.mc.getRoundedMcMap();
      expect(callCount).toBe(1);

      // Second call - should use cache
      const result2 = await caller.mc.getRoundedMcMap();
      expect(callCount).toBe(1); // Should not call service again
      expect(result2.tokens).toEqual(result1.tokens);
    });
  });
});
