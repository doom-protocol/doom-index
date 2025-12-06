/**
 * HTTP utilities for caching, conditional requests, and binary data handling
 */

import { R2_IMAGE_CACHE_TTL_SECONDS } from "@/constants";

/**
 * Cache control configuration for different use cases
 */
export type CacheControlConfig = {
  /** Browser cache duration in seconds */
  browserMaxAge: number;
  /** CDN (s-maxage) cache duration in seconds */
  cdnMaxAge: number;
  /** Stale-while-revalidate duration in seconds */
  staleWhileRevalidate: number;
  /** Whether content is immutable */
  immutable: boolean;
};

/**
 * Default cache control config for immutable images
 */
export const IMMUTABLE_IMAGE_CACHE_CONFIG: CacheControlConfig = {
  browserMaxAge: R2_IMAGE_CACHE_TTL_SECONDS, // 1 day
  cdnMaxAge: R2_IMAGE_CACHE_TTL_SECONDS * 7, // 7 days for CDN
  staleWhileRevalidate: R2_IMAGE_CACHE_TTL_SECONDS, // 1 day
  immutable: true,
};

/**
 * Build Cache-Control header from config
 *
 * @param config - Cache control configuration
 * @returns Formatted Cache-Control header value
 *
 * @example
 * buildCacheControlHeader(IMMUTABLE_IMAGE_CACHE_CONFIG)
 * // => "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400, immutable"
 */
export function buildCacheControlHeader(config: CacheControlConfig = IMMUTABLE_IMAGE_CACHE_CONFIG): string {
  const parts = [
    "public",
    `max-age=${config.browserMaxAge}`,
    `s-maxage=${config.cdnMaxAge}`,
    `stale-while-revalidate=${config.staleWhileRevalidate}`,
  ];

  if (config.immutable) {
    parts.push("immutable");
  }

  return parts.join(", ");
}

/**
 * Generate ETag from cache key and content size
 * Uses a simple but deterministic hash for efficiency
 *
 * @param identifier - Unique identifier (e.g., cache key)
 * @param size - Content size in bytes
 * @returns ETag string in quoted format
 *
 * @example
 * generateETag("r2:route:images/2025/01/01/image.webp", 12345)
 * // => '"a1b2c3d4-3039"'
 */
export function generateETag(identifier: string, size: number): string {
  const hash = identifier.split("").reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
  }, 0);
  return `"${Math.abs(hash).toString(16)}-${size.toString(16)}"`;
}

/**
 * Check if request has matching ETag (conditional request)
 * Supports If-None-Match header with multiple ETags
 *
 * @param req - Incoming request
 * @param etag - Server's ETag for the resource
 * @returns true if client's ETag matches (should return 304)
 *
 * @example
 * const etag = generateETag(cacheKey, body.length);
 * if (shouldReturn304(req, etag)) {
 *   return new Response(null, { status: 304 });
 * }
 */
export function shouldReturn304(req: Request, etag: string): boolean {
  const ifNoneMatch = req.headers.get("If-None-Match");
  if (!ifNoneMatch) return false;

  // Handle multiple ETags separated by comma
  const clientETags = ifNoneMatch.split(",").map(e => e.trim());
  return clientETags.includes(etag) || clientETags.includes("*");
}

/**
 * Create a 304 Not Modified response with appropriate headers
 *
 * @param etag - ETag for the resource
 * @param cacheConfig - Cache control configuration
 * @returns 304 Response
 */
export function create304Response(
  etag: string,
  cacheConfig: CacheControlConfig = IMMUTABLE_IMAGE_CACHE_CONFIG,
): Response {
  return new Response(null, {
    status: 304,
    headers: {
      ETag: etag,
      "Cache-Control": buildCacheControlHeader(cacheConfig),
    },
  });
}

/**
 * Convert ArrayBuffer to Base64 string safely
 * Handles large buffers without stack overflow
 *
 * @param buffer - ArrayBuffer to convert
 * @returns Base64 encoded string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);
  let binaryString = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binaryString += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binaryString);
}

/**
 * Convert Base64 string to Uint8Array
 *
 * @param base64 - Base64 encoded string
 * @returns Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

/**
 * Build response headers for binary content
 *
 * @param contentType - MIME type
 * @param contentLength - Content length in bytes
 * @param etag - Optional ETag
 * @param cacheConfig - Cache control configuration
 * @returns Headers object
 */
export function buildBinaryResponseHeaders(
  contentType: string,
  contentLength: number,
  etag?: string,
  cacheConfig: CacheControlConfig = IMMUTABLE_IMAGE_CACHE_CONFIG,
): Headers {
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Length", contentLength.toString());
  headers.set("Cache-Control", buildCacheControlHeader(cacheConfig));
  if (etag) {
    headers.set("ETag", etag);
  }
  return headers;
}
