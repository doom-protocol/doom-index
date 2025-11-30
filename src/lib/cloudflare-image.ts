/**
 * Cloudflare Image Transformations utility
 *
 * Provides context-aware image URL transformation using Cloudflare's Image Resizing feature.
 * @see https://developers.cloudflare.com/images/transform-images/transform-via-url/
 */

import { getBaseUrl } from "@/utils/url";

/**
 * Image transformation options
 */
export interface CloudflareImageOptions {
  /** Maximum width in pixels */
  width?: number;
  /** Maximum height in pixels */
  height?: number;
  /** Quality (1-100, default 85) */
  quality?: number;
  /** Fit mode for resizing */
  fit?: "scale-down" | "contain" | "cover" | "crop" | "pad";
  /** Output format */
  format?: "auto" | "webp" | "avif" | "jpeg" | "png";
  /** Device pixel ratio multiplier */
  dpr?: number;
  /** Sharpening (0-10, 1 recommended for downscaled images) */
  sharpen?: number;
}

/**
 * Predefined image presets for different contexts
 */
export const IMAGE_PRESETS = {
  /** Archive grid thumbnails - small, optimized for grid display */
  archiveGrid: {
    width: 480,
    fit: "cover" as const,
    quality: 75,
    format: "auto" as const,
    sharpen: 1,
  },
  /** Gallery 3D textures - medium size for WebGL rendering */
  galleryTexture: {
    width: 1024,
    fit: "scale-down" as const,
    quality: 80,
    format: "auto" as const,
  },
  /** Detail/modal view - high quality, larger size */
  modalFull: {
    width: 1600,
    fit: "scale-down" as const,
    quality: 85,
    format: "auto" as const,
  },
  /** Mobile optimized - smaller for mobile devices */
  mobile: {
    width: 640,
    fit: "scale-down" as const,
    quality: 75,
    format: "auto" as const,
    sharpen: 1,
  },
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

/**
 * Check if the current environment supports Cloudflare Image Transformations
 */
function isCloudflareTransformSupported(): boolean {
  const base = getBaseUrl();

  // Local development doesn't support transforms
  if (base.includes("localhost") || base.includes("127.0.0.1")) {
    return false;
  }

  // Preview URLs (workers.dev) don't support transforms
  if (base.includes(".workers.dev")) {
    return false;
  }

  return true;
}

/**
 * Build Cloudflare Image Transform URL parameters string
 */
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

/**
 * Transform an image URL using Cloudflare Image Transformations
 *
 * @param imageUrl - Original image URL (can be absolute or relative)
 * @param options - Transformation options
 * @returns Transformed URL or original URL if transforms not supported
 */
export function transformImageUrl(imageUrl: string, options: CloudflareImageOptions): string {
  // If transforms not supported, return original URL
  if (!isCloudflareTransformSupported()) {
    return imageUrl;
  }

  // Skip if no options provided
  if (Object.keys(options).length === 0) {
    return imageUrl;
  }

  // Skip if URL already contains transform params
  if (imageUrl.includes("/cdn-cgi/image/")) {
    return imageUrl;
  }

  const params = buildTransformParams(options);
  if (!params) {
    return imageUrl;
  }

  const base = getBaseUrl();

  // Handle absolute URLs
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    try {
      const url = new URL(imageUrl);
      // Only transform if it's from our domain
      const baseHost = new URL(base).host;
      if (url.host === baseHost || url.host.includes("doomindex")) {
        return `${url.origin}/cdn-cgi/image/${params}${url.pathname}${url.search}`;
      }
      // For external URLs, use the remote URL pattern
      return `/cdn-cgi/image/${params}/${imageUrl}`;
    } catch {
      return imageUrl;
    }
  }

  // Handle relative URLs
  const normalizedPath = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `/cdn-cgi/image/${params}${normalizedPath}`;
}

/**
 * Get transformed image URL for a specific context/preset
 *
 * @param imageUrl - Original image URL
 * @param preset - Preset name (archiveGrid, galleryTexture, modalFull, mobile)
 * @param overrides - Optional overrides for the preset options
 * @returns Transformed URL
 */
export function getImageUrlForContext(
  imageUrl: string,
  preset: ImagePreset,
  overrides?: Partial<CloudflareImageOptions>,
): string {
  const presetOptions = IMAGE_PRESETS[preset];
  const options: CloudflareImageOptions = { ...presetOptions, ...overrides };

  return transformImageUrl(imageUrl, options);
}

/**
 * Get transformed image URL with device pixel ratio consideration
 *
 * @param imageUrl - Original image URL
 * @param preset - Preset name
 * @param dpr - Device pixel ratio (defaults to 1, max 2 for performance)
 * @returns Transformed URL with DPR-adjusted width
 */
export function getImageUrlWithDpr(imageUrl: string, preset: ImagePreset, dpr: number = 1): string {
  const presetOptions = IMAGE_PRESETS[preset];
  const clampedDpr = Math.min(Math.max(dpr, 1), 2); // Clamp between 1 and 2

  const options: CloudflareImageOptions = {
    ...presetOptions,
    // Multiply width by DPR for high-resolution displays
    width: presetOptions.width ? Math.round(presetOptions.width * clampedDpr) : undefined,
  };

  return transformImageUrl(imageUrl, options);
}

/**
 * Get device pixel ratio (client-side only)
 */
export function getDevicePixelRatio(): number {
  if (typeof window === "undefined") {
    return 1;
  }
  return window.devicePixelRatio || 1;
}
