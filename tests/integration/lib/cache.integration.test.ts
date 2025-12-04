import { get, remove, set } from "@/lib/cache";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

describe("Cache Integration - get/set Pattern", () => {
  let originalCaches: CacheStorage | undefined;
  let cacheMap: Map<string, Response>;

  beforeEach(() => {
    // Shared in-memory cache simulation
    cacheMap = new Map<string, Response>();

    // Mock caches for integration tests
    const mockCache = {
      match: (key: string | Request) => {
        const keyStr = typeof key === "string" ? key : key.url;
        return Promise.resolve(cacheMap.get(keyStr) || undefined);
      },
      put: (key: string | Request, response: Response) => {
        const keyStr = typeof key === "string" ? key : key.url;
        cacheMap.set(keyStr, response);
        return Promise.resolve();
      },
      delete: (key: string | Request) => {
        const keyStr = typeof key === "string" ? key : key.url;
        return Promise.resolve(cacheMap.delete(keyStr));
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

  it("should get and set values correctly", async () => {
    const testKey = "integration:test-key";
    const testValue = { foo: "bar", count: 42 };

    // Initially should be null
    const initial = await get<typeof testValue>(testKey);
    expect(initial).toBeNull();

    // Set the value
    await set(testKey, testValue, { ttlSeconds: 60 });

    // Should retrieve the value
    const retrieved = await get<typeof testValue>(testKey);
    expect(retrieved).toEqual(testValue);
  });

  it("should return null after remove", async () => {
    const testKey = "integration:test-key-remove";
    const testValue = { data: "test" };

    // Set the value
    await set(testKey, testValue, { ttlSeconds: 60 });

    // Verify it's cached
    const beforeRemove = await get<typeof testValue>(testKey);
    expect(beforeRemove).toEqual(testValue);

    // Remove it
    const removed = await remove(testKey);
    expect(removed).toBe(true);

    // Should return null after removal
    const afterRemove = await get<typeof testValue>(testKey);
    expect(afterRemove).toBeNull();
  });

  it("should handle get/set pattern with namespace", async () => {
    const testKey = "test-key";
    const testValue = { namespace: "test" };

    // Set with namespace
    await set(testKey, testValue, { ttlSeconds: 60, namespace: "ns1" });

    // Get with same namespace should work
    const retrieved1 = await get<typeof testValue>(testKey, { namespace: "ns1" });
    expect(retrieved1).toEqual(testValue);

    // Get with different namespace should return null
    const retrieved2 = await get<typeof testValue>(testKey, { namespace: "ns2" });
    expect(retrieved2).toBeNull();
  });
});
