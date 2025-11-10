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
import { getArtworkDataUrl, getPlaceholderDataUrl } from "@/app/opengraph-image";

describe("OGP Image Generation (Integration Tests)", () => {
  const mockR2Domain = "https://test.r2.dev";

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

      const dataUrl = await getPlaceholderDataUrl(mockR2Domain);

      expect(dataUrl).toStartWith("data:image/webp;base64,");
      expect(dataUrl.length).toBeGreaterThan(30);
    });

    test("should throw error when placeholder fetch fails", async () => {
      // Mock failed fetch
      global.fetch = mock(async () => {
        return new Response(null, { status: 404 });
      }) as unknown as typeof fetch;

      await expect(getPlaceholderDataUrl(mockR2Domain)).rejects.toThrow("Failed to fetch placeholder: 404");
    });
  });

  describe("getArtworkDataUrl", () => {
    test("should return artwork data URL when state and image exist", async () => {
      // Mock successful R2 responses
      global.fetch = mock(async (url: string) => {
        if (url.includes("state/global.json")) {
          return new Response(
            JSON.stringify({
              prevHash: "test-hash",
              lastTs: "2025-11-10T00:00:00Z",
              imageUrl: "https://test.r2.dev/images/test.webp",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (url.includes("images/test.webp")) {
          const buffer = new TextEncoder().encode("mock image data").buffer;
          return new Response(buffer, {
            status: 200,
            headers: { "Content-Type": "image/webp" },
          });
        }

        return new Response(null, { status: 404 });
      }) as unknown as typeof fetch;

      const result = await getArtworkDataUrl(mockR2Domain);

      expect(result.fallbackUsed).toBe(false);
      expect(result.dataUrl).toStartWith("data:image/webp;base64,");
    });

    test("should use fallback when state fetch fails", async () => {
      // Mock failed state fetch but successful placeholder
      global.fetch = mock(async (url: string) => {
        if (url.includes("state/global.json")) {
          return new Response(null, { status: 500 });
        }

        if (url.includes("placeholder-painting.webp")) {
          const buffer = new TextEncoder().encode("placeholder").buffer;
          return new Response(buffer, {
            status: 200,
            headers: { "Content-Type": "image/webp" },
          });
        }

        return new Response(null, { status: 404 });
      }) as unknown as typeof fetch;

      const result = await getArtworkDataUrl(mockR2Domain);

      expect(result.fallbackUsed).toBe(true);
      expect(result.dataUrl).toStartWith("data:image/webp;base64,");
    });

    test("should use fallback when state has no imageUrl", async () => {
      // Mock state without imageUrl
      global.fetch = mock(async (url: string) => {
        if (url.includes("state/global.json")) {
          return new Response(
            JSON.stringify({
              prevHash: "test-hash",
              lastTs: "2025-11-10T00:00:00Z",
              imageUrl: null,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (url.includes("placeholder-painting.webp")) {
          const buffer = new TextEncoder().encode("placeholder").buffer;
          return new Response(buffer, {
            status: 200,
            headers: { "Content-Type": "image/webp" },
          });
        }

        return new Response(null, { status: 404 });
      }) as unknown as typeof fetch;

      const result = await getArtworkDataUrl(mockR2Domain);

      expect(result.fallbackUsed).toBe(true);
      expect(result.dataUrl).toStartWith("data:image/webp;base64,");
    });

    test("should use fallback when image fetch fails", async () => {
      // Mock successful state but failed image fetch
      global.fetch = mock(async (url: string) => {
        if (url.includes("state/global.json")) {
          return new Response(
            JSON.stringify({
              prevHash: "test-hash",
              lastTs: "2025-11-10T00:00:00Z",
              imageUrl: "https://test.r2.dev/images/test.webp",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (url.includes("images/test.webp")) {
          return new Response(null, { status: 404 });
        }

        if (url.includes("placeholder-painting.webp")) {
          const buffer = new TextEncoder().encode("placeholder").buffer;
          return new Response(buffer, {
            status: 200,
            headers: { "Content-Type": "image/webp" },
          });
        }

        return new Response(null, { status: 404 });
      }) as unknown as typeof fetch;

      const result = await getArtworkDataUrl(mockR2Domain);

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

      const dataUrl = await getPlaceholderDataUrl(mockR2Domain);

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

      const dataUrl = await getPlaceholderDataUrl(mockR2Domain);

      expect(dataUrl).toStartWith("data:image/webp;base64,");

      // Verify binary data is preserved
      const base64Part = dataUrl.split(",")[1];
      const decoded = Buffer.from(base64Part, "base64");
      expect(Array.from(new Uint8Array(decoded))).toEqual([0xff, 0xd8, 0xff, 0xe0]);
    });
  });
});
