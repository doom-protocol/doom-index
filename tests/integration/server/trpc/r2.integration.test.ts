import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { appRouter } from "@/server/trpc/routers/_app";
import { createMockContext } from "../../../unit/server/trpc/helpers";
import { get } from "@/lib/cache";

describe("R2 Integration", () => {
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

  describe("Cache Integration", () => {
    it("should cache r2.getJson result", async () => {
      const mockJsonData = { foo: "bar", count: 42 };
      const mockBucket = {
        get: async () => ({
          json: async () => mockJsonData,
        }),
      } as unknown as R2Bucket;

      mock.module("@/lib/r2", () => ({
        resolveR2Bucket: () => ({ isErr: () => false, value: mockBucket }),
        getJsonR2: async () => ({ isErr: () => false, value: mockJsonData }),
      }));

      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      // First call
      const result1 = await caller.r2.getJson({ key: ["state", "global.json"] });
      expect(result1).toEqual(mockJsonData);

      // Verify cache was set with object key in cache key
      const cached = await get<typeof mockJsonData>("r2:getJson:state/global.json", {
        logger: ctx.logger,
      });
      expect(cached).not.toBeNull();
      expect(cached).toEqual(mockJsonData);

      // Second call - should return cached value
      const result2 = await caller.r2.getJson({ key: ["state", "global.json"] });
      expect(result2).toEqual(mockJsonData);
    });
  });
});
