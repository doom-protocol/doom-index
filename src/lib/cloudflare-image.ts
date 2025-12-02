import { getBaseUrl } from "@/utils/url";

/**
 * Image transformation options derived from Cloudflare IMAGES binding types.
 * Combines ImageTransform fields (width, height, fit, sharpen) with
 * ImageOutputOptions fields (quality) plus client-side extras (dpr, format with "auto").
 *
 * @see ImageTransform - from cloudflare-env.d.ts (IMAGES binding)
 * @see ImageOutputOptions - from cloudflare-env.d.ts (IMAGES binding)
 */
export interface CloudflareImageOptions
  extends Pick<ImageTransform, "width" | "height" | "fit" | "sharpen">,
    Pick<ImageOutputOptions, "quality"> {
  /** Device pixel ratio for responsive images (client-side only, not sent to IMAGES binding) */
  dpr?: number;
  /** Output format - "auto" is client-side only, mapped to MIME types for IMAGES binding */
  format?: "auto" | "webp" | "avif" | "jpeg" | "png";
}

export const IMAGE_PRESETS = {
  archiveGrid: {
    width: 320,
    fit: "cover" as const,
    quality: 70,
    format: "auto" as const,
  },
  galleryTexture: {
    width: 512,
    fit: "scale-down" as const,
    quality: 75,
    format: "auto" as const,
  },
  galleryTextureHigh: {
    width: 1024,
    fit: "scale-down" as const,
    quality: 80,
    format: "auto" as const,
  },
  modalFull: {
    width: 1200,
    fit: "scale-down" as const,
    quality: 80,
    format: "auto" as const,
  },
  mobile: {
    width: 480,
    fit: "scale-down" as const,
    quality: 70,
    format: "auto" as const,
  },
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

function isCloudflareTransformSupported(): boolean {
  const base = getBaseUrl();
  if (base.includes("localhost") || base.includes("127.0.0.1")) {
    return false;
  }
  if (base.includes(".workers.dev")) {
    return false;
  }
  return true;
}

function buildTransformParams(options: CloudflareImageOptions): string {
  const params: string[] = [];

  if (options.width) params.push(`width=${options.width}`);
  if (options.height) params.push(`height=${options.height}`);
  if (options.quality) params.push(`quality=${options.quality}`);
  if (options.fit) params.push(`fit=${options.fit}`);
  if (options.format) params.push(`format=${options.format}`);
  if (options.dpr && options.dpr !== 1) params.push(`dpr=${options.dpr}`);
  if (options.sharpen) params.push(`sharpen=${options.sharpen}`);

  return params.join(",");
}

export function transformImageUrl(imageUrl: string, options: CloudflareImageOptions): string {
  if (!isCloudflareTransformSupported()) {
    return imageUrl;
  }
  if (Object.keys(options).length === 0) {
    return imageUrl;
  }
  if (imageUrl.includes("/cdn-cgi/image/")) {
    return imageUrl;
  }

  const params = buildTransformParams(options);
  if (!params) {
    return imageUrl;
  }

  const base = getBaseUrl();

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    try {
      const url = new URL(imageUrl);
      const baseHost = new URL(base).host;
      if (url.host === baseHost || url.host.includes("doomindex")) {
        return `${url.origin}/cdn-cgi/image/${params}${url.pathname}${url.search}`;
      }
      return `/cdn-cgi/image/${params}/${imageUrl}`;
    } catch {
      return imageUrl;
    }
  }

  const normalizedPath = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `/cdn-cgi/image/${params}${normalizedPath}`;
}

export function getImageUrlForContext(
  imageUrl: string,
  preset: ImagePreset,
  overrides?: Partial<CloudflareImageOptions>,
): string {
  const presetOptions = IMAGE_PRESETS[preset];
  const options: CloudflareImageOptions = { ...presetOptions, ...overrides };

  return transformImageUrl(imageUrl, options);
}

export function getImageUrlWithDpr(imageUrl: string, preset: ImagePreset, dpr: number = 1): string {
  const presetOptions = IMAGE_PRESETS[preset];
  const clampedDpr = Math.min(Math.max(dpr, 1), 1.5);
  const options: CloudflareImageOptions = {
    ...presetOptions,
    width: presetOptions.width ? Math.round(presetOptions.width * clampedDpr) : undefined,
  };

  // For /api/r2 paths: Add query params for server-side transformation
  if (imageUrl.startsWith("/api/r2/")) {
    const query = buildApiR2TransformQuery(options);
    if (query) {
      const separator = imageUrl.includes("?") ? "&" : "?";
      return `${imageUrl}${separator}${query}`;
    }
    return imageUrl;
  }

  return transformImageUrl(imageUrl, options);
}

export function getDevicePixelRatio(): number {
  if (typeof window === "undefined") {
    return 1;
  }
  return window.devicePixelRatio || 1;
}

/**
 * Build image URL for Next.js Image loader
 * Centralizes all bypass logic for local, preview, and special paths
 *
 * For /api/r2 paths: Adds query params for server-side transformation via Workers Image Resizing
 * For other paths: Uses /cdn-cgi/image/ prefix for Cloudflare Image Transformations
 *
 * @param src - Source image URL
 * @param width - Target width
 * @param quality - Optional quality (1-100)
 * @returns Transformed URL or original if bypass conditions are met
 */
