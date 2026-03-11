import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { clearLogCalls, createLoggerMockFactory, findLogCall } from "../../mocks/logger";

const { mockFactory: loggerMockFactory, calls } = createLoggerMockFactory();
void mock.module("@/utils/logger", loggerMockFactory);

describe("Cache Helper logging", () => {
  let originalCaches: CacheStorage | undefined;

  beforeEach(() => {
    clearLogCalls(calls);
    originalCaches = (globalThis as unknown as { caches?: CacheStorage }).caches;
  });

  afterEach(() => {
    (globalThis as unknown as { caches?: CacheStorage }).caches = originalCaches;
    mock.restore();
  });

  it("logs cache unavailability at debug level when caches is undefined", async () => {
    (globalThis as unknown as { caches?: CacheStorage }).caches = undefined;

    const { resolveCache } = await import("@/lib/cache");
    const result = resolveCache();

    expect(result).toBeNull();
    expect(findLogCall(calls, "debug", "cache.unavailable")).toBeDefined();
    expect(findLogCall(calls, "warn", "cache.unavailable")).toBeUndefined();
  });
});
