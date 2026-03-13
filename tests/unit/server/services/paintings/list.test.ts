import { describe, expect, it, mock } from "bun:test";
import { ok } from "neverthrow";

import type { PaintingsRepository } from "@/server/repositories/paintings-repository";
import { listImages } from "@/server/services/paintings/list";

describe("unit/server/services/paintings/list", () => {
  it("falls back to safe default visual params when visualParamsJson is malformed", async () => {
    const archiveRepository: PaintingsRepository = {
      findById: mock(async () => {
        await Promise.resolve();
        return ok(null);
      }),
      insert: mock(async () => {
        await Promise.resolve();
        return ok(undefined);
      }),
      updateMintAssetRefs: mock(async () => {
        await Promise.resolve();
        return ok(undefined);
      }),
      list: mock(async () => {
        await Promise.resolve();
        return ok({
          cursor: undefined,
          hasMore: false,
          items: [
            {
              fileSize: 123,
              glbTxId: "glb-tx",
              glbUrl: "https://example.test/glb",
              id: "painting-1",
              imageTxId: "image-tx",
              imageUrl: "https://example.test/image",
              minuteBucket: "2026/03/13/10/00",
              negative: "",
              paramsHash: "hash",
              prompt: "prompt",
              seed: "seed",
              timestamp: "2026-03-13T10:00:00.000Z",
              ts: 1,
              visualParamsJson: "{not-valid-json",
            },
          ],
        });
      }),
    };

    const result = await listImages(undefined, { limit: 1 }, archiveRepository);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    expect(result.value.items[0]?.visualParams).toEqual({
      bioluminescence: 0,
      blueBalance: 0,
      debrisIntensity: 0,
      fogDensity: 0,
      fractalDensity: 0,
      lightIntensity: 0,
      mechanicalPattern: 0,
      metallicRatio: 0,
      organicPattern: 0,
      radiationGlow: 0,
      redHighlight: 0,
      reflectivity: 0,
      shadowDepth: 0,
      skyTint: 0,
      vegetationDensity: 0,
      warmHue: 0,
    });
  });
});
