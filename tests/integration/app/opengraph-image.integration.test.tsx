/// <reference lib="dom" />

/**
 * Integration Tests for OGP Image Generation
 *
 * Tests the actual functions from opengraph-image.tsx:
 * - getCurrentPaintingDataUrl with mocked R2 responses
 * - getPlaceholderDataUrl
 * - Error handling and fallback logic
 */

import { getCurrentPaintingDataUrl, getFrameDataUrl, getPlaceholderDataUrl } from "@/app/opengraph-image";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createTestR2Bucket } from "../../lib/memory-r2";

describe("OGP Image Generation (Integration Tests)", () => {
  const createMockFetcher = (shouldSucceed: boolean, imageData?: string): Fetcher => {
    return {
      fetch: mock(async (input: RequestInfo | URL) => {
        const _url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
        if (shouldSucceed) {
          const buffer = new TextEncoder().encode(imageData || "mock image data").buffer;
          return new Response(buffer, {
            status: 200,
            headers: { "Content-Type": "image/webp" },
          });
        }
        return new Response(null, { status: 404 });
      }) as unknown as typeof fetch,
      connect: mock(() => {
        throw new Error("connect is not implemented in tests");
      }) as unknown as Fetcher["connect"],
    } as Fetcher;
  };

  beforeEach(() => {
    // Reset fetch mock before each test
    mock.restore();
  });

  describe("getPlaceholderDataUrl", () => {
    test("should fetch and convert placeholder image to data URL", async () => {
      const mockFetcher = createMockFetcher(true, "mock placeholder image");

      const dataUrl = await getPlaceholderDataUrl(mockFetcher);

      expect(dataUrl).toStartWith("data:image/webp;base64,");
      expect(dataUrl.length).toBeGreaterThan(30);
    });

    test("should return empty string when placeholder fetch fails", async () => {
      const mockFetcher = createMockFetcher(false);

      const dataUrl = await getPlaceholderDataUrl(mockFetcher);

      expect(dataUrl).toBe("");
    });
  });

  describe("getFrameDataUrl", () => {
    test("should fetch and convert frame image to data URL", async () => {
      const mockFetcher = createMockFetcher(true, "mock frame image");

      const dataUrl = await getFrameDataUrl(mockFetcher);

      expect(dataUrl).not.toBeNull();
      expect(dataUrl).toStartWith("data:image/webp;base64,");
      expect(dataUrl!.length).toBeGreaterThan(30);
    });

    test("should return null when frame fetch fails", async () => {
      const mockFetcher = createMockFetcher(false);

      const dataUrl = await getFrameDataUrl(mockFetcher);

      expect(dataUrl).toBeNull();
    });
  });

  describe("getCurrentPaintingDataUrl", () => {
    test("should return artwork data URL when image exists", async () => {
      const { bucket } = createTestR2Bucket();
      const mockFetcher = createMockFetcher(true, "placeholder");

      const imageBuffer = new TextEncoder().encode("mock image data").buffer;
      await bucket.put("images/test.webp", imageBuffer, {
        httpMetadata: {
          contentType: "image/webp",
        },
      });

      const result = await getCurrentPaintingDataUrl(mockFetcher, bucket, "images/test.webp");

      expect(result.fallbackUsed).toBe(false);
      expect(result.dataUrl).toStartWith("data:image/webp;base64,");
    });

    test("should use fallback when image retrieval throws", async () => {
      const mockFetcher = createMockFetcher(true, "placeholder");

      const { bucket } = createTestR2Bucket();
      const failingBucket = {
        ...bucket,
        get: mock(async () => {
          throw new Error("R2 failure");
        }),
      } as unknown as R2Bucket;

      const result = await getCurrentPaintingDataUrl(mockFetcher, failingBucket, "images/test.webp");

      expect(result.fallbackUsed).toBe(true);
      expect(result.dataUrl).toStartWith("data:image/webp;base64,");
    });

    test("should use fallback when image fetch returns null", async () => {
      const mockFetcher = createMockFetcher(true, "placeholder");

      const { bucket } = createTestR2Bucket();
      // No image stored

      const result = await getCurrentPaintingDataUrl(mockFetcher, bucket, "images/missing.webp");

      expect(result.fallbackUsed).toBe(true);
      expect(result.dataUrl).toStartWith("data:image/webp;base64,");
    });
  });

  describe("Data URL format validation", () => {
    test("should generate valid base64 data URL", async () => {
      const mockFetcher = createMockFetcher(true, "test image");

      const dataUrl = await getPlaceholderDataUrl(mockFetcher);

      // Verify data URL format
      expect(dataUrl).toMatch(/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/);
    });

    test("should handle binary image data correctly", async () => {
      const binaryData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const mockFetcher: Fetcher = {
        fetch: mock(async () => {
          return new Response(binaryData.buffer, {
            status: 200,
            headers: { "Content-Type": "image/webp" },
          });
        }) as unknown as typeof fetch,
        connect: mock(() => {
          throw new Error("connect is not implemented in tests");
        }) as unknown as Fetcher["connect"],
      } as Fetcher;

      const dataUrl = await getPlaceholderDataUrl(mockFetcher);

      expect(dataUrl).toStartWith("data:image/webp;base64,");

      // Verify binary data is preserved
      const base64Part = dataUrl.split(",")[1];
      const decoded = Buffer.from(base64Part, "base64");
      expect(Array.from(new Uint8Array(decoded))).toEqual([0xff, 0xd8, 0xff, 0xe0]);
    });
  });
});
