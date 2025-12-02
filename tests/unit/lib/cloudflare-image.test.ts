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

    it("should add query params for /api/r2/ paths for server-side transformation", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { buildLoaderImageUrl } = await import("@/lib/cloudflare-image");
      const result = buildLoaderImageUrl("/api/r2/paintings/test.jpg", 800);

      // /api/r2 URLs now get query params for server-side transformation
      expect(result).toContain("/api/r2/paintings/test.jpg");
      expect(result).toContain("w=800");
      expect(result).toContain("fit=scale-down");
      expect(result).toContain("fmt=auto");
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
    it("should add query params for /api/r2/ paths with DPR scaling", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { getImageUrlWithDpr, IMAGE_PRESETS } = await import("@/lib/cloudflare-image");
      const result = getImageUrlWithDpr("/api/r2/paintings/test.jpg", "galleryTexture", 2);

      const expectedWidth = Math.round(IMAGE_PRESETS.galleryTexture.width * Math.min(2, 1.5));
      expect(result).toContain(`w=${expectedWidth}`);
    });

    it("should clamp DPR to maximum of 1.5 for /api/r2/ paths", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { getImageUrlWithDpr, IMAGE_PRESETS } = await import("@/lib/cloudflare-image");
      const result = getImageUrlWithDpr("/api/r2/paintings/test.jpg", "galleryTexture", 3);

      const expectedWidth = Math.round(IMAGE_PRESETS.galleryTexture.width * 1.5);
      expect(result).toContain(`w=${expectedWidth}`);
    });

    it("should clamp DPR to minimum of 1 for /api/r2/ paths", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { getImageUrlWithDpr, IMAGE_PRESETS } = await import("@/lib/cloudflare-image");
      const result = getImageUrlWithDpr("/api/r2/paintings/test.jpg", "galleryTexture", 0.5);

      const expectedWidth = IMAGE_PRESETS.galleryTexture.width;
      expect(result).toContain(`w=${expectedWidth}`);
    });

    it("should return original URL for public directory images (non-/api/ paths)", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { getImageUrlWithDpr } = await import("@/lib/cloudflare-image");

      // Public directory images should not be transformed
      expect(getImageUrlWithDpr("/placeholder-painting.webp", "galleryTexture", 1)).toBe("/placeholder-painting.webp");
      expect(getImageUrlWithDpr("/images/test.jpg", "galleryTexture", 2)).toBe("/images/test.jpg");
      expect(getImageUrlWithDpr("/frame.glb", "galleryTexture", 1.5)).toBe("/frame.glb");
    });
  });

  describe("getTransformedTextureUrl", () => {
    it("should add query params for /api/r2/ paths with galleryTexture preset by default", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { getTransformedTextureUrl, IMAGE_PRESETS } = await import("@/lib/cloudflare-image");
      const result = getTransformedTextureUrl("/api/r2/paintings/test.jpg");

      expect(result).toContain(`w=${IMAGE_PRESETS.galleryTexture.width}`);
    });

    it("should apply DPR scaling for /api/r2/ paths", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { getTransformedTextureUrl, IMAGE_PRESETS } = await import("@/lib/cloudflare-image");
      const result = getTransformedTextureUrl("/api/r2/paintings/test.jpg", "galleryTexture", 1.5);

      const expectedWidth = Math.round(IMAGE_PRESETS.galleryTexture.width * 1.5);
      expect(result).toContain(`w=${expectedWidth}`);
    });

    it("should use specified preset for /api/r2/ paths", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { getTransformedTextureUrl, IMAGE_PRESETS } = await import("@/lib/cloudflare-image");
      const result = getTransformedTextureUrl("/api/r2/paintings/test.jpg", "modalFull", 1);

      expect(result).toContain(`w=${IMAGE_PRESETS.modalFull.width}`);
    });

    it("should return original URL for public directory images", async () => {
      mock.module("@/utils/url", () => ({
        getBaseUrl: () => "https://doomindex.fun",
      }));

      const { getTransformedTextureUrl } = await import("@/lib/cloudflare-image");

      // Public directory images should not be transformed
      expect(getTransformedTextureUrl("/placeholder-painting.webp")).toBe("/placeholder-painting.webp");
      expect(getTransformedTextureUrl("/images/test.jpg", "galleryTexture", 1.5)).toBe("/images/test.jpg");
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
      // Use /api/r2/ path since public directory images are not transformed
      const result = getImageUrlWithDpr("/api/r2/paintings/test.jpg", "galleryTexture", 3);
      const maxExpectedWidth = Math.round(IMAGE_PRESETS.galleryTexture.width * 1.5);

      expect(result).toContain(`w=${maxExpectedWidth}`);
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

  describe("texture-load-timing", () => {
    /**
     * Tests for texture load timing measurement functions
     * These tests guarantee the timing measurement logic is correct
     */

    it("should measure texture load duration correctly", async () => {
      const { measureTextureLoadDuration } = await import("@/lib/cloudflare-image");

      const startTime = 1000;
      const url = "/api/r2/paintings/test.webp";
      const paintingId = "test-painting-1";

      // Mock now() to return 1500 (500ms elapsed)
      const mockNow = () => 1500;

      const result = measureTextureLoadDuration(startTime, url, paintingId, mockNow);

      expect(result.durationMs).toBe(500);
      expect(result.url).toBe(url);
      expect(result.paintingId).toBe(paintingId);
    });

    it("should handle undefined paintingId", async () => {
      const { measureTextureLoadDuration } = await import("@/lib/cloudflare-image");

      const startTime = 0;
      const url = "/test.webp";
      const mockNow = () => 100;

      const result = measureTextureLoadDuration(startTime, url, undefined, mockNow);

      expect(result.durationMs).toBe(100);
      expect(result.url).toBe(url);
      expect(result.paintingId).toBeUndefined();
    });

    it("should use performance.now by default", async () => {
      const { measureTextureLoadDuration } = await import("@/lib/cloudflare-image");

      const startTime = performance.now();
      const url = "/test.webp";

      // Small delay to ensure measurable duration
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = measureTextureLoadDuration(startTime, url);

      // Duration should be at least 10ms (the delay we added)
      expect(result.durationMs).toBeGreaterThanOrEqual(10);
      // Duration should be reasonable (less than 100ms for this simple operation)
      expect(result.durationMs).toBeLessThan(100);
    });

    it("should check if texture load is within threshold", async () => {
      const { isTextureLoadWithinThreshold, TEXTURE_LOAD_THRESHOLD_MS } = await import("@/lib/cloudflare-image");

      // Within default threshold
      expect(isTextureLoadWithinThreshold(1000)).toBe(true);
      expect(isTextureLoadWithinThreshold(TEXTURE_LOAD_THRESHOLD_MS)).toBe(true);

      // Exceeds default threshold
      expect(isTextureLoadWithinThreshold(TEXTURE_LOAD_THRESHOLD_MS + 1)).toBe(false);
      expect(isTextureLoadWithinThreshold(10000)).toBe(false);
    });

    it("should check if texture load is within custom threshold", async () => {
      const { isTextureLoadWithinThreshold } = await import("@/lib/cloudflare-image");

      // Custom threshold of 2000ms
      expect(isTextureLoadWithinThreshold(1500, 2000)).toBe(true);
      expect(isTextureLoadWithinThreshold(2000, 2000)).toBe(true);
      expect(isTextureLoadWithinThreshold(2001, 2000)).toBe(false);
    });

    it("should have reasonable default threshold for texture loading", async () => {
      const { TEXTURE_LOAD_THRESHOLD_MS } = await import("@/lib/cloudflare-image");

      // Threshold should be reasonable for web texture loading
      // At least 1 second to account for network latency
      expect(TEXTURE_LOAD_THRESHOLD_MS).toBeGreaterThanOrEqual(1000);
      // At most 10 seconds to ensure reasonable UX
      expect(TEXTURE_LOAD_THRESHOLD_MS).toBeLessThanOrEqual(10000);
    });

    it("should not add overhead to timing measurement", async () => {
      const { measureTextureLoadDuration } = await import("@/lib/cloudflare-image");

      // Track how many times now() is called
      let callCount = 0;
      const mockNow = () => {
        callCount++;
        return 1000;
      };

      measureTextureLoadDuration(500, "/test.webp", "test-id", mockNow);

      // Should only call now() once (to get end time)
      expect(callCount).toBe(1);
    });

    it("should return correct timing result structure", async () => {
      const { measureTextureLoadDuration } = await import("@/lib/cloudflare-image");

      const result = measureTextureLoadDuration(0, "/test.webp", "test-id", () => 250);

      // Verify result structure
      expect(typeof result.durationMs).toBe("number");
      expect(typeof result.url).toBe("string");
      expect(result).toHaveProperty("paintingId");
    });
  });

  describe("buildApiR2TransformQuery", () => {
    it("should build query string with width", async () => {
      const { buildApiR2TransformQuery } = await import("@/lib/cloudflare-image");
      const result = buildApiR2TransformQuery({ width: 512 });
      expect(result).toBe("w=512");
    });

    it("should build query string with multiple options", async () => {
      const { buildApiR2TransformQuery } = await import("@/lib/cloudflare-image");
      const result = buildApiR2TransformQuery({
        width: 512,
        height: 384,
        quality: 75,
        fit: "scale-down",
        format: "auto",
      });
      expect(result).toContain("w=512");
      expect(result).toContain("h=384");
      expect(result).toContain("q=75");
      expect(result).toContain("fit=scale-down");
      expect(result).toContain("fmt=auto");
    });

    it("should include dpr only when not 1", async () => {
      const { buildApiR2TransformQuery } = await import("@/lib/cloudflare-image");

      const resultWithDpr1 = buildApiR2TransformQuery({ width: 512, dpr: 1 });
      expect(resultWithDpr1).not.toContain("dpr");

      const resultWithDpr2 = buildApiR2TransformQuery({ width: 512, dpr: 2 });
      expect(resultWithDpr2).toContain("dpr=2");
    });

    it("should include sharpen when provided", async () => {
      const { buildApiR2TransformQuery } = await import("@/lib/cloudflare-image");
      const result = buildApiR2TransformQuery({ width: 512, sharpen: 5 });
      expect(result).toContain("sharpen=5");
    });

    it("should return empty string when no options provided", async () => {
      const { buildApiR2TransformQuery } = await import("@/lib/cloudflare-image");
      const result = buildApiR2TransformQuery({});
      expect(result).toBe("");
    });
  });

  describe("parseApiR2TransformParams", () => {
    it("should parse width parameter", async () => {
      const { parseApiR2TransformParams } = await import("@/lib/cloudflare-image");
      const url = new URL("https://example.com/api/r2/test.jpg?w=512");
      const result = parseApiR2TransformParams(url);
      expect(result).toEqual({ width: 512 });
    });

    it("should parse multiple parameters", async () => {
      const { parseApiR2TransformParams } = await import("@/lib/cloudflare-image");
      const url = new URL("https://example.com/api/r2/test.jpg?w=512&h=384&q=75&fit=scale-down&fmt=auto");
      const result = parseApiR2TransformParams(url);
      expect(result).toEqual({
        width: 512,
        height: 384,
        quality: 75,
        fit: "scale-down",
        format: "auto",
      });
    });

    it("should parse dpr parameter", async () => {
      const { parseApiR2TransformParams } = await import("@/lib/cloudflare-image");
      const url = new URL("https://example.com/api/r2/test.jpg?w=512&dpr=2");
      const result = parseApiR2TransformParams(url);
      expect(result).toEqual({ width: 512, dpr: 2 });
    });

    it("should parse sharpen parameter", async () => {
      const { parseApiR2TransformParams } = await import("@/lib/cloudflare-image");
      const url = new URL("https://example.com/api/r2/test.jpg?w=512&sharpen=5");
      const result = parseApiR2TransformParams(url);
      expect(result).toEqual({ width: 512, sharpen: 5 });
    });

    it("should return null when no transform params present", async () => {
      const { parseApiR2TransformParams } = await import("@/lib/cloudflare-image");
      const url = new URL("https://example.com/api/r2/test.jpg");
      const result = parseApiR2TransformParams(url);
      expect(result).toBeNull();
    });

    it("should clamp width to valid range (0-4096)", async () => {
      const { parseApiR2TransformParams } = await import("@/lib/cloudflare-image");

      // Width too large
      const urlLarge = new URL("https://example.com/api/r2/test.jpg?w=5000");
      const resultLarge = parseApiR2TransformParams(urlLarge);
      expect(resultLarge).toBeNull();

      // Width zero or negative
      const urlZero = new URL("https://example.com/api/r2/test.jpg?w=0");
      const resultZero = parseApiR2TransformParams(urlZero);
      expect(resultZero).toBeNull();
    });

    it("should clamp quality to valid range (1-100)", async () => {
      const { parseApiR2TransformParams } = await import("@/lib/cloudflare-image");

      // Quality too large
      const urlLarge = new URL("https://example.com/api/r2/test.jpg?q=150");
      const resultLarge = parseApiR2TransformParams(urlLarge);
      expect(resultLarge).toBeNull();

      // Quality zero
      const urlZero = new URL("https://example.com/api/r2/test.jpg?q=0");
      const resultZero = parseApiR2TransformParams(urlZero);
      expect(resultZero).toBeNull();
    });

    it("should clamp dpr to valid range (1-3)", async () => {
      const { parseApiR2TransformParams } = await import("@/lib/cloudflare-image");

      // DPR too large
      const urlLarge = new URL("https://example.com/api/r2/test.jpg?dpr=5");
      const resultLarge = parseApiR2TransformParams(urlLarge);
      expect(resultLarge).toBeNull();

      // DPR too small
      const urlSmall = new URL("https://example.com/api/r2/test.jpg?dpr=0.5");
      const resultSmall = parseApiR2TransformParams(urlSmall);
      expect(resultSmall).toBeNull();
    });

    it("should validate fit values", async () => {
      const { parseApiR2TransformParams } = await import("@/lib/cloudflare-image");

      // Valid fit values
      const validFits = ["scale-down", "contain", "cover", "crop", "pad"] as const;
      for (const fit of validFits) {
        const url = new URL(`https://example.com/api/r2/test.jpg?fit=${fit}`);
        const result = parseApiR2TransformParams(url);
        expect(result?.fit).toBe(fit);
      }

      // Invalid fit value
      const urlInvalid = new URL("https://example.com/api/r2/test.jpg?fit=invalid");
      const resultInvalid = parseApiR2TransformParams(urlInvalid);
      expect(resultInvalid).toBeNull();
    });

    it("should validate format values", async () => {
      const { parseApiR2TransformParams } = await import("@/lib/cloudflare-image");

      // Valid format values
      const validFormats = ["auto", "webp", "avif", "jpeg", "png"] as const;
      for (const fmt of validFormats) {
        const url = new URL(`https://example.com/api/r2/test.jpg?fmt=${fmt}`);
        const result = parseApiR2TransformParams(url);
        expect(result?.format).toBe(fmt);
      }

      // Invalid format value
      const urlInvalid = new URL("https://example.com/api/r2/test.jpg?fmt=gif");
      const resultInvalid = parseApiR2TransformParams(urlInvalid);
      expect(resultInvalid).toBeNull();
    });
  });
});
