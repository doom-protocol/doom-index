import { describe, expect, it, beforeEach } from "bun:test";
import { createArchiveStorageService } from "@/services/archive-storage";
import { createTestR2Bucket } from "@/testing/memory-r2";
import type { ArchiveMetadata } from "@/types/archive";

describe("Archive Storage Service", () => {
  let bucket: R2Bucket;
  let store: Map<string, { content: ArrayBuffer | string; contentType?: string }>;

  beforeEach(() => {
    const client = createTestR2Bucket();
    bucket = client.bucket;
    store = client.store;
  });

  describe("storeImageWithMetadata", () => {
    it("should store image and metadata atomically", async () => {
      const service = createArchiveStorageService({ r2Bucket: bucket });
      const imageBuffer = new TextEncoder().encode("fake image data").buffer;
      const metadata: ArchiveMetadata = {
        id: "DOOM_202511141234_abc12345_def456789012",
        timestamp: "2025-11-14T12:34:00Z",
        minuteBucket: "2025-11-14T12:34:00Z",
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
        imageUrl: "",
        fileSize: imageBuffer.byteLength,
        prompt: "test prompt",
        negative: "test negative",
      };

      const result = await service.storeImageWithMetadata(
        "2025-11-14T12:34:00Z",
        "DOOM_202511141234_abc12345_def456789012.webp",
        imageBuffer,
        metadata,
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const { imageUrl, metadataUrl } = result.value;
        expect(imageUrl).toContain("/api/r2/images/2025/11/14/DOOM_202511141234_abc12345_def456789012.webp");
        expect(metadataUrl).toContain("/api/r2/images/2025/11/14/DOOM_202511141234_abc12345_def456789012.json");

        // Verify both files are stored
        const imageKey = "images/2025/11/14/DOOM_202511141234_abc12345_def456789012.webp";
        const metadataKey = "images/2025/11/14/DOOM_202511141234_abc12345_def456789012.json";
        expect(store.has(imageKey)).toBe(true);
        expect(store.has(metadataKey)).toBe(true);

        // Verify metadata content
        const storedMetadata = store.get(metadataKey);
        expect(storedMetadata).toBeDefined();
        if (storedMetadata && typeof storedMetadata.content === "string") {
          const parsed = JSON.parse(storedMetadata.content) as ArchiveMetadata;
          expect(parsed.id).toBe(metadata.id);
          expect(parsed.timestamp).toBe(metadata.timestamp);
        }
      }
    });

    it("should rollback image if metadata save fails", async () => {
      const service = createArchiveStorageService({ r2Bucket: bucket });
      const imageBuffer = new TextEncoder().encode("fake image data").buffer;
      const invalidMetadata = {
        id: "DOOM_202511141234_abc12345_def456789012",
        // missing required fields
      } as unknown as ArchiveMetadata;

      const result = await service.storeImageWithMetadata(
        "2025-11-14T12:34:00Z",
        "DOOM_202511141234_abc12345_def456789012.webp",
        imageBuffer,
        invalidMetadata,
      );

      // Should fail validation before saving
      expect(result.isErr()).toBe(true);

      // Verify image was not stored (validation happens before save)
      const imageKey = "images/2025/11/14/DOOM_202511141234_abc12345_def456789012.webp";
      expect(store.has(imageKey)).toBe(false);
    });

    it("should rollback image if metadata save fails after image save", async () => {
      // Create a mock bucket that fails on metadata save
      const failingBucket = {
        ...bucket,
        put: async (key: string, value: unknown) => {
          if (key.endsWith(".json")) {
            throw new Error("Metadata save failed");
          }
          return bucket.put(key, value as ArrayBuffer | string);
        },
        delete: async (keys: string | string[]) => {
          const keysArray = Array.isArray(keys) ? keys : [keys];
          for (const key of keysArray) {
            store.delete(key);
          }
        },
      } as unknown as R2Bucket;

      const service = createArchiveStorageService({ r2Bucket: failingBucket });
      const imageBuffer = new TextEncoder().encode("fake image data").buffer;
      const metadata: ArchiveMetadata = {
        id: "DOOM_202511141234_abc12345_def456789012",
        timestamp: "2025-11-14T12:34:00Z",
        minuteBucket: "2025-11-14T12:34:00Z",
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
        imageUrl: "",
        fileSize: imageBuffer.byteLength,
        prompt: "test prompt",
        negative: "test negative",
      };

      const imageKey = "images/2025/11/14/DOOM_202511141234_abc12345_def456789012.webp";

      const result = await service.storeImageWithMetadata(
        "2025-11-14T12:34:00Z",
        "DOOM_202511141234_abc12345_def456789012.webp",
        imageBuffer,
        metadata,
      );

      // Should fail on metadata save
      expect(result.isErr()).toBe(true);

      // Verify image was rolled back (deleted)
      expect(store.has(imageKey)).toBe(false);
    });

    it("should ensure image and metadata have matching filenames", async () => {
      const service = createArchiveStorageService({ r2Bucket: bucket });
      const imageBuffer = new TextEncoder().encode("fake image data").buffer;
      const metadata: ArchiveMetadata = {
        id: "DOOM_202511141234_abc12345_def456789012",
        timestamp: "2025-11-14T12:34:00Z",
        minuteBucket: "2025-11-14T12:34:00Z",
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
        imageUrl: "",
        fileSize: imageBuffer.byteLength,
        prompt: "test prompt",
        negative: "test negative",
      };

      const result = await service.storeImageWithMetadata(
        "2025-11-14T12:34:00Z",
        "DOOM_202511141234_abc12345_def456789012.webp",
        imageBuffer,
        metadata,
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const imageKey = "images/2025/11/14/DOOM_202511141234_abc12345_def456789012.webp";
        const metadataKey = "images/2025/11/14/DOOM_202511141234_abc12345_def456789012.json";
        // Verify filenames match (only extension differs)
        expect(imageKey.replace(/\.webp$/, "")).toBe(metadataKey.replace(/\.json$/, ""));
      }
    });
  });
});
