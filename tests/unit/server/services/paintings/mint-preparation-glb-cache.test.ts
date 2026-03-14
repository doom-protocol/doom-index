import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { readFile } from "node:fs/promises";
import { ok } from "neverthrow";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

type MintPreparationModule = typeof import("@/server/services/paintings/mint-preparation");

async function loadMintPreparationModule(): Promise<MintPreparationModule> {
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/server/services/paintings/mint-preparation.ts"));
  moduleUrl.searchParams.set("test", `${String(Date.now())}-${String(Math.random())}`);
  return (await import(moduleUrl.href)) as MintPreparationModule;
}

const findByIdMock = mock(async () => {
  await Promise.resolve();
  return ok({
    fileSize: 123,
    glbUrl: undefined,
    id: "painting-1",
    imageUrl: "https://example.test/painting.webp",
    minuteBucket: "2026/03/13/10/00",
    negative: "",
    paramsHash: "hash",
    prompt: "prompt",
    seed: "seed",
    timestamp: "2026-03-13T10:00:00.000Z",
    visualParams: {
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
    },
  });
});
const updateMintAssetRefsMock = mock(async () => {
  await Promise.resolve();
  return ok(undefined);
});
const getBalanceMock = mock(async () => {
  await Promise.resolve();
  return ok({
    controlledWinc: "100",
    effectiveBalance: "100",
    givenApprovals: [],
    receivedApprovals: [],
    winc: "100",
  });
});
const getUploadCostsMock = mock(async () => {
  await Promise.resolve();
  return ok([{ adjustments: [], fees: [], winc: "1" }]);
});
const topUpWithTokensMock = mock(async () => {
  await Promise.resolve();
  return ok({
    id: "topup-tx",
    owner: "owner",
    quantity: "1",
    status: "confirmed",
    target: "target",
    token: "arweave",
    winc: "1",
  });
});
const uploadFileMock = mock(async (_bytes: Uint8Array, contentType: string) => {
  await Promise.resolve();
  return ok({
    dataCaches: [],
    fastFinalityIndexes: [],
    id: contentType === "model/gltf-binary" ? "glb-tx" : "manifest-tx",
    url: "https://permagate.io/upload-tx",
  });
});
const uploadJsonMock = mock(async (json: object) => {
  await Promise.resolve();
  return ok({
    dataCaches: [],
    fastFinalityIndexes: [],
    id: "metadata-tx",
    json,
    url: "https://permagate.io/metadata-tx",
  });
});

function registerMintPreparationModuleMocks() {
  void mock.module("@/env", () => ({
    env: {
      ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON: undefined,
      ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC: undefined,
      ARDRIVE_TURBO_SECRET_KEY: '{"kty":"RSA"}',
      ARWEAVE_GATEWAY_BASE_URL: "https://example.test",
    },
    isDevelopment: () => false,
    publicEnv: {
      NEXT_PUBLIC_BASE_URL: "https://example.test",
    },
  }));

  void mock.module("@/lib/ardrive-client", () => ({
    createArdriveClient: () => ({
      getBalance: getBalanceMock,
      getUploadCosts: getUploadCostsMock,
      topUpWithTokens: topUpWithTokensMock,
      uploadFile: uploadFileMock,
      uploadJson: uploadJsonMock,
    }),
  }));

  void mock.module("@/server/repositories/paintings-repository", () => ({
    createPaintingsRepository: () => ({
      findById: findByIdMock,
      updateMintAssetRefs: updateMintAssetRefsMock,
    }),
  }));
}

describe("unit/server/services/paintings/mint-preparation glb cache", () => {
  beforeEach(() => {
    registerMintPreparationModuleMocks();
    findByIdMock.mockClear();
    updateMintAssetRefsMock.mockClear();
    getBalanceMock.mockClear();
    getUploadCostsMock.mockClear();
    topUpWithTokensMock.mockClear();
    uploadFileMock.mockClear();
    uploadJsonMock.mockClear();
  });

  afterEach(() => {
    mock.restore();
  });

  it("uploads and caches a GLB when the painting does not have one yet", async () => {
    const { preparePaintingMintMetadata } = await loadMintPreparationModule();
    const rootDir = process.cwd();
    const imageBytes = await readFile(join(rootDir, "public/placeholder-painting.webp"));

    const fetchImpl = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      await Promise.resolve();
      const url =
        typeof _input === "string"
          ? _input
          : _input instanceof URL
            ? _input.toString()
            : _input instanceof Request
              ? _input.url
              : "";
      if (init?.method === "HEAD") {
        return new Response(null, {
          headers: {
            "content-type": "image/webp",
          },
          status: 200,
        });
      }

      if (url.endsWith("/manifest-tx/42")) {
        return new Response("{}", {
          headers: {
            "content-type": "application/json",
          },
          status: 200,
        });
      }

      return new Response(imageBytes, {
        headers: {
          "content-type": "image/webp",
        },
        status: 200,
      });
    }) as unknown as typeof fetch;

    const result = await preparePaintingMintMetadata({
      fetchImpl,
      paintingId: "painting-1",
      tokenId: "42",
    });

    expect(result.isOk()).toBe(true);
    expect(uploadFileMock).toHaveBeenCalledTimes(2);
    const firstGlbUploadCall = uploadFileMock.mock.calls.find((call) => call[1] === "model/gltf-binary") as unknown as
      | [
          {
            byteLength: number;
          },
          string,
        ]
      | undefined;
    expect(firstGlbUploadCall?.[0].byteLength).toBeGreaterThan(16);
    expect(updateMintAssetRefsMock).toHaveBeenCalledWith("painting-1", {
      glbTxId: "glb-tx",
      glbUrl: "https://example.test/glb-tx",
    });
    expect(uploadJsonMock.mock.calls[0]?.[0]).toMatchObject({
      animation_url: "https://example.test/glb-tx",
      image: "https://example.test/painting.webp",
      name: "DOOM NFT #42",
    });
    expect(result._unsafeUnwrap()).toEqual({
      baseMetadataUrl: "https://example.test/manifest-tx",
      manifestTxId: "manifest-tx",
      metadataTxId: "metadata-tx",
      resolvedFromProbe: true,
      tokenMetadataUrl: "https://example.test/manifest-tx/42",
    });
  });
});
