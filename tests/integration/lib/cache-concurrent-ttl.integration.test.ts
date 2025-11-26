import { getOrSet } from "@/lib/cache";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createMockCache, restoreCacheMock, setupCacheMock, type CachedResponseData } from "./cache-test-helpers";

describe("Cache Integration - Concurrent Requests and TTL", () => {
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

  it("should deduplicate concurrent requests for same key", async () => {
    const testKey = "integration:concurrent-key";
    let computeCallCount = 0;

    const computeFn = async () => {
      computeCallCount++;
      // Simulate async computation
      await new Promise(resolve => setTimeout(resolve, 10));
      return { value: `computed-${computeCallCount}` };
    };

    // Make 5 concurrent requests
    const promises = Array.from({ length: 5 }, () => getOrSet(testKey, computeFn, { ttlSeconds: 60 }));

    const results = await Promise.all(promises);

    // All should return the same value
    const firstValue = results[0].value;
    results.forEach(result => {
      expect(result.value).toBe(firstValue);
    });

    // Compute function should only be called once
    expect(computeCallCount).toBe(1);
  });

  it("should preserve tRPC procedure return types", async () => {
    type TokenState = {
      ticker: string;
      thumbnailUrl: string;
      updatedAt: string;
    };

    const testKey = "integration:type-preservation";
    const mockTokenState: TokenState = {
      ticker: "CO2",
      thumbnailUrl: "https://example.com/co2.webp",
      updatedAt: new Date().toISOString(),
    };

    const computeFn = async (): Promise<TokenState> => {
      return mockTokenState;
    };

    const result = await getOrSet<TokenState>(testKey, computeFn, { ttlSeconds: 60 });

    // Type should be preserved
    expect(result).toHaveProperty("ticker");
    expect(result).toHaveProperty("thumbnailUrl");
    expect(result).toHaveProperty("updatedAt");
    expect(result.ticker).toBe("CO2");
    expect(typeof result.updatedAt).toBe("string");
  });
});
