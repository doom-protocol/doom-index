import { describe, expect, it, beforeEach } from "bun:test";
import { createArchiveListService } from "@/services/archive-list";
import { createTestR2Bucket } from "@/testing/memory-r2";
import type { ArchiveMetadata } from "@/types/archive";

describe("Archive List Service - Metadata Loading", () => {
  let bucket: R2Bucket;
  let store: Map<string, { content: ArrayBuffer | string; contentType?: string }>;

  beforeEach(() => {
    const client = createTestR2Bucket();
    bucket = client.bucket;
    store = client.store;

    // Setup test data with metadata
    const imageKey = "images/2025/11/14/DOOM_202511141200_abc12345_def456789012.webp";
    const metadataKey = "images/2025/11/14/DOOM_202511141200_abc12345_def456789012.json";

    const metadata: ArchiveMetadata = {
      id: "DOOM_202511141200_abc12345_def456789012",
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
      imageUrl: "/api/r2/images/2025/11/14/DOOM_202511141200_abc12345_def456789012.webp",
      fileSize: 123456,
      prompt: "test prompt",
      negative: "test negative",
    };

    store.set(imageKey, {
      content: new TextEncoder().encode("fake image").buffer,
      contentType: "image/webp",
    });

    store.set(metadataKey, {
      content: JSON.stringify(metadata),
      contentType: "application/json",
    });
  });

  describe("listImages with metadata loading", () => {
    it("should load metadata for images", async () => {
      const service = createArchiveListService({ r2Bucket: bucket });
      const result = await service.listImages({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items.length).toBe(1);
        const item = result.value.items[0];
        expect(item.timestamp).toBe("2025-11-14T12:00:00Z");
        expect(item.paramsHash).toBe("abc12345");
        expect(item.seed).toBe("def456789012");
        expect(item.prompt).toBe("test prompt");
        expect(item.negative).toBe("test negative");
        expect(item.mcRounded.CO2).toBe(1000000);
      }
    });

    it("should skip images without metadata", async () => {
      // Add an image without metadata
      const imageKeyWithoutMetadata = "images/2025/11/14/DOOM_202511141201_xyz98765_abc123456789.webp";
      store.set(imageKeyWithoutMetadata, {
        content: new TextEncoder().encode("fake image").buffer,
        contentType: "image/webp",
      });

      const service = createArchiveListService({ r2Bucket: bucket });
      const result = await service.listImages({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Should only include the image with metadata
        expect(result.value.items.length).toBe(1);
        expect(result.value.items[0].id).toBe("DOOM_202511141200_abc12345_def456789012");
      }
    });

    it("should skip images with invalid metadata", async () => {
      // Add an image with invalid metadata
      const imageKeyInvalid = "images/2025/11/14/DOOM_202511141201_xyz98765_abc123456789.webp";
      const metadataKeyInvalid = "images/2025/11/14/DOOM_202511141201_xyz98765_abc123456789.json";

      store.set(imageKeyInvalid, {
        content: new TextEncoder().encode("fake image").buffer,
        contentType: "image/webp",
      });

      store.set(metadataKeyInvalid, {
        content: JSON.stringify({ invalid: "metadata" }),
        contentType: "application/json",
      });

      const service = createArchiveListService({ r2Bucket: bucket });
      const result = await service.listImages({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Should only include the image with valid metadata
        expect(result.value.items.length).toBe(1);
        expect(result.value.items[0].id).toBe("DOOM_202511141200_abc12345_def456789012");
      }
    });

    it("should load metadata in parallel", async () => {
      // Add multiple images with metadata
      const images = [
        {
          imageKey: "images/2025/11/14/DOOM_202511141201_abc12345_def456789012.webp",
          metadataKey: "images/2025/11/14/DOOM_202511141201_abc12345_def456789012.json",
          id: "DOOM_202511141201_abc12345_def456789012",
        },
        {
          imageKey: "images/2025/11/14/DOOM_202511141202_abc12345_def456789012.webp",
          metadataKey: "images/2025/11/14/DOOM_202511141202_abc12345_def456789012.json",
          id: "DOOM_202511141202_abc12345_def456789012",
        },
      ];

      for (const { imageKey, metadataKey, id } of images) {
        store.set(imageKey, {
          content: new TextEncoder().encode("fake image").buffer,
          contentType: "image/webp",
        });

        const metadata: ArchiveMetadata = {
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

        store.set(metadataKey, {
          content: JSON.stringify(metadata),
          contentType: "application/json",
        });
      }

      const service = createArchiveListService({ r2Bucket: bucket });
      const result = await service.listImages({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Should include all images with valid metadata
        expect(result.value.items.length).toBe(3);
        expect(result.value.items.every(item => item.timestamp !== "")).toBe(true);
      }
    });
  });
});
