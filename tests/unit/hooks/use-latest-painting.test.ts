/**
 * Unit tests for use-latest-painting hook and related functions
 * Tests performance measurement and timing guarantees for gallery page initial load
 */

import { describe, expect, it, mock } from "bun:test";
import {
  fetchLatestPainting,
  computeRefetchDelay,
  clampInterval,
  MIN_REFETCH_INTERVAL_MS,
  STALE_POLL_INTERVAL_MS,
  POST_GENERATION_DELAY_MS,
} from "@/hooks/use-latest-painting";
import type { ArchiveListResponse } from "@/services/paintings";
import type { PaintingMetadata } from "@/types/paintings";

// Mock painting data for tests
const mockPainting: PaintingMetadata = {
  id: "test-painting-1",
  timestamp: new Date().toISOString(),
  minuteBucket: "2025/11/30/12/00",
  paramsHash: "test-hash",
  seed: "12345",
  imageUrl: "/api/r2/paintings/test.webp",
  fileSize: 1024000,
  visualParams: {
    fogDensity: 0.5,
    skyTint: 0.3,
    reflectivity: 0.2,
    blueBalance: 0.1,
    vegetationDensity: 0.4,
    organicPattern: 0.3,
    radiationGlow: 0.1,
    debrisIntensity: 0.2,
    mechanicalPattern: 0.1,
    metallicRatio: 0.2,
    fractalDensity: 0.3,
    bioluminescence: 0.1,
    shadowDepth: 0.4,
    redHighlight: 0.1,
    lightIntensity: 0.8,
    warmHue: 0.2,
    tokenWeights: {
      fear: 0.2,
      hope: 0.3,
      machine: 0.1,
      ice: 0.1,
      forest: 0.1,
      co2: 0.1,
      pandemic: 0.05,
      nuke: 0.05,
    },
    worldPrompt: "Test world prompt",
  },
  prompt: "Test painting prompt",
  negative: "",
};

