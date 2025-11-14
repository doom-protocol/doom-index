/**
 * Common test helpers for cache integration tests
 */

export type CachedResponseData = {
  body: string;
  headers: Record<string, string>;
  status: number;
  statusText: string;
};

/**
 * Create a mock Cache instance for integration tests
 */
export function createMockCache(): {
  cacheMap: Map<string, CachedResponseData>;
  mockCache: Cache;
} {
  const cacheMap = new Map<string, CachedResponseData>();
  const mockCache = {
    match: async (key: string | Request) => {
      const keyStr = typeof key === "string" ? key : key.url;
      const cached = cacheMap.get(keyStr);
      if (!cached) return undefined;
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: new Headers(cached.headers),
      });
    },
    put: async (key: string | Request, response: Response) => {
      const keyStr = typeof key === "string" ? key : key.url;
      const body = await response.clone().text();
      const headers = Object.fromEntries(response.headers.entries());
      cacheMap.set(keyStr, {
        body,
        headers,
        status: response.status,
        statusText: response.statusText,
      });
    },
    delete: async (key: string | Request) => {
      const keyStr = typeof key === "string" ? key : key.url;
      return cacheMap.delete(keyStr);
    },
  } as unknown as Cache;

  return { cacheMap, mockCache };
}

/**
 * Setup cache mock in globalThis.caches
 */
export function setupCacheMock(mockCache: Cache): CacheStorage | undefined {
  const originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
  (globalThis as unknown as { caches?: CacheStorage }).caches = {
    default: mockCache,
  } as unknown as CacheStorage;
  return originalCaches;
}

/**
 * Restore original cache from globalThis.caches
 */
export function restoreCacheMock(originalCaches: CacheStorage | undefined): void {
  (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
}
