import { describe, expect, it, beforeEach } from "bun:test";
import { createArchiveService } from "@/services/archive";
import { createTestR2Bucket } from "../../lib/memory-r2";
import type { ArchiveMetadata } from "@/types/archive";

function createTestMetadata(id: string, imageKey: string, timestamp: string): ArchiveMetadata {
  return {
    id,
    timestamp,
    minuteBucket: timestamp,
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

describe("Archive List Service - Response Construction", () => {
  let bucket: R2Bucket;
  let store: Map<string, { content: ArrayBuffer | string; contentType?: string }>;

  beforeEach(() => {
    const client = createTestR2Bucket();
    bucket = client.bucket;
    store = client.store;
  });

  describe("response construction", () => {
    it("should return items in the order provided by R2 (lexicographic ascending)", async () => {
      // Setup images with different timestamps
      const images = [
        {
          imageKey: "images/2025/11/14/DOOM_202511141200_abc12345_def456789012.webp",
          timestamp: "2025-11-14T12:00:00Z",
        },
        {
          imageKey: "images/2025/11/14/DOOM_202511141201_abc12345_def456789012.webp",
          timestamp: "2025-11-14T12:01:00Z",
        },
        {
          imageKey: "images/2025/11/14/DOOM_202511141202_abc12345_def456789012.webp",
          timestamp: "2025-11-14T12:02:00Z",
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

      const service = createArchiveService({ r2Bucket: bucket });
      const result = await service.listImages({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items.length).toBe(3);
        // Should preserve lexicographic order from R2
        expect(result.value.items[0].timestamp).toBe("2025-11-14T12:00:00Z");
        expect(result.value.items[1].timestamp).toBe("2025-11-14T12:01:00Z");
        expect(result.value.items[2].timestamp).toBe("2025-11-14T12:02:00Z");
      }
    });

    it("should include pagination info in response", async () => {
      // Setup enough images to trigger pagination
      const images = Array.from({ length: 25 }, (_, i) => ({
        imageKey: `images/2025/11/14/DOOM_20251114120${String(i).padStart(1, "0")}_abc12345_def456789012.webp`,
        timestamp: `2025-11-14T12:${String(i).padStart(2, "0")}:00Z`,
      }));

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

      const service = createArchiveService({ r2Bucket: bucket });
      const result = await service.listImages({ limit: 20 });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items.length).toBeLessThanOrEqual(20);
        // Should have pagination info
        expect(result.value.hasMore).toBeDefined();
        if (result.value.hasMore) {
          expect(result.value.cursor).toBeDefined();
        }
      }
    });

    it("should generate public URLs for all items", async () => {
      const imageKey = "images/2025/11/14/DOOM_202511141200_abc12345_def456789012.webp";
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
        content: JSON.stringify(createTestMetadata(id, imageKey, "2025-11-14T12:00:00Z")),
        contentType: "application/json",
      });

      const service = createArchiveService({ r2Bucket: bucket });
      const result = await service.listImages({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items.length).toBe(1);
        const item = result.value.items[0];
        expect(item.imageUrl).toContain("/api/r2/");
        expect(item.imageUrl).toContain("images/2025/11/14/DOOM_202511141200_abc12345_def456789012.webp");
      }
    });
  });
});
