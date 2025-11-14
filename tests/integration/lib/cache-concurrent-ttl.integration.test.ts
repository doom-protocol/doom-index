import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { getOrSet } from "@/lib/cache";

describe("Cache Integration - Concurrent Requests and TTL", () => {
  let originalCaches: CacheStorage | undefined;
  let cacheMap: Map<string, { body: string; headers: Headers; status: number; statusText: string }>;

  beforeEach(() => {
    cacheMap = new Map<string, { body: string; headers: Headers; status: number; statusText: string }>();
    const mockCache = {
      match: async (key: string | Request) => {
        const keyStr = typeof key === "string" ? key : key.url;
        const cached = cacheMap.get(keyStr);
        if (!cached) return undefined;
        return new Response(cached.body, {
          status: cached.status,
          statusText: cached.statusText,
          headers: cached.headers,
        });
      },
      put: async (key: string | Request, response: Response) => {
        const keyStr = typeof key === "string" ? key : key.url;
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
    const promises = Array.from({ length: 5 }, () =>
      getOrSet(testKey, computeFn, { ttlSeconds: 60 }),
    );

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
