import { get } from "@/lib/cache";
import { appRouter } from "@/server/trpc/routers/_app";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { createMockContext } from "../../../unit/server/trpc/helpers";
import {
  createMockCache,
  restoreCacheMock,
  setupCacheMock,
  type CachedResponseData,
} from "../../lib/cache-test-helpers";

describe("R2 Integration", () => {
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
