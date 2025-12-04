import { get, set } from "@/lib/cache";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

describe("Cache Integration - tRPC Context Graceful Degradation", () => {
  let originalCaches: CacheStorage | undefined;

  beforeEach(() => {
    // Simulate environment without caches
    originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
    (globalThis as unknown as { caches?: CacheStorage }).caches = undefined;
  });

  afterEach(() => {
    (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
  });

  it("should gracefully degrade when caches is unavailable", async () => {
    const testKey = "integration:graceful-degradation";
    const testValue = { data: "test" };

    // get should return null without throwing
    const result = await get<typeof testValue>(testKey);
    expect(result).toBeNull();

    // set should not throw
    await set(testKey, testValue, { ttlSeconds: 60 });
    // Should complete without error
    expect(true).toBe(true);
  });

  it("should work when caches becomes available", async () => {
    const testKey = "integration:context-available";
    const testValue = { data: "test" };

    // Initially unavailable
    const result1 = await get<typeof testValue>(testKey);
    expect(result1).toBeNull();

    // Make caches available
    const cacheMap = new Map<string, { body: string; headers: Headers; status: number; statusText: string }>();
    const mockCache = {
      match: (key: string | Request) => {
        const keyStr = typeof key === "string" ? key : key.url;
        const cached = cacheMap.get(keyStr);
        if (!cached) return Promise.resolve(undefined);
        return Promise.resolve(
          new Response(cached.body, {
            status: cached.status,
            statusText: cached.statusText,
            headers: cached.headers,
          }),
        );
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
      delete: (key: string | Request) => {
        const keyStr = typeof key === "string" ? key : key.url;
        return Promise.resolve(cacheMap.delete(keyStr));
      },
    } as unknown as Cache;

    (globalThis as unknown as { caches?: CacheStorage }).caches = {
      default: mockCache,
    } as unknown as CacheStorage;

    // Now should work
    await set(testKey, testValue, { ttlSeconds: 60 });
    const result2 = await get<typeof testValue>(testKey);
    expect(result2).toEqual(testValue);
  });
});