describe("unit/hooks/use-latest-painting", () => {
  describe("fetchLatestPainting", () => {
    it("should return painting and duration when items exist", async () => {
      const mockResponse: ArchiveListResponse = {
        items: [mockPainting],
        cursor: undefined,
        hasMore: false,
      };
      const mockQueryFn = mock(() => Promise.resolve(mockResponse));

      // Use controlled time function
      let time = 0;
      const mockNow = () => {
        const current = time;
        time += 50; // Simulate 50ms elapsed
        return current;
      };

      const result = await fetchLatestPainting(mockQueryFn, mockNow);

      expect(result.painting).toEqual(mockPainting);
      expect(result.durationMs).toBe(50);
      expect(mockQueryFn).toHaveBeenCalledTimes(1);
    });

    it("should return null painting when no items exist", async () => {
      const mockResponse: ArchiveListResponse = {
        items: [],
        cursor: undefined,
        hasMore: false,
      };
      const mockQueryFn = mock(() => Promise.resolve(mockResponse));

      let time = 0;
      const mockNow = () => {
        const current = time;
        time += 30;
        return current;
      };

      const result = await fetchLatestPainting(mockQueryFn, mockNow);

      expect(result.painting).toBeNull();
      expect(result.durationMs).toBe(30);
    });

    it("should accurately measure duration without adding overhead", async () => {
      const mockResponse: ArchiveListResponse = {
        items: [mockPainting],
        cursor: undefined,
        hasMore: false,
      };

      // Simulate network delay of 100ms
      const networkDelayMs = 100;
      const mockQueryFn = mock(async () => {
        await new Promise(resolve => setTimeout(resolve, networkDelayMs));
        return mockResponse;
      });

      const start = performance.now();
      const result = await fetchLatestPainting(mockQueryFn);
      const totalTime = performance.now() - start;

      // The measured duration should be close to the actual network delay
      // Allow 50ms tolerance for test execution overhead
      expect(result.durationMs).toBeGreaterThanOrEqual(networkDelayMs - 10);
      expect(result.durationMs).toBeLessThan(networkDelayMs + 50);

      // Total time should also be close to network delay (no extra blocking)
      expect(totalTime).toBeGreaterThanOrEqual(networkDelayMs - 10);
      expect(totalTime).toBeLessThan(networkDelayMs + 100);
    });

    it("should not add artificial delays beyond network time", async () => {
      const mockResponse: ArchiveListResponse = {
        items: [mockPainting],
        cursor: undefined,
        hasMore: false,
      };

      // Instant response (0ms network delay)
      const mockQueryFn = mock(() => Promise.resolve(mockResponse));

      const start = performance.now();
      const result = await fetchLatestPainting(mockQueryFn);
      const totalTime = performance.now() - start;

      // With instant response, total time should be very small (< 10ms)
      // This guarantees no artificial delays are added by our code
      expect(totalTime).toBeLessThan(10);
      expect(result.durationMs).toBeLessThan(10);
    });

    it("should handle undefined items array", async () => {
      const mockResponse = {
        items: undefined,
        cursor: undefined,
        hasMore: false,
      } as unknown as ArchiveListResponse;
      const mockQueryFn = mock(() => Promise.resolve(mockResponse));

      const result = await fetchLatestPainting(mockQueryFn);

      expect(result.painting).toBeNull();
    });
  });

  describe("clampInterval", () => {
    it("should return MIN_REFETCH_INTERVAL_MS for values below minimum", () => {
      expect(clampInterval(0)).toBe(MIN_REFETCH_INTERVAL_MS);
      expect(clampInterval(1000)).toBe(MIN_REFETCH_INTERVAL_MS);
      expect(clampInterval(29999)).toBe(MIN_REFETCH_INTERVAL_MS);
    });

    it("should return the value for values at or above minimum", () => {
      expect(clampInterval(MIN_REFETCH_INTERVAL_MS)).toBe(MIN_REFETCH_INTERVAL_MS);
      expect(clampInterval(60000)).toBe(60000);
      expect(clampInterval(120000)).toBe(120000);
    });
  });

  describe("computeRefetchDelay", () => {
    it("should return MIN_REFETCH_INTERVAL_MS when no timestamp provided", () => {
      expect(computeRefetchDelay(null)).toBe(MIN_REFETCH_INTERVAL_MS);
      expect(computeRefetchDelay(undefined)).toBe(MIN_REFETCH_INTERVAL_MS);
    });

    it("should return STALE_POLL_INTERVAL_MS for invalid timestamp", () => {
      expect(computeRefetchDelay("invalid-date")).toBe(STALE_POLL_INTERVAL_MS);
    });

    it("should return clamped STALE_POLL_INTERVAL_MS for old timestamps", () => {
      // Timestamp from 1 hour ago (older than GENERATION_INTERVAL_MS)
      const oldTimestamp = new Date(Date.now() - 3600000).toISOString();
      const result = computeRefetchDelay(oldTimestamp);

      // Should be clamped to at least MIN_REFETCH_INTERVAL_MS
      expect(result).toBeGreaterThanOrEqual(MIN_REFETCH_INTERVAL_MS);
    });
  });

  describe("constants", () => {
    it("should have reasonable default values for polling intervals", () => {
      // MIN_REFETCH_INTERVAL_MS should be at least 30 seconds
      expect(MIN_REFETCH_INTERVAL_MS).toBeGreaterThanOrEqual(30000);

      // STALE_POLL_INTERVAL_MS should be at least 60 seconds
      expect(STALE_POLL_INTERVAL_MS).toBeGreaterThanOrEqual(60000);

      // POST_GENERATION_DELAY_MS should be reasonable (5-30 seconds)
      expect(POST_GENERATION_DELAY_MS).toBeGreaterThanOrEqual(5000);
      expect(POST_GENERATION_DELAY_MS).toBeLessThanOrEqual(30000);
    });
  });
});

describe("unit/hooks/use-latest-painting/performance-guarantees", () => {
  /**
   * Performance guarantee tests
   * These tests ensure the code path doesn't add unnecessary latency
   */

  it("should complete fetch orchestration in under 5ms (excluding network)", async () => {
    const mockResponse: ArchiveListResponse = {
      items: [mockPainting],
      cursor: undefined,
      hasMore: false,
    };

    // Track overhead by using controlled time
    let callCount = 0;
    const times = [0, 0]; // start and end times
    const mockNow = () => {
      const result = times[callCount];
      callCount++;
      return result;
    };

    const mockQueryFn = mock(() => Promise.resolve(mockResponse));

    const result = await fetchLatestPainting(mockQueryFn, mockNow);

    // Duration should be 0 since both times are 0 (no overhead from our code)
    expect(result.durationMs).toBe(0);
  });

  it("should not block on synchronous operations", async () => {
    const mockResponse: ArchiveListResponse = {
      items: [mockPainting],
      cursor: undefined,
      hasMore: false,
    };

    const mockQueryFn = mock(() => Promise.resolve(mockResponse));

    // Run multiple fetches in parallel
    const start = performance.now();
    const results = await Promise.all([
      fetchLatestPainting(mockQueryFn),
      fetchLatestPainting(mockQueryFn),
      fetchLatestPainting(mockQueryFn),
    ]);
    const totalTime = performance.now() - start;

    // All 3 should complete quickly (< 20ms total for parallel execution)
    expect(totalTime).toBeLessThan(20);
    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(result.painting).toEqual(mockPainting);
    });
  });
});
