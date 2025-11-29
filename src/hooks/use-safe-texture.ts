"use client";

import { useMemo } from "react";
import { TextureLoader, type Texture } from "three";
import { logger } from "@/utils/logger";

// ============================================================================
// Types
// ============================================================================

type CrossOrigin = "" | "anonymous" | "use-credentials";

type UseSafeTextureOptions = {
  /** TextureLoader.setCrossOrigin value. Default "" (no CORS) */
  crossOrigin?: CrossOrigin;
  /** Transform URL if needed */
  transformUrl?: (url: string) => string;
  /** Called when texture is loaded */
  onLoad?: (texture: Texture | Texture[]) => void;
  /** Called when error occurs */
  onError?: (error: Error, url: string) => void;
  /** Enable debug logging */
  debug?: boolean;
};

// ============================================================================
// Texture Cache (Suspense-compatible)
// ============================================================================

type CacheEntry =
  | { status: "pending"; promise: Promise<Texture> }
  | { status: "resolved"; texture: Texture }
  | { status: "rejected"; error: Error; url: string };

const textureCache = new Map<string, CacheEntry>();

/** Create a texture loader with options */
function createLoader(crossOrigin: CrossOrigin): TextureLoader {
  const loader = new TextureLoader();
  if (crossOrigin) {
    loader.setCrossOrigin(crossOrigin);
  }
  return loader;
}

/** Load a single texture with caching and Suspense support */
function loadTexture(url: string, crossOrigin: CrossOrigin): Texture {
  const cacheKey = `${crossOrigin}:${url}`;
  const cached = textureCache.get(cacheKey);

  if (cached) {
    switch (cached.status) {
      case "resolved":
        return cached.texture;
      case "rejected":
        // Log error when re-throwing cached error
        logger.error("[useSafeTexture] Texture load failed (cached):", {
          url: cached.url,
          error: cached.error.message,
        });
        throw cached.error;
      case "pending":
        throw cached.promise;
    }
  }

  // Create new loading promise
  const loader = createLoader(crossOrigin);
  const promise = new Promise<Texture>((resolve, reject) => {
    loader.load(
      url,
      texture => {
        logger.debug("[useSafeTexture] Texture loaded successfully:", { url });
        textureCache.set(cacheKey, { status: "resolved", texture });
        resolve(texture);
      },
      undefined,
      err => {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error("[useSafeTexture] Texture load failed:", {
          url,
          error: error.message,
          crossOrigin: crossOrigin || "(none)",
        });
        textureCache.set(cacheKey, { status: "rejected", error, url });
        reject(error);
      },
    );
  });

  textureCache.set(cacheKey, { status: "pending", promise });
  throw promise;
}

/** Clear texture cache (useful for testing or memory management) */
export function clearTextureCache(): void {
  textureCache.clear();
}

// ============================================================================
// Type Overloads (drei-compatible)
// ============================================================================

// Internal callback type for implementation
type InternalCallback = (texture: Texture | Texture[] | Record<string, Texture>) => void;

/**
 * Safe texture loader using THREE.TextureLoader directly.
 * Suspense-compatible - throws Promise while loading (use with <Suspense>).
 * API-compatible with @react-three/drei's useTexture.
 *
 * @example
 * // Single URL
 * const texture = useSafeTexture("/path/to/image.jpg");
 *
 * // With callback
 * const texture = useSafeTexture("/path/to/image.jpg", (tex) => {
 *   tex.colorSpace = SRGBColorSpace;
 * });
 *
 * // Array of URLs
 * const [tex1, tex2] = useSafeTexture(["/img1.jpg", "/img2.jpg"]);
 *
 * // Object of URLs
 * const { diffuse, normal } = useSafeTexture({
 *   diffuse: "/diffuse.jpg",
 *   normal: "/normal.jpg",
 * });
 */
// Single URL with callback
export function useSafeTexture(url: string, onLoad: (texture: Texture) => void): Texture;
// Single URL with options
export function useSafeTexture(url: string, options?: UseSafeTextureOptions): Texture;
// Array of URLs with callback
export function useSafeTexture(urls: string[], onLoad: (textures: Texture[]) => void): Texture[];
// Array of URLs with options
export function useSafeTexture(urls: string[], options?: UseSafeTextureOptions): Texture[];
// Object of URLs with callback
export function useSafeTexture<T extends Record<string, string>>(
  urls: T,
  onLoad: (textures: { [K in keyof T]: Texture }) => void,
): { [K in keyof T]: Texture };
// Object of URLs with options
export function useSafeTexture<T extends Record<string, string>>(
  urls: T,
  options?: UseSafeTextureOptions,
): { [K in keyof T]: Texture };
// Implementation
export function useSafeTexture(
  input: string | string[] | Record<string, string>,
  optionsOrCallback?:
    | UseSafeTextureOptions
    | ((texture: Texture) => void)
    | ((textures: Texture[]) => void)
    | ((textures: Record<string, Texture>) => void),
): Texture | Texture[] | Record<string, Texture> {
  // Parse options
  const isCallback = typeof optionsOrCallback === "function";
  const options = isCallback ? {} : (optionsOrCallback ?? {});
  const onLoadCallback = isCallback ? optionsOrCallback : options.onLoad;

  const { crossOrigin = "", transformUrl, onError, debug = process.env.NODE_ENV === "development" } = options;

  // Transform URLs
  const transform = (url: string) => transformUrl?.(url) ?? url;

  // Load textures based on input type
  const result = useMemo(() => {
    try {
      // Single URL
      if (typeof input === "string") {
        const url = transform(input);
        const texture = loadTexture(url, crossOrigin);

        if (debug) {
          logger.debug("[useSafeTexture] Loaded single texture:", { url });
        }
        return texture;
      }

      // Array of URLs
      if (Array.isArray(input)) {
        const textures = input.map(url => loadTexture(transform(url), crossOrigin));

        if (debug) {
          logger.debug("[useSafeTexture] Loaded texture array:", { count: textures.length });
        }
        return textures;
      }

      // Object of URLs
      const entries = Object.entries(input);
      const textures: Record<string, Texture> = {};
      for (const [key, url] of entries) {
        textures[key] = loadTexture(transform(url), crossOrigin);
      }

      if (debug) {
        logger.debug("[useSafeTexture] Loaded texture object:", { keys: Object.keys(textures) });
      }
      return textures;
    } catch (err) {
      // Re-throw Promise for Suspense
      if (err instanceof Promise) {
        throw err;
      }

      // Handle actual errors - log and notify
      const error = err instanceof Error ? err : new Error(String(err));
      const urlInfo = typeof input === "string" ? input : JSON.stringify(input);

      logger.error("[useSafeTexture] Failed to load texture:", {
        input: urlInfo,
        error: error.message,
        crossOrigin: crossOrigin || "(none)",
      });

      onError?.(error, urlInfo);
      throw error;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- transform is derived from transformUrl
  }, [input, crossOrigin, transformUrl, debug, onError]);

  // Execute onLoad callback after successful load
  useMemo(() => {
    if (result && onLoadCallback) {
      try {
        // Callback receives the same type as result
        (onLoadCallback as InternalCallback)(result);
      } catch (callbackError) {
        const err = callbackError instanceof Error ? callbackError : new Error(String(callbackError));
        logger.error("[useSafeTexture] onLoad callback error:", { error: err.message });
      }
    }
  }, [result, onLoadCallback]);

  return result;
}

// ============================================================================
// Re-export for compatibility
// ============================================================================

export type { UseSafeTextureOptions };
