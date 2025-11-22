import { describe, expect, it, beforeEach } from "bun:test";
import { createPaintingsService } from "@/services/paintings";
import { createTestR2Bucket } from "../../lib/memory-r2";
import type { PaintingMetadata } from "@/types/paintings";

function createTestMetadata(id: string, imageKey: string, timestamp?: string): PaintingMetadata {
  return {
    id,
    timestamp: timestamp || "2025-11-14T12:00:00Z",
    minuteBucket: timestamp || "2025-11-14T12:00:00Z",
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

describe("Archive List Service - Date Filtering", () => {
  let bucket: R2Bucket;
  let store: Map<string, { content: ArrayBuffer | string; contentType?: string }>;

  beforeEach(() => {
    const client = createTestR2Bucket();
    bucket = client.bucket;
    store = client.store;

    // Setup test data across multiple dates with metadata
    const testImages = [
      // 2025-11-14
      "images/2025/11/14/DOOM_202511141200_abc12345_def456789012.webp",
      "images/2025/11/14/DOOM_202511141201_abc12345_def456789012.webp",
      // 2025-11-15
      "images/2025/11/15/DOOM_202511151200_abc12345_def456789012.webp",
      "images/2025/11/15/DOOM_202511151201_abc12345_def456789012.webp",
      // 2025-11-16
      "images/2025/11/16/DOOM_202511161200_abc12345_def456789012.webp",
    ];

    for (const imageKey of testImages) {
      const id =
        imageKey
          .split("/")
          .pop()
          ?.replace(/\.webp$/, "") || "";
      const metadataKey = imageKey.replace(/\.webp$/, ".json");
      // Extract date from path for timestamp
      const dateMatch = imageKey.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
      const timestamp = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T12:00:00Z`
        : "2025-11-14T12:00:00Z";

      store.set(imageKey, {
        content: new TextEncoder().encode("fake image").buffer,
        contentType: "image/webp",
      });

      store.set(metadataKey, {
        content: JSON.stringify(createTestMetadata(id, imageKey, timestamp)),
        contentType: "application/json",
      });
    }
  });

  describe("listImages with date filtering", () => {
    it("should filter by single date prefix", async () => {
      const service = createPaintingsService({ r2Bucket: bucket });
      const result = await service.listImages({
        prefix: "images/2025/11/14/",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items.length).toBe(2);
        expect(result.value.items.every(item => item.imageUrl.includes("2025/11/14"))).toBe(true);
      }
    });

    it("should filter by date range using startDate and endDate", async () => {
      const service = createPaintingsService({ r2Bucket: bucket });
      const result = await service.listImages({
        startDate: "2025-11-14",
        endDate: "2025-11-15",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Should include images from both dates
        const dates = result.value.items.map(item => {
          const match = item.imageUrl.match(/images\/(\d{4}\/\d{2}\/\d{2})/);
          return match ? match[1] : "";
        });
        expect(dates).toContain("2025/11/14");
        expect(dates).toContain("2025/11/15");
        expect(dates).not.toContain("2025/11/16");
      }
    });

    it("should exclude items after endDate using startAfter", async () => {
      const service = createPaintingsService({ r2Bucket: bucket });
      const result = await service.listImages({
        prefix: "images/2025/11/",
        startAfter: "images/2025/11/15/DOOM_202511151201_abc12345_def456789012.webp",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Should only include items after the startAfter key
        expect(result.value.items.every(item => !item.imageUrl.includes("2025/11/14"))).toBe(true);
        expect(result.value.items.every(item => !item.imageUrl.includes("2025/11/15"))).toBe(true);
      }
    });

    it("should handle date range spanning multiple days", async () => {
      const service = createPaintingsService({ r2Bucket: bucket });
      const result = await service.listImages({
        startDate: "2025-11-14",
        endDate: "2025-11-16",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Should include all dates in range
        const dates = result.value.items.map(item => {
          const match = item.imageUrl.match(/images\/(\d{4}\/\d{2}\/\d{2})/);
          return match ? match[1] : "";
        });
        expect(dates).toContain("2025/11/14");
        expect(dates).toContain("2025/11/15");
        expect(dates).toContain("2025/11/16");
      }
    });
  });
});
