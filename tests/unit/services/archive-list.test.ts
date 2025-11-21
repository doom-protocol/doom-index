import { describe, expect, it, beforeEach } from "bun:test";
import { createPaintingsService } from "@/services/paintings";
import { createTestR2Bucket } from "../../lib/memory-r2";
import type { PaintingMetadata } from "@/types/paintings";

const TEST_IMAGE_KEYS = [
  "images/2025/11/14/DOOM_202511141200_abc12345_def456789012.webp",
  "images/2025/11/14/DOOM_202511141201_abc12345_def456789012.webp",
  "images/2025/11/14/DOOM_202511141202_abc12345_def456789012.webp",
  "images/2025/11/14/DOOM_202511141203_abc12345_def456789012.webp",
  "images/2025/11/14/DOOM_202511141204_abc12345_def456789012.webp",
];

function createTestMetadata(id: string, imageKey: string): PaintingMetadata {
  return {
    id,
    timestamp: "2025-11-14T12:00:00Z",
    minuteBucket: "2025-11-14T12:00:00Z",
    paramsHash: "abc12345",
    seed: "def456789012",
    mcRounded: {
      CO2: 1000000,
      ICE: 2000000,
      FOREST: 3000000,
      NUKE: 4000000,
      MACHINE: 5000000,
      PANDEMIC: 6000000,
      FEAR: 7000000,
      HOPE: 8000000,
    },
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

  beforeEach(() => {
    const client = createTestR2Bucket();
    bucket = client.bucket;
    store = client.store;

    // Setup test data with metadata
    // Store test images and metadata
    for (const imageKey of TEST_IMAGE_KEYS) {
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
        content: JSON.stringify(createTestMetadata(id, imageKey)),
        contentType: "application/json",
      });
    }
  });

  describe("listImages", () => {
    it("should list images with default limit", async () => {
      const service = createPaintingsService({ r2Bucket: bucket });
      const result = await service.listImages({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items.length).toBeGreaterThan(0);
        expect(result.value.items.length).toBeLessThanOrEqual(20); // default limit
        expect(result.value.items.every(item => item.imageUrl.endsWith(".webp"))).toBe(true);
      }
    });

    it("should respect limit parameter", async () => {
      const service = createPaintingsService({ r2Bucket: bucket });
      const result = await service.listImages({ limit: 3 });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items.length).toBeLessThanOrEqual(3);
      }
    });

    it("should enforce maximum limit of 100", async () => {
      const service = createPaintingsService({ r2Bucket: bucket });
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

      const service = createPaintingsService({ r2Bucket: bucket });
      const result = await service.listImages({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items.every(item => item.imageUrl.endsWith(".webp"))).toBe(true);
        expect(result.value.items.some(item => item.imageUrl.includes("test.png"))).toBe(false);
      }
    });

    it("should support cursor-based pagination with key-based cursor", async () => {
      const service = createPaintingsService({ r2Bucket: bucket });
      const firstPage = await service.listImages({ limit: 2 });

      expect(firstPage.isOk()).toBe(true);
      if (firstPage.isOk() && firstPage.value.cursor) {
        expect(firstPage.value.cursor).toBe(TEST_IMAGE_KEYS[1]);
        const secondPage = await service.listImages({ limit: 2, cursor: firstPage.value.cursor });
        expect(secondPage.isOk()).toBe(true);
        if (secondPage.isOk()) {
          const firstPageKeys = firstPage.value.items.map(item => item.imageUrl.replace("/api/r2/", ""));
          const secondPageKeys = secondPage.value.items.map(item => item.imageUrl.replace("/api/r2/", ""));
          expect(firstPageKeys).not.toEqual(secondPageKeys);
          expect(secondPageKeys[0]).toBe(TEST_IMAGE_KEYS[2]);
        }
      }
    });

    it("should return hasMore when truncated", async () => {
      const service = createPaintingsService({ r2Bucket: bucket });
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

      const service = createPaintingsService({ r2Bucket: bucket });
      const result = await service.listImages({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items.every(item => item.imageUrl.includes("/api/r2/images/"))).toBe(true);
        expect(result.value.items.some(item => item.imageUrl.includes("other/file"))).toBe(false);
      }
    });
  });
});
