import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

describe("cloudflare-image", () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    mock.restore();
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    mock.restore();
    globalThis.window = originalWindow;
  });

  describe("buildLoaderImageUrl", () => {
    it("should return original src when base URL is localhost", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "http://localhost:8787",
      }));

      const { buildLoaderImageUrl } = await import("@/lib/cloudflare-image");
      const result = buildLoaderImageUrl("/api/r2/test.jpg", 800);

      expect(result).toBe("/api/r2/test.jpg");
    });

    it("should return original src when base URL is 127.0.0.1", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "http://127.0.0.1:3000",
      }));

      const { buildLoaderImageUrl } = await import("@/lib/cloudflare-image");
      const result = buildLoaderImageUrl("/images/test.jpg", 800);

      expect(result).toBe("/images/test.jpg");
    });

    it("should return original src when base URL is preview (.workers.dev)", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://preview-doom-index.yamadaasuma.workers.dev",
      }));

      const { buildLoaderImageUrl } = await import("@/lib/cloudflare-image");
      const result = buildLoaderImageUrl("/images/test.jpg", 800);

      expect(result).toBe("/images/test.jpg");
    });

    it("should return original src when src starts with http://", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { buildLoaderImageUrl } = await import("@/lib/cloudflare-image");
      const result = buildLoaderImageUrl("http://example.com/image.jpg", 800);

      expect(result).toBe("http://example.com/image.jpg");
    });

    it("should return original src when src starts with https://", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { buildLoaderImageUrl } = await import("@/lib/cloudflare-image");
      const result = buildLoaderImageUrl("https://example.com/image.jpg", 800);

      expect(result).toBe("https://example.com/image.jpg");
    });

    it("should return original src when src starts with /api/r2/", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { buildLoaderImageUrl } = await import("@/lib/cloudflare-image");
      const result = buildLoaderImageUrl("/api/r2/paintings/test.jpg", 800);

      expect(result).toBe("/api/r2/paintings/test.jpg");
    });

    it("should transform relative path in production", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { buildLoaderImageUrl } = await import("@/lib/cloudflare-image");
      const result = buildLoaderImageUrl("/images/test.jpg", 800);

      expect(result).toContain("/cdn-cgi/image/");
      expect(result).toContain("width=800");
      expect(result).toContain("fit=scale-down");
      expect(result).toContain("format=auto");
    });

    it("should include quality parameter when provided", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { buildLoaderImageUrl } = await import("@/lib/cloudflare-image");
      const result = buildLoaderImageUrl("/images/test.jpg", 800, 75);

      expect(result).toContain("quality=75");
    });
  });

  describe("transformImageUrl", () => {
    it("should return original URL when in local environment", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "http://localhost:8787",
      }));

      const { transformImageUrl } = await import("@/lib/cloudflare-image");
      const result = transformImageUrl("/images/test.jpg", { width: 800 });

      expect(result).toBe("/images/test.jpg");
    });

    it("should return original URL when in preview environment", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://preview.workers.dev",
      }));

      const { transformImageUrl } = await import("@/lib/cloudflare-image");
      const result = transformImageUrl("/images/test.jpg", { width: 800 });

      expect(result).toBe("/images/test.jpg");
    });

    it("should return original URL when options are empty", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { transformImageUrl } = await import("@/lib/cloudflare-image");
      const result = transformImageUrl("/images/test.jpg", {});

      expect(result).toBe("/images/test.jpg");
    });

    it("should return original URL when already transformed", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { transformImageUrl } = await import("@/lib/cloudflare-image");
      const result = transformImageUrl("/cdn-cgi/image/width=800/images/test.jpg", { width: 400 });

      expect(result).toBe("/cdn-cgi/image/width=800/images/test.jpg");
    });

    it("should transform relative path with all options", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { transformImageUrl } = await import("@/lib/cloudflare-image");
      const result = transformImageUrl("/images/test.jpg", {
        width: 800,
        height: 600,
        quality: 80,
        fit: "cover",
        format: "webp",
      });

      expect(result).toContain("/cdn-cgi/image/");
      expect(result).toContain("width=800");
      expect(result).toContain("height=600");
      expect(result).toContain("quality=80");
      expect(result).toContain("fit=cover");
      expect(result).toContain("format=webp");
    });
  });

  describe("getImageUrlWithDpr", () => {
    it("should scale width by DPR", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { getImageUrlWithDpr, IMAGE_PRESETS } = await import("@/lib/cloudflare-image");
      const result = getImageUrlWithDpr("/images/test.jpg", "galleryTexture", 2);

      const expectedWidth = Math.round(IMAGE_PRESETS.galleryTexture.width * Math.min(2, 1.5));
      expect(result).toContain(`width=${expectedWidth}`);
    });

    it("should clamp DPR to maximum of 1.5", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { getImageUrlWithDpr, IMAGE_PRESETS } = await import("@/lib/cloudflare-image");
      const result = getImageUrlWithDpr("/images/test.jpg", "galleryTexture", 3);

      const expectedWidth = Math.round(IMAGE_PRESETS.galleryTexture.width * 1.5);
      expect(result).toContain(`width=${expectedWidth}`);
    });

    it("should clamp DPR to minimum of 1", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { getImageUrlWithDpr, IMAGE_PRESETS } = await import("@/lib/cloudflare-image");
      const result = getImageUrlWithDpr("/images/test.jpg", "galleryTexture", 0.5);

      const expectedWidth = IMAGE_PRESETS.galleryTexture.width;
      expect(result).toContain(`width=${expectedWidth}`);
    });
  });

  describe("getTransformedTextureUrl", () => {
    it("should use galleryTexture preset by default", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { getTransformedTextureUrl, IMAGE_PRESETS } = await import("@/lib/cloudflare-image");
      const result = getTransformedTextureUrl("/images/test.jpg");

      expect(result).toContain(`width=${IMAGE_PRESETS.galleryTexture.width}`);
    });

    it("should apply DPR scaling", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { getTransformedTextureUrl, IMAGE_PRESETS } = await import("@/lib/cloudflare-image");
      const result = getTransformedTextureUrl("/images/test.jpg", "galleryTexture", 1.5);

      const expectedWidth = Math.round(IMAGE_PRESETS.galleryTexture.width * 1.5);
      expect(result).toContain(`width=${expectedWidth}`);
    });

    it("should use specified preset", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { getTransformedTextureUrl, IMAGE_PRESETS } = await import("@/lib/cloudflare-image");
      const result = getTransformedTextureUrl("/images/test.jpg", "modalFull", 1);

      expect(result).toContain(`width=${IMAGE_PRESETS.modalFull.width}`);
    });
  });

  describe("getDevicePixelRatio", () => {
    it("should return 1 when window is undefined (server-side)", async () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error - intentionally setting window to undefined for testing
      globalThis.window = undefined;

      const { getDevicePixelRatio } = await import("@/lib/cloudflare-image");
      const result = getDevicePixelRatio();

      expect(result).toBe(1);

      globalThis.window = originalWindow;
    });

    it("should return window.devicePixelRatio when available", async () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error - mocking window for testing
      globalThis.window = { devicePixelRatio: 2 };

      const { getDevicePixelRatio } = await import("@/lib/cloudflare-image");
      const result = getDevicePixelRatio();

      expect(result).toBe(2);

      globalThis.window = originalWindow;
    });

    it("should return 1 when devicePixelRatio is 0 or falsy", async () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error - mocking window for testing
      globalThis.window = { devicePixelRatio: 0 };

      const { getDevicePixelRatio } = await import("@/lib/cloudflare-image");
      const result = getDevicePixelRatio();

      expect(result).toBe(1);

      globalThis.window = originalWindow;
    });
  });

  describe("IMAGE_PRESETS", () => {
    it("should have all expected presets", async () => {
      const { IMAGE_PRESETS } = await import("@/lib/cloudflare-image");

      expect(IMAGE_PRESETS.archiveGrid).toBeDefined();
      expect(IMAGE_PRESETS.galleryTexture).toBeDefined();
      expect(IMAGE_PRESETS.galleryTextureHigh).toBeDefined();
      expect(IMAGE_PRESETS.modalFull).toBeDefined();
      expect(IMAGE_PRESETS.mobile).toBeDefined();
    });

    it("should have correct archiveGrid preset values", async () => {
      const { IMAGE_PRESETS } = await import("@/lib/cloudflare-image");

      expect(IMAGE_PRESETS.archiveGrid.width).toBe(320);
      expect(IMAGE_PRESETS.archiveGrid.fit).toBe("cover");
      expect(IMAGE_PRESETS.archiveGrid.quality).toBe(70);
      expect(IMAGE_PRESETS.archiveGrid.format).toBe("auto");
    });

    it("should have correct galleryTexture preset values", async () => {
      const { IMAGE_PRESETS } = await import("@/lib/cloudflare-image");

      expect(IMAGE_PRESETS.galleryTexture.width).toBe(512);
      expect(IMAGE_PRESETS.galleryTexture.fit).toBe("scale-down");
      expect(IMAGE_PRESETS.galleryTexture.quality).toBe(75);
      expect(IMAGE_PRESETS.galleryTexture.format).toBe("auto");
    });
  });

  describe("performance-guarantees", () => {
    /**
     * Performance guarantee tests for image transformation
     * These tests ensure image sizes stay within reasonable bounds for optimal TTFB
     */

    it("should keep galleryTexture width under 1024px for fast initial load", async () => {
      const { IMAGE_PRESETS } = await import("@/lib/cloudflare-image");

      // Gallery texture should be optimized for fast initial load
      // Max 1024px width ensures reasonable file size and decode time
      expect(IMAGE_PRESETS.galleryTexture.width).toBeLessThanOrEqual(1024);
    });

    it("should keep archiveGrid width under 480px for fast grid loading", async () => {
      const { IMAGE_PRESETS } = await import("@/lib/cloudflare-image");

      // Archive grid thumbnails should be small for fast grid loading
      expect(IMAGE_PRESETS.archiveGrid.width).toBeLessThanOrEqual(480);
    });

    it("should keep modalFull width under 1600px for reasonable detail view", async () => {
      const { IMAGE_PRESETS } = await import("@/lib/cloudflare-image");

      // Modal full view can be larger but should stay reasonable
      expect(IMAGE_PRESETS.modalFull.width).toBeLessThanOrEqual(1600);
    });

    it("should clamp DPR to 1.5 to prevent excessive image sizes", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { getImageUrlWithDpr, IMAGE_PRESETS } = await import("@/lib/cloudflare-image");

      // Even with DPR of 3, the effective DPR should be clamped to 1.5
      const result = getImageUrlWithDpr("/images/test.jpg", "galleryTexture", 3);
      const maxExpectedWidth = Math.round(IMAGE_PRESETS.galleryTexture.width * 1.5);

      expect(result).toContain(`width=${maxExpectedWidth}`);
      // Ensure we never exceed 1.5x the base width
      expect(maxExpectedWidth).toBeLessThanOrEqual(IMAGE_PRESETS.galleryTexture.width * 1.5);
    });

    it("should ensure maximum transformed width stays under 2048px", async () => {
      const { IMAGE_PRESETS } = await import("@/lib/cloudflare-image");

      // With max DPR of 1.5, no preset should exceed 2048px
      const maxDpr = 1.5;
      for (const [_presetName, preset] of Object.entries(IMAGE_PRESETS)) {
        const maxWidth = Math.round(preset.width * maxDpr);
        expect(maxWidth).toBeLessThanOrEqual(2048);
      }
    });

    it("should use quality values between 70-85 for optimal size/quality balance", async () => {
      const { IMAGE_PRESETS } = await import("@/lib/cloudflare-image");

      for (const [_presetName, preset] of Object.entries(IMAGE_PRESETS)) {
        // Quality should be in the sweet spot for web images
        expect(preset.quality).toBeGreaterThanOrEqual(70);
        expect(preset.quality).toBeLessThanOrEqual(85);
      }
    });

    it("should use format=auto for automatic WebP/AVIF delivery", async () => {
      const { IMAGE_PRESETS } = await import("@/lib/cloudflare-image");

      for (const [_presetName, preset] of Object.entries(IMAGE_PRESETS)) {
        // All presets should use format=auto for best compression
        expect(preset.format).toBe("auto");
      }
    });
  });
});
