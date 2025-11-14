import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { GET } from "@/app/api/r2/[...key]/route";
import { NextRequest } from "next/server";

describe("R2 Route Handler Integration - Cache", () => {
  let originalCaches: CacheStorage | undefined;
  let cacheMap: Map<string, { body: string; headers: Headers; status: number; statusText: string }>;
  let mockCache: Cache;

  beforeEach(() => {
    mock.restore();
    // Mock cache for integration tests
    cacheMap = new Map<string, { body: string; headers: Headers; status: number; statusText: string }>();
    mockCache = {
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
    mock.restore();
  });

  it("should cache HTTP response using withRequestCache", async () => {
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

    // Verify cache was set
    const cachedResponse = await mockCache.match(request1);
    expect(cachedResponse).not.toBeUndefined();

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
