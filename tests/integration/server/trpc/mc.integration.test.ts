import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { appRouter } from "@/server/trpc/routers/_app";
import { createMockContext } from "../../../unit/server/trpc/helpers";
import {
  createMockCache,
  setupCacheMock,
  restoreCacheMock,
  type CachedResponseData,
} from "../../lib/cache-test-helpers";

const ZERO_MAP = {};

const CACHE_KEY = "https://cache.local/mc:getMarketCaps";
const CACHE_KEY_ROUNDED = "https://cache.local/mc:getRoundedMcMap";

/**
 * Legacy MC Integration tests
 * @deprecated These tests are for the legacy market cap API which is deprecated.
 */
describe("MC Integration (legacy)", () => {
  let originalCaches: CacheStorage | undefined;
  let cacheMap: Map<string, CachedResponseData>;

  beforeEach(() => {
    const { cacheMap: map, mockCache } = createMockCache();
    cacheMap = map;
    originalCaches = setupCacheMock(mockCache);
  });

  afterEach(() => {
    cacheMap.clear();
    restoreCacheMock(originalCaches);
  });

  it("should return empty map with metadata", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.mc.getMarketCaps();

    expect(result.tokens).toEqual(ZERO_MAP);
    expect(typeof result.generatedAt).toBe("string");
    expect(Number.isNaN(new Date(result.generatedAt).getTime())).toBe(false);
  });

  it("should return empty map for rounded caps as well", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.mc.getRoundedMcMap();

    expect(result.tokens).toEqual(ZERO_MAP);
    expect(typeof result.generatedAt).toBe("string");
  });

  describe("Cache Integration", () => {
    it("should read cached getMarketCaps value on subsequent calls", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const first = await caller.mc.getMarketCaps();
      expect(first.tokens).toEqual(ZERO_MAP);

      // Overwrite cached body to simulate cached data coming from elsewhere
      const cachedEntry = cacheMap.get(CACHE_KEY);
      expect(cachedEntry).toBeDefined();
      if (cachedEntry) {
        const cachedValue = JSON.parse(cachedEntry.body) as { tokens: Record<string, number> };
        cachedValue.tokens.CO2 = 42;
        cachedEntry.body = JSON.stringify(cachedValue);
        cacheMap.set(CACHE_KEY, cachedEntry);
      }

      const second = await caller.mc.getMarketCaps();
      expect(second.tokens.CO2).toBe(42);
    });

    it("should read cached getRoundedMcMap value", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await caller.mc.getRoundedMcMap();

      const cachedEntry = cacheMap.get(CACHE_KEY_ROUNDED);
      expect(cachedEntry).toBeDefined();
      if (cachedEntry) {
        const cachedValue = JSON.parse(cachedEntry.body) as { tokens: Record<string, number> };
        cachedValue.tokens.HOPE = 99;
        cachedEntry.body = JSON.stringify(cachedValue);
        cacheMap.set(CACHE_KEY_ROUNDED, cachedEntry);
      }

      const second = await caller.mc.getRoundedMcMap();
      expect(second.tokens.HOPE).toBe(99);
    });
  });
});
