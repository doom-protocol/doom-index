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
});
