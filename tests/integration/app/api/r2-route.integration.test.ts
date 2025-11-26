import { GET } from "@/app/api/r2/[...key]/route";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { NextRequest } from "next/server";
import {
  createMockCache,
  restoreCacheMock,
  setupCacheMock,
  type CachedResponseData,
} from "../../lib/cache-test-helpers";

describe("R2 Route Handler Integration - Cache", () => {
  let originalCaches: CacheStorage | undefined;
  let cacheMap: Map<string, CachedResponseData>;
  let mockCache: Cache;

  beforeEach(() => {
    mock.restore();
    const { cacheMap: map, mockCache: cache } = createMockCache();
    cacheMap = map;
    mockCache = cache;
    originalCaches = setupCacheMock(mockCache);
  });

  afterEach(() => {
    cacheMap.clear();
    restoreCacheMock(originalCaches);
    mock.restore();
  });

  it("should cache HTTP response using get and set", async () => {
    const mockObject = {
      get: async () => ({
        writeHttpMetadata: (headers: Headers) => {
          headers.set("Content-Type", "image/webp");
        },
        httpMetadata: { contentType: "image/webp" },
        size: 12345,
        etag: '"abc123"',
        uploaded: new Date(),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3]));
            controller.close();
          },
        }),
      }),
    } as unknown as R2Bucket;

    mock.module("@/lib/r2", () => ({
      resolveR2BucketAsync: async () => ({ isErr: () => false, value: mockObject }),
    }));

    const request1 = new NextRequest("https://example.com/api/r2/test/image.webp");
    const params1 = Promise.resolve({ key: ["test", "image.webp"] });

    // First call - should compute and cache
    const response1 = await GET(request1, { params: params1 });
    expect(response1.status).toBe(200);
    expect(response1.headers.get("Content-Type")).toBe("image/webp");

    // Verify cache was set using get
    const { get } = await import("@/lib/cache");
    const cached = await get<{ body: string; headers: Record<string, string>; status: number; statusText: string }>(
      "r2:route:test/image.webp",
    );
    expect(cached).not.toBeNull();
    expect(cached?.headers["content-type"]).toBe("image/webp");

    // Second call - should return cached response
    const request2 = new NextRequest("https://example.com/api/r2/test/image.webp");
    const params2 = Promise.resolve({ key: ["test", "image.webp"] });

    let bucketCallCount = 0;
    mock.module("@/lib/r2", () => ({
      resolveR2BucketAsync: async () => {
        bucketCallCount++;
        return { isErr: () => false, value: mockObject };
      },
    }));

    const response2 = await GET(request2, { params: params2 });
    expect(response2.status).toBe(200);
    expect(bucketCallCount).toBe(0); // Should not call bucket again
  });

  it("should handle cache miss gracefully", async () => {
    const mockObject = {
      get: async () => ({
        writeHttpMetadata: (headers: Headers) => {
          headers.set("Content-Type", "application/json");
        },
        httpMetadata: { contentType: "application/json" },
        size: 100,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"test": "data"}'));
            controller.close();
          },
        }),
      }),
    } as unknown as R2Bucket;

    mock.module("@/lib/r2", () => ({
      resolveR2BucketAsync: async () => ({ isErr: () => false, value: mockObject }),
    }));

    const request = new NextRequest("https://example.com/api/r2/data.json");
    const params = Promise.resolve({ key: ["data.json"] });

    const response = await GET(request, { params });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("test");
  });
});
