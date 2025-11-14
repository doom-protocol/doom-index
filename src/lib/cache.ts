/**
 * Cloudflare Cache API Helper
 *
 * Provides type-safe caching utilities for Cloudflare Workers environment.
 * - Key-value caching with TTL
 * - HTTP response caching
 * - Graceful fallback when Cache API is unavailable
 */

import { logger } from "@/utils/logger";

/**
 * Extend CacheStorage interface to include default property
 * Reference: https://github.com/cloudflare/worker-typescript-template/issues/8
 */
declare global {
  interface CacheStorage {
    default: Cache;
  }
}

/**
 * Cache options for cache operations
 */
export type CacheOptions = {
  ttlSeconds: number;
  namespace?: string;
  logger?: typeof logger;
};

/**
 * Resolve Cloudflare Cache API instance
 *
 * @returns Cache instance or null if unavailable
 */
export function resolveCache(): Cache | null {
  try {
    if (typeof caches === "undefined" || !caches.default) {
      logger.warn("cache.unavailable", {
        reason: "Cache is not available",
      });
      return null;
    }
    return caches.default;
  } catch {
    logger.warn("cache.unavailable", {
      reason: "Failed to resolve cache",
    });
    return null;
  }
}

/**
 * Generate cache key as URL string
 *
 * Cloudflare Cache API requires a valid URL format for cache keys.
 * `cache.local` is a dummy domain (RFC 6762 .local TLD) used solely to satisfy
 * the URL format requirement. No actual HTTP request is made to this domain.
 */
function createCacheKey(key: string, namespace?: string): string {
  const fullKey = namespace ? `${namespace}:${key}` : key;
  return `https://cache.local/${fullKey}`;
}

/**
 * Get a cached value by key
 *
 * @template T - The type of value to retrieve
 * @param key - Cache key
 * @param options - Optional cache options (namespace, logger)
 * @returns Promise resolving to the cached value or null if not found/expired
 */
