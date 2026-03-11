import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { err, ok } from "neverthrow";

import { clearLogCalls, createLoggerMockFactory, findLogCall } from "../../mocks/logger";
import { createTestR2Bucket } from "../../lib/memory-r2";

const { mockFactory: loggerMockFactory, calls } = createLoggerMockFactory();
void mock.module("@/utils/logger", loggerMockFactory);

describe("Archive list logging", () => {
  beforeEach(() => {
    clearLogCalls(calls);
  });

  afterEach(() => {
    mock.restore();
  });

  it("uses debug logs when D1 falls back because the paintings table is missing", async () => {
    const { listImages } = await import("@/server/services/paintings/list");
    const { bucket, store } = createTestR2Bucket();

    const imageKey = "images/2025/11/14/DOOM_202511141200_abc12345_def456789012.webp";
    const metadataKey = imageKey.replace(/\.webp$/, ".json");

    store.set(imageKey, {
      content: new TextEncoder().encode("fake image").buffer,
      contentType: "image/webp",
    });
    store.set(metadataKey, {
      content: JSON.stringify({
        id: "DOOM_202511141200_abc12345_def456789012",
        timestamp: "2025-11-14T12:00:00Z",
        minuteBucket: "2025-11-14T12:00:00Z",
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
        fileSize: 10,
        prompt: "test prompt",
        negative: "test negative",
      }),
      contentType: "application/json",
    });

    const result = await listImages(
      bucket,
      undefined,
      { limit: 1 },
      {
        list: async () => {
          await Promise.resolve();
          return err({
            type: "StorageError" as const,
            op: "list" as const,
            key: "paintings",
            message: "D1 list failed: no such table: paintings: SQLITE_ERROR",
          });
        },
        insert: async () => {
          await Promise.resolve();
          return ok(undefined);
        },
        findById: async () => {
          await Promise.resolve();
          return ok(null);
        },
      },
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.items).toHaveLength(1);
    }
    expect(findLogCall(calls, "debug", "archive.list.d1-fallback.missing-table")).toBeDefined();
    expect(findLogCall(calls, "warn", "archive.list.d1-fallback")).toBeUndefined();
  });
});
