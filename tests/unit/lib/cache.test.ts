import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

describe("Cache Helper - resolveCache", () => {
  beforeEach(() => {
    mock.restore();
  });

  afterEach(() => {
    mock.restore();
  });

  it("should return Cache instance when Cloudflare context is available", async () => {
    const mockCache = {
      match: mock(() => Promise.resolve(undefined)),
      put: mock(() => Promise.resolve()),
      delete: mock(() => Promise.resolve(false)),
    } as unknown as Cache;

    // Mock globalThis.caches with default property
    const originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
    (globalThis as unknown as { caches?: CacheStorage }).caches = {
      default: mockCache,
    } as unknown as CacheStorage;

    try {
      const { resolveCache } = await import("@/lib/cache");
      const result = resolveCache();

      expect(result).toBe(mockCache);
    } finally {
      // Restore original caches
      (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
    }
  });

  it("should return null when caches is undefined", async () => {
    const originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
    (globalThis as unknown as { caches?: CacheStorage }).caches = undefined;

    try {
      const { resolveCache } = await import("@/lib/cache");
      const result = resolveCache();
      expect(result).toBeNull();
    } finally {
      (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
    }
  });

  it("should return null when caches.default is not available", async () => {
    // Mock globalThis.caches without default property
    const originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
    (globalThis as unknown as { caches?: CacheStorage }).caches = {} as unknown as CacheStorage;

    try {
      const { resolveCache } = await import("@/lib/cache");
      const result = resolveCache();
      expect(result).toBeNull();
    } finally {
      // Restore original caches
      (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
    }
  });

  it("should return null when caches access throws error", async () => {
    const originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
    // Mock caches to throw an error when accessed
    Object.defineProperty(globalThis, "caches", {
      get: () => {
        throw new TypeError("Unexpected error");
      },
      configurable: true,
    });

    try {
      const { resolveCache } = await import("@/lib/cache");
      const result = resolveCache();
      expect(result).toBeNull();
    } finally {
      delete (globalThis as unknown as { caches?: CacheStorage }).caches;
      if (originalCaches !== undefined) {
        (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
      }
    }
  });
});

describe("Cache Helper - get", () => {
  let mockCache: Cache;
  let mockMatch: ReturnType<typeof mock>;
  let originalCaches: CacheStorage | undefined;

  beforeEach(() => {
    mockMatch = mock(() => Promise.resolve(undefined));
    mockCache = {
      match: mockMatch,
      put: mock(() => Promise.resolve()),
      delete: mock(() => Promise.resolve(false)),
    } as unknown as Cache;

    void mock.module("@opennextjs/cloudflare", () => ({
      getCloudflareContext: () =>
        Promise.resolve({
          env: {},
        }),
    }));

    // Mock globalThis.caches with default property
    originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
    (globalThis as unknown as { caches?: CacheStorage }).caches = {
      default: mockCache,
    } as unknown as CacheStorage;
  });

  afterEach(() => {
    // Restore original caches
    (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
    mock.restore();
  });

  it("should return cached value when cache hit", async () => {
    const cachedValue = { foo: "bar" };
    const mockResponse = new Response(JSON.stringify(cachedValue), {
      headers: { "Content-Type": "application/json" },
    });
    mockMatch.mockResolvedValueOnce(mockResponse);

    const { get } = await import("@/lib/cache");
    const result = await get<typeof cachedValue>("test-key");

    expect(result).toEqual(cachedValue);
    expect(mockMatch).toHaveBeenCalledTimes(1);
  });

  it("should return null when cache miss", async () => {
    mockMatch.mockResolvedValueOnce(undefined);

    const { get } = await import("@/lib/cache");
    const result = await get<string>("test-key");

    expect(result).toBeNull();
  });

  it("should return null when cache is unavailable", async () => {
    void mock.module("@opennextjs/cloudflare", () => ({
      getCloudflareContext: () => {
        return Promise.reject(new Error("Cache unavailable"));
      },
    }));

    const { get } = await import("@/lib/cache");
    const result = await get<string>("test-key");

    expect(result).toBeNull();
  });

  it("should return null when cache.match throws", async () => {
    mockMatch.mockRejectedValueOnce(new Error("Cache error"));

    const { get } = await import("@/lib/cache");
    const result = await get<string>("test-key");

    expect(result).toBeNull();
  });

  it("should use namespace in cache key when provided", async () => {
    mockMatch.mockResolvedValueOnce(undefined);

    const { get } = await import("@/lib/cache");
    await get<string>("test-key", { namespace: "ns" });

    const callArg = mockMatch.mock.calls[0][0] as string;
    expect(callArg).toContain("ns:test-key");
  });
});

describe("Cache Helper - set", () => {
  let mockCache: Cache;
  let mockPut: ReturnType<typeof mock>;
  let originalCaches: CacheStorage | undefined;

  beforeEach(() => {
    mockPut = mock(() => Promise.resolve());
    mockCache = {
      match: mock(() => Promise.resolve(undefined)),
      put: mockPut,
      delete: mock(() => Promise.resolve(false)),
    } as unknown as Cache;

    void mock.module("@opennextjs/cloudflare", () => ({
      getCloudflareContext: () =>
        Promise.resolve({
          env: {},
        }),
    }));

    // Mock globalThis.caches with default property
    originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
    (globalThis as unknown as { caches?: CacheStorage }).caches = {
      default: mockCache,
    } as unknown as CacheStorage;
  });

  afterEach(() => {
    // Restore original caches
    (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
    mock.restore();
  });

  it("should store value in cache with TTL", async () => {
    const value = { foo: "bar" };
    const { set } = await import("@/lib/cache");
    await set("test-key", value, { ttlSeconds: 60 });

    expect(mockPut).toHaveBeenCalledTimes(1);
    const [cacheKey, response] = mockPut.mock.calls[0] as [string, Response];
    expect(cacheKey).toContain("test-key");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    const body = await response.json();
    expect(body).toEqual(value);
  });

  it("should skip caching when cache is unavailable", async () => {
    void mock.module("@opennextjs/cloudflare", () => ({
      getCloudflareContext: () => {
        throw new Error("Cache unavailable");
      },
    }));

    const { set } = await import("@/lib/cache");
    await set("test-key", { foo: "bar" }, { ttlSeconds: 60 });

    // Should not throw
    expect(true).toBe(true);
  });

  it("should use namespace in cache key when provided", async () => {
    const { set } = await import("@/lib/cache");
    await set("test-key", { foo: "bar" }, { ttlSeconds: 60, namespace: "ns" });

    const [cacheKey] = mockPut.mock.calls[0] as [string];
    expect(cacheKey).toContain("ns:test-key");
  });

  it("should skip caching when cache.put throws", async () => {
    mockPut.mockRejectedValueOnce(new Error("Cache error"));

    const { set } = await import("@/lib/cache");
    await set("test-key", { foo: "bar" }, { ttlSeconds: 60 });

    // Should not throw
    expect(true).toBe(true);
  });
});

describe("Cache Helper - update", () => {
  let mockCache: Cache;
  let mockPut: ReturnType<typeof mock>;
  let originalCaches: CacheStorage | undefined;

  beforeEach(() => {
    mockPut = mock(() => Promise.resolve());
    mockCache = {
      match: mock(() => Promise.resolve(undefined)),
      put: mockPut,
      delete: mock(() => Promise.resolve(false)),
    } as unknown as Cache;

    originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
    (globalThis as unknown as { caches?: CacheStorage }).caches = {
      default: mockCache,
    } as unknown as CacheStorage;
  });

  afterEach(() => {
    (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
    mock.restore();
  });

  it("should update cached value", async () => {
    const value = { foo: "updated" };
    const { update } = await import("@/lib/cache");
    await update("test-key", value, { ttlSeconds: 60 });

    expect(mockPut).toHaveBeenCalledTimes(1);
    const [cacheKey, response] = mockPut.mock.calls[0] as [string, Response];
    expect(cacheKey).toContain("test-key");
    const body = await response.json();
    expect(body).toEqual(value);
  });

  it("should use namespace in cache key when provided", async () => {
    const value = { foo: "bar" };
    const { update } = await import("@/lib/cache");
    await update("test-key", value, { ttlSeconds: 60, namespace: "ns" });

    const [cacheKey] = mockPut.mock.calls[0] as [string];
    expect(cacheKey).toContain("ns:test-key");
  });
});

describe("Cache Helper - getOrSet", () => {
  let mockCache: Cache;
  let mockMatch: ReturnType<typeof mock>;
  let mockPut: ReturnType<typeof mock>;
  let originalCaches: CacheStorage | undefined;

  beforeEach(() => {
    mockMatch = mock(() => Promise.resolve(undefined));
    mockPut = mock(() => Promise.resolve());
    mockCache = {
      match: mockMatch,
      put: mockPut,
      delete: mock(() => Promise.resolve(false)),
    } as unknown as Cache;

    originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
    (globalThis as unknown as { caches?: CacheStorage }).caches = {
      default: mockCache,
    } as unknown as CacheStorage;
  });

  afterEach(() => {
    (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
    mock.restore();
  });

  it("should return cached value when cache hit", async () => {
    const cachedValue = { foo: "bar" };
    const mockResponse = new Response(JSON.stringify(cachedValue), {
      headers: { "Content-Type": "application/json" },
    });
    mockMatch.mockResolvedValueOnce(mockResponse);

    const computeFn = mock(() => Promise.resolve({ foo: "baz" }));
    const { getOrSet } = await import("@/lib/cache");
    const result = await getOrSet("test-key", computeFn, { ttlSeconds: 60 });

    expect(result).toEqual(cachedValue);
    expect(computeFn).not.toHaveBeenCalled();
  });

  it("should execute compute function and cache result when cache miss", async () => {
    mockMatch.mockResolvedValueOnce(undefined);
    const computedValue = { foo: "baz" };
    const computeFn = mock(() => Promise.resolve(computedValue));

    const { getOrSet } = await import("@/lib/cache");
    const result = await getOrSet("test-key", computeFn, { ttlSeconds: 60 });

    expect(result).toEqual(computedValue);
    expect(computeFn).toHaveBeenCalledTimes(1);
    expect(mockPut).toHaveBeenCalledTimes(1);
  });

  it("should execute compute function when cache is unavailable", async () => {
    void mock.module("@opennextjs/cloudflare", () => ({
      getCloudflareContext: () => {
        return Promise.reject(new Error("Cache unavailable"));
      },
    }));

    const computedValue = { foo: "baz" };
    const computeFn = mock(() => Promise.resolve(computedValue));

    const { getOrSet } = await import("@/lib/cache");
    const result = await getOrSet("test-key", computeFn, { ttlSeconds: 60 });

    expect(result).toEqual(computedValue);
    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it("should propagate compute function errors", async () => {
    mockMatch.mockResolvedValueOnce(undefined);
    const computeError = new Error("Compute error");
    const computeFn = mock(() => Promise.reject(computeError));

    const { getOrSet } = await import("@/lib/cache");
    expect(getOrSet("test-key", computeFn, { ttlSeconds: 60 })).rejects.toThrow("Compute error");
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("should use namespace in cache key when provided", async () => {
    mockMatch.mockResolvedValueOnce(undefined);
    const computeFn = mock(() => Promise.resolve({ foo: "bar" }));

    const { getOrSet } = await import("@/lib/cache");
    await getOrSet("test-key", computeFn, { ttlSeconds: 60, namespace: "ns" });

    const [cacheKey] = mockPut.mock.calls[0] as [string];
    expect(cacheKey).toContain("ns:test-key");
  });
});

describe("Cache Helper - remove", () => {
  let mockCache: Cache;
  let mockDelete: ReturnType<typeof mock>;
  let originalCaches: CacheStorage | undefined;

  beforeEach(() => {
    mockDelete = mock(() => Promise.resolve(false));
    mockCache = {
      match: mock(() => Promise.resolve(undefined)),
      put: mock(() => Promise.resolve()),
      delete: mockDelete,
    } as unknown as Cache;

    void mock.module("@opennextjs/cloudflare", () => ({
      getCloudflareContext: () =>
        Promise.resolve({
          env: {},
        }),
    }));

    // Mock globalThis.caches with default property
    originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
    (globalThis as unknown as { caches?: CacheStorage }).caches = {
      default: mockCache,
    } as unknown as CacheStorage;
  });

  afterEach(() => {
    // Restore original caches
    (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
    mock.restore();
  });

  it("should return true when deletion succeeds", async () => {
    mockDelete.mockResolvedValueOnce(true);

    const { remove } = await import("@/lib/cache");
    const result = await remove("test-key");

    expect(result).toBe(true);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("should return false when key does not exist", async () => {
    mockDelete.mockResolvedValueOnce(false);

    const { remove } = await import("@/lib/cache");
    const result = await remove("test-key");

    expect(result).toBe(false);
  });

  it("should return false when cache is unavailable", async () => {
    void mock.module("@opennextjs/cloudflare", () => ({
      getCloudflareContext: () => {
        throw new Error("Cache unavailable");
      },
    }));

    const { remove } = await import("@/lib/cache");
    const result = await remove("test-key");

    expect(result).toBe(false);
  });

  it("should return false when cache.delete throws", async () => {
    mockDelete.mockRejectedValueOnce(new Error("Cache error"));

    const { remove } = await import("@/lib/cache");
    const result = await remove("test-key");

    expect(result).toBe(false);
  });

  it("should use namespace in cache key when provided", async () => {
    mockDelete.mockResolvedValueOnce(true);

    const { remove } = await import("@/lib/cache");
    await remove("test-key", { namespace: "ns" });

    const [cacheKey] = mockDelete.mock.calls[0] as [string];
    expect(cacheKey).toContain("ns:test-key");
  });
});

describe("Cache Helper - getOrSet deduplication", () => {
  let mockCache: Cache;
  let mockMatch: ReturnType<typeof mock>;
  let mockPut: ReturnType<typeof mock>;
  let originalCaches: CacheStorage | undefined;

  beforeEach(() => {
    mockMatch = mock(() => Promise.resolve(undefined));
    mockPut = mock(() => Promise.resolve());
    mockCache = {
      match: mockMatch,
      put: mockPut,
      delete: mock(() => Promise.resolve(false)),
    } as unknown as Cache;

    void mock.module("@opennextjs/cloudflare", () => ({
      getCloudflareContext: () =>
        Promise.resolve({
          env: {},
        }),
    }));

    // Mock globalThis.caches with default property
    originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
    (globalThis as unknown as { caches?: CacheStorage }).caches = {
      default: mockCache,
    } as unknown as CacheStorage;
  });

  afterEach(() => {
    // Restore original caches
    (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
    mock.restore();
  });

  it("should deduplicate concurrent requests for same key", async () => {
    mockMatch.mockResolvedValue(undefined);
    const computedValue = { foo: "bar" };
    let computeCallCount = 0;
    const computeFn = mock(() => {
      computeCallCount++;
      return new Promise<typeof computedValue>(resolve => {
        setTimeout(() => resolve(computedValue), 10);
      });
    });

    const { getOrSet } = await import("@/lib/cache");

    // Make 5 concurrent requests
    const promises = Array.from({ length: 5 }, () => getOrSet("test-key", computeFn, { ttlSeconds: 60 }));

    const results = await Promise.all(promises);

    // All should return the same value
    results.forEach(result => {
      expect(result).toEqual(computedValue);
    });

    // Compute function should only be called once
    expect(computeCallCount).toBe(1);
  });
});

describe("Cache Helper - Text Helpers", () => {
  let mockCache: Cache;
  let mockMatch: ReturnType<typeof mock>;
  let mockPut: ReturnType<typeof mock>;
  let originalCaches: CacheStorage | undefined;

  beforeEach(() => {
    mockMatch = mock(() => Promise.resolve(undefined));
    mockPut = mock(() => Promise.resolve());
    mockCache = {
      match: mockMatch,
      put: mockPut,
      delete: mock(() => Promise.resolve(false)),
    } as unknown as Cache;

    originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
    (globalThis as unknown as { caches?: CacheStorage }).caches = {
      default: mockCache,
    } as unknown as CacheStorage;
  });

  afterEach(() => {
    (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
    mock.restore();
  });

  describe("getText", () => {
    it("should return cached text value when cache hit", async () => {
      const cachedText = "Hello, World!";
      const mockResponse = new Response(cachedText, {
        headers: { "Content-Type": "text/plain" },
      });
      mockMatch.mockResolvedValueOnce(mockResponse);

      const { getText } = await import("@/lib/cache");
      const result = await getText("test-key");

      expect(result).toBe(cachedText);
      expect(mockMatch).toHaveBeenCalledTimes(1);
    });

    it("should return null when cache miss", async () => {
      mockMatch.mockResolvedValueOnce(undefined);

      const { getText } = await import("@/lib/cache");
      const result = await getText("test-key");

      expect(result).toBeNull();
    });

    it("should return null when cache is unavailable", async () => {
      const originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
      (globalThis as unknown as { caches?: CacheStorage }).caches = undefined;

      try {
        const { getText } = await import("@/lib/cache");
        const result = await getText("test-key");

        expect(result).toBeNull();
      } finally {
        (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
      }
    });

    it("should use namespace in cache key when provided", async () => {
      mockMatch.mockResolvedValueOnce(undefined);

      const { getText } = await import("@/lib/cache");
      await getText("test-key", { namespace: "ns" });

      const callArg = mockMatch.mock.calls[0][0] as string;
      expect(callArg).toContain("ns:test-key");
    });
  });

  describe("setText", () => {
    it("should store text value in cache with TTL", async () => {
      const textValue = "Hello, World!";
      const { setText } = await import("@/lib/cache");
      await setText("test-key", textValue, { ttlSeconds: 60 });

      expect(mockPut).toHaveBeenCalledTimes(1);
      const [cacheKey, response] = mockPut.mock.calls[0] as [string, Response];
      expect(cacheKey).toContain("test-key");
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
      expect(response.headers.get("Content-Type")).toBe("text/plain");
      const body = await response.text();
      expect(body).toBe(textValue);
    });

    it("should skip caching when cache is unavailable", async () => {
      const originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
      (globalThis as unknown as { caches?: CacheStorage }).caches = undefined;

      try {
        const { setText } = await import("@/lib/cache");
        await setText("test-key", "Hello", { ttlSeconds: 60 });

        // Should not throw
        expect(true).toBe(true);
      } finally {
        (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
      }
    });

    it("should use namespace in cache key when provided", async () => {
      const { setText } = await import("@/lib/cache");
      await setText("test-key", "Hello", { ttlSeconds: 60, namespace: "ns" });

      const [cacheKey] = mockPut.mock.calls[0] as [string];
      expect(cacheKey).toContain("ns:test-key");
    });
  });

  describe("updateText", () => {
    it("should update cached text value", async () => {
      const textValue = "Updated text";
      const { updateText } = await import("@/lib/cache");
      await updateText("test-key", textValue, { ttlSeconds: 60 });

      expect(mockPut).toHaveBeenCalledTimes(1);
      const [cacheKey, response] = mockPut.mock.calls[0] as [string, Response];
      expect(cacheKey).toContain("test-key");
      const body = await response.text();
      expect(body).toBe(textValue);
    });

    it("should use namespace in cache key when provided", async () => {
      const { updateText } = await import("@/lib/cache");
      await updateText("test-key", "Hello", { ttlSeconds: 60, namespace: "ns" });

      const [cacheKey] = mockPut.mock.calls[0] as [string];
      expect(cacheKey).toContain("ns:test-key");
    });
  });
});

describe("Cache Helper - Binary Helpers", () => {
  let mockCache: Cache;
  let mockMatch: ReturnType<typeof mock>;
  let mockPut: ReturnType<typeof mock>;
  let originalCaches: CacheStorage | undefined;

  beforeEach(() => {
    mockMatch = mock(() => Promise.resolve(undefined));
    mockPut = mock(() => Promise.resolve());
    mockCache = {
      match: mockMatch,
      put: mockPut,
      delete: mock(() => Promise.resolve(false)),
    } as unknown as Cache;

    originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
    (globalThis as unknown as { caches?: CacheStorage }).caches = {
      default: mockCache,
    } as unknown as CacheStorage;
  });

  afterEach(() => {
    (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
    mock.restore();
  });

  describe("getBinary", () => {
    it("should return cached binary value when cache hit", async () => {
      const cachedBinary = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const mockResponse = new Response(cachedBinary, {
        headers: { "Content-Type": "application/octet-stream" },
      });
      mockMatch.mockResolvedValueOnce(mockResponse);

      const { getBinary } = await import("@/lib/cache");
      const result = await getBinary("test-key");

      expect(result).not.toBeNull();
      expect(new Uint8Array(result!)).toEqual(new Uint8Array(cachedBinary));
      expect(mockMatch).toHaveBeenCalledTimes(1);
    });

    it("should return null when cache miss", async () => {
      mockMatch.mockResolvedValueOnce(undefined);

      const { getBinary } = await import("@/lib/cache");
      const result = await getBinary("test-key");

      expect(result).toBeNull();
    });

    it("should return null when cache is unavailable", async () => {
      const originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
      (globalThis as unknown as { caches?: CacheStorage }).caches = undefined;

      try {
        const { getBinary } = await import("@/lib/cache");
        const result = await getBinary("test-key");

        expect(result).toBeNull();
      } finally {
        (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
      }
    });

    it("should use namespace in cache key when provided", async () => {
      mockMatch.mockResolvedValueOnce(undefined);

      const { getBinary } = await import("@/lib/cache");
      await getBinary("test-key", { namespace: "ns" });

      const callArg = mockMatch.mock.calls[0][0] as string;
      expect(callArg).toContain("ns:test-key");
    });
  });

  describe("setBinary", () => {
    it("should store binary value in cache with TTL", async () => {
      const binaryValue = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const { setBinary } = await import("@/lib/cache");
      await setBinary("test-key", binaryValue, { ttlSeconds: 60 });

      expect(mockPut).toHaveBeenCalledTimes(1);
      const [cacheKey, response] = mockPut.mock.calls[0] as [string, Response];
      expect(cacheKey).toContain("test-key");
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
      expect(response.headers.get("Content-Type")).toBe("application/octet-stream");
      const body = await response.arrayBuffer();
      expect(new Uint8Array(body)).toEqual(new Uint8Array(binaryValue));
    });

    it("should skip caching when cache is unavailable", async () => {
      const originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
      (globalThis as unknown as { caches?: CacheStorage }).caches = undefined;

      try {
        const { setBinary } = await import("@/lib/cache");
        await setBinary("test-key", new ArrayBuffer(10), { ttlSeconds: 60 });

        // Should not throw
        expect(true).toBe(true);
      } finally {
        (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
      }
    });

    it("should use namespace in cache key when provided", async () => {
      const { setBinary } = await import("@/lib/cache");
      await setBinary("test-key", new ArrayBuffer(10), { ttlSeconds: 60, namespace: "ns" });

      const [cacheKey] = mockPut.mock.calls[0] as [string];
      expect(cacheKey).toContain("ns:test-key");
    });
  });

  describe("updateBinary", () => {
    it("should update cached binary value", async () => {
      const binaryValue = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const { updateBinary } = await import("@/lib/cache");
      await updateBinary("test-key", binaryValue, { ttlSeconds: 60 });

      expect(mockPut).toHaveBeenCalledTimes(1);
      const [cacheKey, response] = mockPut.mock.calls[0] as [string, Response];
      expect(cacheKey).toContain("test-key");
      const body = await response.arrayBuffer();
      expect(new Uint8Array(body)).toEqual(new Uint8Array(binaryValue));
    });

    it("should use namespace in cache key when provided", async () => {
      const { updateBinary } = await import("@/lib/cache");
      await updateBinary("test-key", new ArrayBuffer(10), { ttlSeconds: 60, namespace: "ns" });

      const [cacheKey] = mockPut.mock.calls[0] as [string];
      expect(cacheKey).toContain("ns:test-key");
    });
  });
});

describe("Cache Helper - HTTP Response Cache", () => {
  let mockCache: Cache;
  let mockMatch: ReturnType<typeof mock>;
  let mockPut: ReturnType<typeof mock>;
  let originalCaches: CacheStorage | undefined;

  beforeEach(() => {
    mockMatch = mock(() => Promise.resolve(undefined));
    mockPut = mock(() => Promise.resolve());
    mockCache = {
      match: mockMatch,
      put: mockPut,
      delete: mock(() => Promise.resolve(false)),
    } as unknown as Cache;

    originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
    (globalThis as unknown as { caches?: CacheStorage }).caches = {
      default: mockCache,
    } as unknown as CacheStorage;
  });

  afterEach(() => {
    (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
    mock.restore();
  });
});