export async function get<T>(key: string, options?: Omit<CacheOptions, "ttlSeconds">): Promise<T | null> {
  const log = options?.logger || logger;
  const cache = resolveCache();
  if (!cache) {
    return null;
  }

  try {
    const cacheKey = createCacheKey(key, options?.namespace);
    const response = await cache.match(cacheKey);
    if (!response) {
      log.debug("cache.miss", { key, namespace: options?.namespace });
      return null;
    }

    const data = await response.json();
    log.debug("cache.hit", { key, namespace: options?.namespace });
    return data as T;
  } catch (error) {
    log.error("cache.operation.error", {
      key,
      namespace: options?.namespace,
      operation: "get",
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Set a value in cache with TTL
 *
 * @template T - The type of value to cache
 * @param key - Cache key
 * @param value - Value to cache (must be JSON-serializable)
 * @param options - Cache options including TTL
 */
export async function set<T>(key: string, value: T, options: CacheOptions): Promise<void> {
  const log = options.logger || logger;
  const cache = resolveCache();
  if (!cache) {
    log.warn("cache.unavailable", {
      key,
      namespace: options.namespace,
      reason: "Cloudflare context not available",
    });
    return;
  }

  try {
    const cacheKey = createCacheKey(key, options.namespace);
    const response = new Response(JSON.stringify(value), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${options.ttlSeconds}`,
      },
    });

    await cache.put(cacheKey, response);
    log.debug("cache.put", {
      key,
      namespace: options.namespace,
      ttlSeconds: options.ttlSeconds,
    });
  } catch (error) {
    log.error("cache.operation.error", {
      key,
      namespace: options.namespace,
      ttlSeconds: options.ttlSeconds,
      operation: "set",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Update a cached value (overwrites existing value)
 *
 * @template T - The type of value to cache
 * @param key - Cache key
 * @param value - Value to update
 * @param options - Cache options including TTL
 */
export async function update<T>(key: string, value: T, options: CacheOptions): Promise<void> {
  await set(key, value, options);
}

/**
 * Remove a cached value by key
 *
 * @param key - Cache key to remove
 * @param options - Optional cache options (namespace, logger)
 * @returns Promise resolving to boolean (true if removed, false if not found)
 */
export async function remove(key: string, options?: Omit<CacheOptions, "ttlSeconds">): Promise<boolean> {
  const cache = resolveCache();
  if (!cache) {
    return false;
  }

  try {
    const cacheKey = createCacheKey(key, options?.namespace);
    return await cache.delete(cacheKey);
  } catch {
    return false;
  }
}

/**
 * In-flight computation tracking for deduplication
 */
const inFlightComputations = new Map<string, Promise<unknown>>();

/**
 * Get a cached value, or compute and cache it if not present
 *
 * This is the recommended method for caching expensive operations (external API calls,
 * heavy computations, paid data reads). It combines get + set with deduplication.
 *
 * @template T - The type of value to cache
 * @param key - Cache key
 * @param compute - Function that computes the value if not cached or expired
 * @param options - Cache options including TTL
 * @returns Promise resolving to the cached or computed value
 */
export async function getOrSet<T>(key: string, compute: () => Promise<T>, options: CacheOptions): Promise<T> {
  const log = options.logger || logger;
  const fullKey = createCacheKey(key, options.namespace);

  // Check for in-flight computation first (deduplication)
  const inFlight = inFlightComputations.get(fullKey);
  if (inFlight) {
    return inFlight as Promise<T>;
  }

  // Try to get from cache
  const cached = await get<T>(key, options);
  if (cached !== null) {
    return cached;
  }

  // Check again for in-flight (race condition protection)
  const inFlightAfterCache = inFlightComputations.get(fullKey);
  if (inFlightAfterCache) {
    return inFlightAfterCache as Promise<T>;
  }

  // Execute compute function
  const computePromise = (async () => {
    try {
      const value = await compute();
      await set(key, value, options);
      return value;
    } catch (error) {
      log.error("cache.compute.error", {
        key,
        namespace: options.namespace,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      inFlightComputations.delete(fullKey);
    }
  })();

  // Track in-flight computation (atomic check-and-set)
  const existing = inFlightComputations.get(fullKey);
  if (existing) {
    return existing as Promise<T>;
  }
  inFlightComputations.set(fullKey, computePromise);

  return computePromise;
}

/**
 * Text-based cache helpers (for string values)
 */
export async function getText(key: string, options?: Omit<CacheOptions, "ttlSeconds">): Promise<string | null> {
  const cache = resolveCache();
  if (!cache) {
    return null;
  }

  try {
    const cacheKey = createCacheKey(key, options?.namespace);
    const response = await cache.match(cacheKey);
    if (!response) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

export async function setText(key: string, value: string, options: CacheOptions): Promise<void> {
  const cache = resolveCache();
  if (!cache) {
    return;
  }

  try {
    const cacheKey = createCacheKey(key, options.namespace);
    const response = new Response(value, {
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": `public, max-age=${options.ttlSeconds}`,
      },
    });
    await cache.put(cacheKey, response);
  } catch {
    // Gracefully degrade
  }
}

export async function updateText(key: string, value: string, options: CacheOptions): Promise<void> {
  await setText(key, value, options);
}

/**
 * Binary cache helpers (for ArrayBuffer values)
 */
export async function getBinary(key: string, options?: Omit<CacheOptions, "ttlSeconds">): Promise<ArrayBuffer | null> {
  const cache = resolveCache();
  if (!cache) {
    return null;
  }

  try {
    const cacheKey = createCacheKey(key, options?.namespace);
    const response = await cache.match(cacheKey);
    if (!response) {
      return null;
    }
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

export async function setBinary(key: string, value: ArrayBuffer, options: CacheOptions): Promise<void> {
  const cache = resolveCache();
  if (!cache) {
    return;
  }

  try {
    const cacheKey = createCacheKey(key, options.namespace);
    const response = new Response(value, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": `public, max-age=${options.ttlSeconds}`,
      },
    });
    await cache.put(cacheKey, response);
  } catch {
    // Gracefully degrade
  }
}

export async function updateBinary(key: string, value: ArrayBuffer, options: CacheOptions): Promise<void> {
  await setBinary(key, value, options);
}

/**
 * Request-level cache wrapper for HTTP responses
 *
 * @param request - The incoming Request object
 * @param ttlSeconds - Time-to-live in seconds
 * @param buildResponse - Function that builds the Response if not cached
 * @returns Promise resolving to cached or newly built Response
 */
export async function withRequestCache(
  request: Request,
  ttlSeconds: number,
  buildResponse: () => Promise<Response>,
): Promise<Response> {
  const cache = resolveCache();
  if (!cache) {
    logger.warn("cache.unavailable", {
      url: request.url,
      reason: "Cloudflare context not available",
    });
    return buildResponse();
  }

  try {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      logger.debug("cache.hit", { url: request.url, ttlSeconds });
      return cachedResponse;
    }

    logger.debug("cache.miss", { url: request.url, ttlSeconds });
    const response = await buildResponse();
    const sanitizedResponse = sanitizeResponseForCache(response, ttlSeconds);

    try {
      await cache.put(request, sanitizedResponse);
      logger.debug("cache.put", { url: request.url, ttlSeconds });
    } catch (error) {
      logger.error("cache.operation.error", {
        url: request.url,
        ttlSeconds,
        operation: "put",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return sanitizedResponse;
  } catch (error) {
    logger.error("cache.operation.error", {
      url: request.url,
      ttlSeconds,
      operation: "match",
      error: error instanceof Error ? error.message : String(error),
    });
    return buildResponse();
  }
}

/**
 * Sanitize Response for caching (strip Set-Cookie, set Cache-Control)
 */
function sanitizeResponseForCache(response: Response, ttlSeconds: number): Response {
  const headers = new Headers(response.headers);
  headers.delete("Set-Cookie");

  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", `public, max-age=${ttlSeconds}`);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
