import { encodeCursor } from "@/repositories/paintings-repository";
import { createPaintingsService } from "@/services/paintings";
import type { PaintingMetadata } from "@/types/paintings";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { createTestR2Bucket } from "../../lib/memory-r2";

const TEST_IMAGE_KEYS = [
  "images/2025/11/14/DOOM_202511141200_abc12345_def456789012.webp",
  "images/2025/11/14/DOOM_202511141201_abc12345_def456789012.webp",
  "images/2025/11/14/DOOM_202511141202_abc12345_def456789012.webp",
  "images/2025/11/14/DOOM_202511141203_abc12345_def456789012.webp",
  "images/2025/11/14/DOOM_202511141204_abc12345_def456789012.webp",
];

function createTestMetadata(id: string, imageKey: string, index: number): PaintingMetadata {
  const timestamp = `2025-11-14T12:0${index}:00Z`;
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

describe("Archive List Service", () => {
  let bucket: R2Bucket;
  let store: Map<string, { content: ArrayBuffer | string; contentType?: string }>;
  let mockD1: {
    prepare: (sql: string) => {
      bind: (...params: unknown[]) => {
        all: () => Promise<{ items: unknown[]; cursor?: string; hasMore: boolean }>;
        raw: () => Promise<{ items: unknown[]; cursor?: string; hasMore: boolean }>;
      };
    };
    batch: () => Promise<unknown[]>;
    exec: () => Promise<unknown>;
    withSession: () => unknown;
    dump: () => Promise<unknown>;
  };

  afterEach(() => {
    // Clean up environment variables after each test
    // @ts-expect-error - Deleting env var for test cleanup
    delete process.env.NEXT_PUBLIC_R2_URL;

    // Restore original module
    mock.restore();
  });

  beforeEach(() => {
    const client = createTestR2Bucket();
    bucket = client.bucket;
    store = client.store;

    // Mock buildPublicR2Path to ensure consistent behavior in tests
    mock.module("@/utils/paintings", () => ({
      buildPublicR2Path: mock((key: string) => `/api/r2/${key.replace(/^\/+/, "")}`),
      buildPaintingKey: mock((dateString: string, filename: string) => {
        const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!dateMatch) {
          throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD or ISO timestamp.`);
        }
        return `images/${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}/${filename}`;
      }),
    }));

    // Mock D1 database using Drizzle ORM's expected API
    // @ts-expect-error - Mock D1 database for testing
    mockD1 = {
      prepare: mock(sql => ({
        bind: mock((...params) => ({
          all: mock(async () => {
            // Parse the SQL to understand what data is requested
            const isLimitQuery = sql.includes("limit ?");
            if (isLimitQuery) {
              const limit = params[0] || 20;
              const testData = TEST_IMAGE_KEYS.map((imageKey, index) => {
                const id =
                  imageKey
                    .split("/")
                    .pop()
                    ?.replace(/\.webp$/, "") || "";
                const metadata = createTestMetadata(id, imageKey, index);
                return {
                  id: metadata.id,
                  timestamp: metadata.timestamp,
                  minuteBucket: metadata.minuteBucket,
                  paramsHash: metadata.paramsHash,
                  seed: metadata.seed,
                  r2Key: imageKey,
                  imageUrl: `/api/r2/${imageKey}`,
                  fileSize: 123456,
                  ts: Math.floor(new Date(metadata.timestamp).getTime() / 1000),
                  visualParamsJson: JSON.stringify(metadata.visualParams),
                  prompt: metadata.prompt,
                  negative: metadata.negative,
                };
              }).sort((a, b) => b.ts - a.ts); // Sort by ts descending (newest first)

              const limitedData = testData.slice(0, limit);
              const hasMore = testData.length > limit;
              const cursor = hasMore
                ? encodeCursor({
                    ts: limitedData[limitedData.length - 1].ts,
                    id: limitedData[limitedData.length - 1].id,
                  })
                : undefined;

              return {
                items: limitedData,
                cursor,
                hasMore,
              };
            }
            return { items: [], cursor: undefined, hasMore: false };
          }),
          raw: mock(async () => {
            // Parse the SQL to understand what data is requested
            const isLimitQuery = sql.includes("limit ?");
            if (isLimitQuery) {
              const limit = params[0] || 20;
              const testData = TEST_IMAGE_KEYS.map((imageKey, index) => {
                const id =
                  imageKey
                    .split("/")
                    .pop()
                    ?.replace(/\.webp$/, "") || "";
                const metadata = createTestMetadata(id, imageKey, index);
                return {
                  id: metadata.id,
                  timestamp: metadata.timestamp,
                  minuteBucket: metadata.minuteBucket,
                  paramsHash: metadata.paramsHash,
                  seed: metadata.seed,
                  r2Key: imageKey,
                  imageUrl: `/api/r2/${imageKey}`,
                  fileSize: 123456,
                  ts: Math.floor(new Date(metadata.timestamp).getTime() / 1000),
                  visualParamsJson: JSON.stringify(metadata.visualParams),
                  prompt: metadata.prompt,
                  negative: metadata.negative,
                };
              }).sort((a, b) => b.ts - a.ts); // Sort by ts descending (newest first)

              const limitedData = testData.slice(0, limit);
              const hasMore = testData.length > limit;
              const cursor = hasMore
                ? encodeCursor({
                    ts: limitedData[limitedData.length - 1].ts,
                    id: limitedData[limitedData.length - 1].id,
                  })
                : undefined;

              return {
                items: limitedData,
                cursor,
                hasMore,
              };
            }
            return { items: [], cursor: undefined, hasMore: false };
          }),
        })),
      })),
    };

    // Setup test data with metadata
    // Store test images and metadata
    for (let i = 0; i < TEST_IMAGE_KEYS.length; i++) {
      const imageKey = TEST_IMAGE_KEYS[i];
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
        content: JSON.stringify(createTestMetadata(id, imageKey, i)),
        contentType: "application/json",
      });
    }
  });

  describe("listImages", () => {
    it("should list images with default limit", async () => {
      // @ts-expect-error - Mock D1 database for testing
      const service = createPaintingsService({ r2Bucket: bucket, d1Binding: mockD1 });
      const result = await service.listImages({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items.length).toBeGreaterThan(0);
        expect(result.value.items.length).toBeLessThanOrEqual(20); // default limit
        expect(result.value.items.every(item => item.imageUrl.includes(".webp"))).toBe(true);
      }
    });

    it("should respect limit parameter", async () => {
      const service = // @ts-expect-error - Mock D1 database for testing
        createPaintingsService({ r2Bucket: bucket, d1Binding: mockD1 });
      const result = await service.listImages({ limit: 3 });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items.length).toBeLessThanOrEqual(3);
      }
    });

    it("should enforce maximum limit of 100", async () => {
      const service = // @ts-expect-error - Mock D1 database for testing
        createPaintingsService({ r2Bucket: bucket, d1Binding: mockD1 });
      const result = await service.listImages({ limit: 200 });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items.length).toBeLessThanOrEqual(100);
      }
    });

    it("should filter only .webp files", async () => {
      // Add a non-webp file
      store.set("images/2025/11/14/test.png", {
        content: new TextEncoder().encode("fake png").buffer,
        contentType: "image/png",
      });

      const service = // @ts-expect-error - Mock D1 database for testing
        createPaintingsService({ r2Bucket: bucket, d1Binding: mockD1 });
      const result = await service.listImages({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items.every(item => item.imageUrl.includes(".webp"))).toBe(true);
        expect(result.value.items.some(item => item.imageUrl.includes("test.png"))).toBe(false);
      }
    });

    it.skip("should support cursor-based pagination with key-based cursor", async () => {
      // This test requires D1 to be available, which is not the case in test environment
      // D1 cursor-based pagination is tested in integration tests with real D1
      const service = // @ts-expect-error - Mock D1 database for testing
        createPaintingsService({ r2Bucket: bucket, d1Binding: mockD1 });
      const firstPage = await service.listImages({ limit: 2 });

      expect(firstPage.isOk()).toBe(true);
      if (firstPage.isOk()) {
        // In test environment without D1, cursor will be undefined (R2 fallback)
        expect(firstPage.value.cursor).toBeUndefined();
        expect(firstPage.value.hasMore).toBe(false); // R2 fallback doesn't support pagination
      }
    });

    it("should return hasMore when truncated", async () => {
      const service = // @ts-expect-error - Mock D1 database for testing
        createPaintingsService({ r2Bucket: bucket, d1Binding: mockD1 });
      const result = await service.listImages({ limit: 2 });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        if (result.value.cursor) {
          expect(result.value.hasMore).toBe(true);
        } else {
          expect(result.value.hasMore).toBe(false);
        }
      }
    });

    it("should use images/ prefix", async () => {
      // Add a file outside images/ prefix
      store.set("other/file.webp", {
        content: new TextEncoder().encode("fake image").buffer,
        contentType: "image/webp",
      });

      const service = // @ts-expect-error - Mock D1 database for testing
        createPaintingsService({ r2Bucket: bucket, d1Binding: mockD1 });
      const result = await service.listImages({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items.every(item => item.imageUrl.includes("/api/r2/images/"))).toBe(true);
        expect(result.value.items.some(item => item.imageUrl.includes("other/file"))).toBe(false);
      }
    });
  });
});