export function buildLoaderImageUrl(src: string, width: number, quality?: number): string {
  const base = getBaseUrl();
  const isLocal = base.includes("localhost") || base.includes("127.0.0.1");

  // Bypass conditions: local dev or absolute URLs
  if (isLocal || src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }

  // For /api/r2 paths: Add query params for server-side transformation
  if (src.startsWith("/api/r2/")) {
    const options: CloudflareImageOptions = {
      width,
      quality,
      fit: "scale-down",
      format: "auto",
    };
    const query = buildApiR2TransformQuery(options);
    if (query) {
      const separator = src.includes("?") ? "&" : "?";
      return `${src}${separator}${query}`;
    }
    return src;
  }

  // For other paths: Use /cdn-cgi/image/ prefix (only works on production domain)
  const isPreview = base.includes(".workers.dev");
  if (isPreview) {
    return src;
  }

  return transformImageUrl(src, {
    width,
    quality,
    fit: "scale-down",
    format: "auto",
  });
}

/**
 * Get transformed texture URL for 3D rendering
 * Pure function replacement for useTransformedTextureUrl hook
 *
 * @param imageUrl - Original image URL
 * @param preset - Image preset (default: galleryTexture)
 * @param dpr - Device pixel ratio (default: 1)
 * @returns Transformed URL with appropriate size for the device
 */
export function getTransformedTextureUrl(
  imageUrl: string,
  preset: ImagePreset = "galleryTexture",
  dpr: number = 1,
): string {
  return getImageUrlWithDpr(imageUrl, preset, dpr);
}

/**
 * Result of texture load timing measurement
 */
export interface TextureLoadTimingResult {
  durationMs: number;
  url: string;
  paintingId?: string;
}

/**
 * Get current timestamp in milliseconds.
 * Uses performance.now() when available, falls back to Date.now().
 * This is safe to use in Cloudflare Workers and other edge runtimes
 * where performance.now() may throw brand check errors.
 *
 * @returns Current timestamp in milliseconds
 */
export function getTimestampMs(): number {
  try {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      return performance.now();
    }
  } catch {
    // Some runtimes (like CF Workers) can throw brand errors; ignore and fall back.
  }
  return Date.now();
}

/**
 * Measure texture load duration from start time to now.
 * Pure function for testable timing measurement.
 *
 * @param startTime - Start time from getTimestampMs()
 * @param url - Texture URL being loaded
 * @param paintingId - Optional painting ID for logging
 * @param now - Optional function to get current time (for testing)
 * @returns Timing result with duration in milliseconds
 */
export function measureTextureLoadDuration(
  startTime: number,
  url: string,
  paintingId?: string,
  now: () => number = getTimestampMs,
): TextureLoadTimingResult {
  const durationMs = now() - startTime;
  return {
    durationMs,
    url,
    paintingId,
  };
}

/**
 * Maximum acceptable texture load duration in milliseconds.
 * This threshold is used for performance monitoring and testing.
 * Includes network time + decode time, but not GPU upload.
 */
export const TEXTURE_LOAD_THRESHOLD_MS = 5000;

/**
 * Check if texture load duration is within acceptable threshold.
 * Used for performance monitoring and testing.
 *
 * @param durationMs - Measured duration in milliseconds
 * @param threshold - Maximum acceptable duration (default: TEXTURE_LOAD_THRESHOLD_MS)
 * @returns true if duration is within threshold
 */
export function isTextureLoadWithinThreshold(
  durationMs: number,
  threshold: number = TEXTURE_LOAD_THRESHOLD_MS,
): boolean {
  return durationMs <= threshold;
}

/**
 * Build query string for /api/r2 image transformation
 * Used when transforms are applied server-side via Workers Image Resizing
 *
 * @param options - Image transformation options
 * @returns Query string (without leading ?)
 */
export function buildApiR2TransformQuery(options: CloudflareImageOptions): string {
  const params = new URLSearchParams();

  if (options.width) params.set("w", String(options.width));
  if (options.height) params.set("h", String(options.height));
  if (options.quality) params.set("q", String(options.quality));
  if (options.fit) params.set("fit", options.fit);
  if (options.format) params.set("fmt", options.format);
  if (options.dpr && options.dpr !== 1) params.set("dpr", String(options.dpr));
  if (options.sharpen) params.set("sharpen", String(options.sharpen));

  return params.toString();
}

/**
 * Parse image transformation options from URL query params
 * Used by /api/r2 handler to extract transform options
 *
 * @param url - Request URL
 * @returns Parsed options or null if no transform params present
 */
export function parseApiR2TransformParams(url: URL): CloudflareImageOptions | null {
  const w = url.searchParams.get("w");
  const h = url.searchParams.get("h");
  const q = url.searchParams.get("q");
  const fit = url.searchParams.get("fit");
  const fmt = url.searchParams.get("fmt");
  const dpr = url.searchParams.get("dpr");
  const sharpen = url.searchParams.get("sharpen");

  // Return null if no transform params present
  if (!w && !h && !q && !fit && !fmt && !dpr && !sharpen) {
    return null;
  }

  const options: CloudflareImageOptions = {};

  if (w) {
    const width = Number(w);
    if (width > 0 && width <= 4096) options.width = width;
  }
  if (h) {
    const height = Number(h);
    if (height > 0 && height <= 4096) options.height = height;
  }
  if (q) {
    const quality = Number(q);
    if (quality >= 1 && quality <= 100) options.quality = quality;
  }
  if (fit && ["scale-down", "contain", "cover", "crop", "pad"].includes(fit)) {
    options.fit = fit as CloudflareImageOptions["fit"];
  }
  if (fmt && ["auto", "webp", "avif", "jpeg", "png"].includes(fmt)) {
    options.format = fmt as CloudflareImageOptions["format"];
  }
  if (dpr) {
    const dprValue = Number(dpr);
    if (dprValue >= 1 && dprValue <= 3) options.dpr = dprValue;
  }
  if (sharpen) {
    const sharpenValue = Number(sharpen);
    if (sharpenValue >= 0 && sharpenValue <= 10) options.sharpen = sharpenValue;
  }

  // Return null if all params were invalid
  if (Object.keys(options).length === 0) {
    return null;
  }

  return options;
}
