import { describe, expect, it, beforeEach } from "bun:test";
import { createGenerationService } from "@/services/generation";
import { createArchiveStorageService } from "@/services/archive-storage";
import { createTestR2Bucket } from "@/testing/memory-r2";
import { createPromptService } from "@/services/prompt";
import type { MarketCapService } from "@/services/market-cap";
import type { ImageProvider } from "@/types/domain";
import { ok } from "neverthrow";
import type { McMap } from "@/constants/token";

describe("Generation Service with Archive Integration", () => {
  let bucket: R2Bucket;
  let store: Map<string, { content: ArrayBuffer | string; contentType?: string }>;

  beforeEach(() => {
    const client = createTestR2Bucket();
    bucket = client.bucket;
    store = client.store;
  });

  it("should save metadata when generating image", async () => {
    const archiveStorage = createArchiveStorageService({ r2Bucket: bucket });
    const mockMarketCapService: MarketCapService = {
      getMcMap: async () =>
        ok({
          CO2: 1000000,
          ICE: 2000000,
          FOREST: 3000000,
          NUKE: 4000000,
          MACHINE: 5000000,
          PANDEMIC: 6000000,
          FEAR: 7000000,
          HOPE: 8000000,
        } as McMap),
      getRoundedMcMap: async () =>
        ok({
          CO2: 1000000,
          ICE: 2000000,
          FOREST: 3000000,
          NUKE: 4000000,
          MACHINE: 5000000,
          PANDEMIC: 6000000,
          FEAR: 7000000,
          HOPE: 8000000,
        } as McMap),
    };

    const mockImageProvider: ImageProvider = {
      name: "mock",
      generate: async () =>
        ok({
          imageBuffer: new TextEncoder().encode("fake image").buffer,
          providerMeta: {},
        }),
    };

    const promptService = createPromptService();
    const stateService = {
      readGlobalState: async () => ok(null),
      writeGlobalState: async () => ok(undefined),
      readTokenState: async () => ok(null),
      writeTokenStates: async () => ok(undefined),
      writeRevenue: async () => ok(undefined),
      readRevenue: async () => ok(null),
    };

    const revenueEngine = {
      calculateMinuteRevenue: () =>
        ok({
          perTokenFee: {
            CO2: 0,
            ICE: 0,
            FOREST: 0,
            NUKE: 0,
            MACHINE: 0,
            PANDEMIC: 0,
            FEAR: 0,
            HOPE: 0,
          },
          totalFee: 0,
          monthlyCost: 0,
          netProfit: 0,
        }),
    };

    // Create generation service with archive storage
    const generationService = createGenerationService({
      marketCapService: mockMarketCapService,
      promptService,
      imageProvider: mockImageProvider,
      stateService,
      revenueEngine,
      archiveStorageService: archiveStorage,
    });

    const result = await generationService.evaluateMinute();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.status).toBe("generated");
      expect(result.value.imageUrl).toBeDefined();

      // Verify metadata was saved
      const metadataKeys = Array.from(store.keys()).filter(key => key.endsWith(".json"));
      expect(metadataKeys.length).toBeGreaterThan(0);

      // Verify image was saved with date prefix
      const imageKeys = Array.from(store.keys()).filter(key => key.endsWith(".webp"));
      expect(imageKeys.length).toBeGreaterThan(0);
      const imageKey = imageKeys[0];
      expect(imageKey).toMatch(/^images\/\d{4}\/\d{2}\/\d{2}\//);

      // Verify corresponding metadata exists
      const metadataKey = imageKey.replace(/\.webp$/, ".json");
      expect(store.has(metadataKey)).toBe(true);
    }
  });
});
