/// <reference lib="dom" />

/**
 * Integration Tests for OGP Image Generation
 *
 * Tests the actual functions from opengraph-image.tsx:
 * - getArtworkDataUrl with mocked R2 responses
 * - getPlaceholderDataUrl
 * - Error handling and fallback logic
 */

import { describe, expect, test, mock, beforeEach } from "bun:test";
import { getArtworkDataUrl, getPlaceholderDataUrl, getFrameDataUrl } from "@/app/opengraph-image";
import { createMemoryR2Client } from "@/lib/r2";

describe("OGP Image Generation (Integration Tests)", () => {
  const mockBaseUrl = "http://test.example.com";

  beforeEach(() => {
    // Reset fetch mock before each test
    mock.restore();
  });

  describe("getPlaceholderDataUrl", () => {
    test("should fetch and convert placeholder image to data URL", async () => {
      // Mock successful placeholder fetch
      global.fetch = mock(async (url: string) => {
        if (url.includes("placeholder-painting.webp")) {
          const buffer = new TextEncoder().encode("mock placeholder image").buffer;
          return new Response(buffer, {
            status: 200,
            headers: { "Content-Type": "image/webp" },
          });
        }
        return new Response(null, { status: 404 });
      }) as unknown as typeof fetch;

      const dataUrl = await getPlaceholderDataUrl(mockBaseUrl);

      expect(dataUrl).toStartWith("data:image/webp;base64,");
      expect(dataUrl.length).toBeGreaterThan(30);
    });

    test("should throw error when placeholder fetch fails", async () => {
      // Mock failed fetch
      global.fetch = mock(async () => {
        return new Response(null, { status: 404 });
      }) as unknown as typeof fetch;

      await expect(getPlaceholderDataUrl(mockBaseUrl)).rejects.toThrow("Failed to fetch placeholder: 404");
    });
  });

  describe("getFrameDataUrl", () => {
    test("should fetch and convert frame image to data URL", async () => {
      // Mock successful frame fetch
      global.fetch = mock(async (url: string) => {
        if (url.includes("frame.webp")) {
          const buffer = new TextEncoder().encode("mock frame image").buffer;
          return new Response(buffer, {
            status: 200,
            headers: { "Content-Type": "image/webp" },
          });
        }
        return new Response(null, { status: 404 });
      }) as unknown as typeof fetch;

      const dataUrl = await getFrameDataUrl(mockBaseUrl);

      expect(dataUrl).toStartWith("data:image/webp;base64,");
      expect(dataUrl.length).toBeGreaterThan(30);
    });

    test("should throw error when frame fetch fails", async () => {
      // Mock failed fetch
      global.fetch = mock(async () => {
        return new Response(null, { status: 404 });
      }) as unknown as typeof fetch;

      await expect(getFrameDataUrl(mockBaseUrl)).rejects.toThrow("Failed to fetch frame: 404");
    });
  });

  describe("getArtworkDataUrl", () => {
    test("should return artwork data URL when state and image exist", async () => {
      const { bucket } = createMemoryR2Client();

      await bucket.put(
        "state/global.json",
        JSON.stringify({
          prevHash: "test-hash",
          lastTs: "2025-11-10T00:00:00Z",
          imageUrl: "/api/r2/images/test.webp",
        }),
        {
          httpMetadata: {
            contentType: "application/json",
          },
        },
      );

      const imageBuffer = new TextEncoder().encode("mock image data").buffer;
      await bucket.put("images/test.webp", imageBuffer, {
        httpMetadata: {
          contentType: "image/webp",
        },
      });

      const result = await getArtworkDataUrl(mockBaseUrl, bucket);

      expect(result.fallbackUsed).toBe(false);
      expect(result.dataUrl).toStartWith("data:image/webp;base64,");
    });

    test("should use fallback when state retrieval throws", async () => {
      global.fetch = mock(async (url: string) => {
        if (url.includes("placeholder-painting.webp")) {
          const buffer = new TextEncoder().encode("placeholder").buffer;
          return new Response(buffer, {
            status: 200,
            headers: { "Content-Type": "image/webp" },
          });
        }
        return new Response(null, { status: 404 });
      }) as unknown as typeof fetch;

      const { bucket } = createMemoryR2Client();
      const failingBucket = {
        ...bucket,
        get: mock(async () => {
          throw new Error("R2 failure");
        }),
      } as unknown as R2Bucket;

      const result = await getArtworkDataUrl(mockBaseUrl, failingBucket);

      expect(result.fallbackUsed).toBe(true);
      expect(result.dataUrl).toStartWith("data:image/webp;base64,");
    });

    test("should use fallback when state has no imageUrl", async () => {
      global.fetch = mock(async (url: string) => {
        if (url.includes("placeholder-painting.webp")) {
          const buffer = new TextEncoder().encode("placeholder").buffer;
          return new Response(buffer, {
            status: 200,
            headers: { "Content-Type": "image/webp" },
          });
        }
        return new Response(null, { status: 404 });
      }) as unknown as typeof fetch;

      const { bucket } = createMemoryR2Client();
      await bucket.put(
        "state/global.json",
        JSON.stringify({
          prevHash: "test-hash",
          lastTs: "2025-11-10T00:00:00Z",
          imageUrl: null,
        }),
        {
          httpMetadata: {
            contentType: "application/json",
          },
        },
      );

      const result = await getArtworkDataUrl(mockBaseUrl, bucket);

      expect(result.fallbackUsed).toBe(true);
      expect(result.dataUrl).toStartWith("data:image/webp;base64,");
    });

    test("should use fallback when image fetch returns null", async () => {
      global.fetch = mock(async (url: string) => {
        if (url.includes("placeholder-painting.webp")) {
          const buffer = new TextEncoder().encode("placeholder").buffer;
          return new Response(buffer, {
            status: 200,
            headers: { "Content-Type": "image/webp" },
          });
        }
        return new Response(null, { status: 404 });
      }) as unknown as typeof fetch;

      const { bucket } = createMemoryR2Client();
      await bucket.put(
        "state/global.json",
        JSON.stringify({
          prevHash: "test-hash",
          lastTs: "2025-11-10T00:00:00Z",
          imageUrl: "/api/r2/images/missing.webp",
        }),
        {
          httpMetadata: {
            contentType: "application/json",
          },
        },
      );

      const result = await getArtworkDataUrl(mockBaseUrl, bucket);

      expect(result.fallbackUsed).toBe(true);
      expect(result.dataUrl).toStartWith("data:image/webp;base64,");
    });
  });

  describe("Data URL format validation", () => {
    test("should generate valid base64 data URL", async () => {
      global.fetch = mock(async () => {
        const buffer = new TextEncoder().encode("test image").buffer;
        return new Response(buffer, {
          status: 200,
          headers: { "Content-Type": "image/webp" },
        });
      }) as unknown as typeof fetch;

      const dataUrl = await getPlaceholderDataUrl(mockBaseUrl);

      // Verify data URL format
      expect(dataUrl).toMatch(/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/);
    });

    test("should handle binary image data correctly", async () => {
      global.fetch = mock(async () => {
        // Create binary data (JPEG magic bytes)
        const buffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer;
        return new Response(buffer, {
          status: 200,
          headers: { "Content-Type": "image/webp" },
        });
      }) as unknown as typeof fetch;

      const dataUrl = await getPlaceholderDataUrl(mockBaseUrl);

      expect(dataUrl).toStartWith("data:image/webp;base64,");

      // Verify binary data is preserved
      const base64Part = dataUrl.split(",")[1];
      const decoded = Buffer.from(base64Part, "base64");
      expect(Array.from(new Uint8Array(decoded))).toEqual([0xff, 0xd8, 0xff, 0xe0]);
    });
  });
});
