import { describe, expect, it, beforeEach, mock } from "bun:test";
import { appRouter } from "@/server/trpc/routers/_app";
import { createMockContext } from "../../../unit/server/trpc/helpers";
import { createTestR2Bucket } from "../../../lib/memory-r2";
import type { PaintingMetadata } from "@/types/paintings";

function createTestMetadata(id: string, imageKey: string, timestamp: string): PaintingMetadata {
  return {
    id,
    timestamp,
    minuteBucket: timestamp,
    paramsHash: "abc12345",
    seed: "def456789012",
    visualParams: {
      fogDensity: 0.5,
      skyTint: 0.6,
      reflectivity: 0.7,
      blueBalance: 0.8,
      vegetationDensity: 0.9,
      organicPattern: 0.1,
      radiationGlow: 0.2,
      debrisIntensity: 0.3,
      mechanicalPattern: 0.4,
      metallicRatio: 0.5,
      fractalDensity: 0.6,
      bioluminescence: 0.7,
      shadowDepth: 0.8,
      redHighlight: 0.9,
      lightIntensity: 0.1,
      warmHue: 0.2,
    },
    imageUrl: `/api/r2/${imageKey}`,
    fileSize: 123456,
    prompt: "test prompt",
    negative: "test negative",
  };
}

describe("Archive tRPC Router Integration", () => {
  let store: Map<string, { content: ArrayBuffer | string; contentType?: string }>;

  beforeEach(() => {
    mock.restore();
    const client = createTestR2Bucket();
    store = client.store;

    // Setup test data with metadata
    const images = [
      {
        imageKey: "images/2025/11/14/DOOM_202511141200_abc12345_def456789012.webp",
        timestamp: "2025-11-14T12:00:00Z",
      },
      {
        imageKey: "images/2025/11/14/DOOM_202511141201_abc12345_def456789012.webp",
        timestamp: "2025-11-14T12:01:00Z",
      },
    ];

    for (const { imageKey, timestamp } of images) {
      const id =
        imageKey
          .split("/")
          .pop()
          ?.replace(/\.webp$/, "") || "";
      const metadataKey = imageKey.replace(/\.webp$/, ".json");

      store.set(imageKey, {
        content: new TextEncoder().encode("fake image").buffer,
        contentType: "image/webp",
      });

      store.set(metadataKey, {
        content: JSON.stringify(createTestMetadata(id, imageKey, timestamp)),
        contentType: "application/json",
      });
    }

    // Mock R2 bucket resolution
    mock.module("@/lib/r2", () => ({
      resolveR2Bucket: () => ({ isErr: () => false, value: client.bucket }),
    }));
  });

  describe("paintings.list", () => {
    it("should return archive items with default parameters", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.paintings.list({});

      expect(result.items).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.hasMore).toBeDefined();
      expect(typeof result.hasMore).toBe("boolean");
    });

    it("should parse limit parameter", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.paintings.list({ limit: 5 });

      expect(result.items.length).toBeLessThanOrEqual(5);
    });

    it("should validate limit maximum (100)", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      // zod will throw error for values > 100
      await expect(caller.paintings.list({ limit: 200 as unknown as number })).rejects.toThrow();
    });

    it("should parse cursor parameter", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.paintings.list({ cursor: "test-cursor" });

      expect(result.items).toBeDefined();
    });

    it("should parse startDate parameter", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.paintings.list({ startDate: "2025-11-14" });

      expect(result.items).toBeDefined();
    });

    it("should parse endDate parameter", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.paintings.list({ endDate: "2025-11-14" });

      expect(result.items).toBeDefined();
    });

    it("should parse date range query parameters", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.paintings.list({
        startDate: "2025-11-14",
        endDate: "2025-11-15",
      });

      expect(result.items).toBeDefined();
    });

    it("should throw error for invalid date format", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.paintings.list({ startDate: "invalid-date" as unknown as string })).rejects.toThrow();
    });

    it("should throw error for invalid limit (negative)", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.paintings.list({ limit: -1 as unknown as number })).rejects.toThrow();
    });

    it("should throw error when startDate > endDate", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.paintings.list({
          startDate: "2025-11-15",
          endDate: "2025-11-14",
        }),
      ).rejects.toThrow();
    });
  });
});
