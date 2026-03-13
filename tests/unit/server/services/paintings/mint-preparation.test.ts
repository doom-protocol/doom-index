import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
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
    glbUrl: "https://example.test/glb-tx",
    id: "painting-1",
    imageUrl: "https://example.test/painting",
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
const uploadNftMetadataBundleMock = mock(async (params: { imageContentType: string; tokenId: string }) => {
  await Promise.resolve();
  return ok({
    baseMetadataUrl: "https://example.test/manifest",
    manifestTxId: "manifest-tx",
    metadataTxId: "metadata-tx",
    resolvedFromProbe: true,
    tokenMetadataUrl: `https://example.test/manifest/${params.tokenId}`,
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
  }));

  void mock.module("@/lib/ardrive-client", () => ({
    createArdriveClient: () => ({
      getBalance: mock(async () => {
        await Promise.resolve();
        return ok({
          controlledWinc: "100",
          effectiveBalance: "100",
          givenApprovals: [],
          receivedApprovals: [],
          winc: "100",
        });
      }),
      getUploadCosts: mock(async () => {
        await Promise.resolve();
        return ok([{ adjustments: [], fees: [], winc: "1" }]);
      }),
      topUpWithTokens: mock(async () => {
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
      }),
    }),
  }));

  void mock.module("@/server/repositories/paintings-repository", () => ({
    createPaintingsRepository: () => ({
      findById: findByIdMock,
      updateMintAssetRefs: updateMintAssetRefsMock,
    }),
  }));

  void mock.module("@/server/services/paintings/arweave-services", () => ({
    buildManifestJson: ({ metadataId, tokenId }: { metadataId: string; tokenId: number | string }) => ({
      manifest: "arweave/paths",
      paths: {
        [String(tokenId)]: {
          id: metadataId,
        },
      },
      version: "0.2.0",
    }),
    buildMetadataJson: ({
      animationUrl,
      imageContentType,
      imageUrl,
      paintingId,
      tokenId,
    }: {
      animationUrl: string;
      imageContentType: string;
      imageUrl: string;
      paintingId: string;
      tokenId: number | string;
    }) => ({
      animation_url: animationUrl,
      image: imageUrl,
      name: `DOOM INDEX #${String(tokenId)}`,
      properties: {
        category: "image",
        files: [
          {
            type: imageContentType,
            uri: imageUrl,
          },
          {
            type: "model/gltf-binary",
            uri: animationUrl,
          },
        ],
      },
      symbol: "DOOM",
      description: `Painting ${paintingId}`,
    }),
    buildTransactionUrl: ({ gatewayBaseUrl, txId }: { gatewayBaseUrl: string; txId: string }) =>
      `${gatewayBaseUrl.replace(/\/$/, "")}/${txId}`,
    ensureTurboUploadFunding: mock(async () => {
      await Promise.resolve();
      return ok({
        currentBalanceWinc: BigInt(100),
        didNotify: false,
        didTopUp: false,
        estimatedCostWinc: BigInt(1),
        remainingBalanceWinc: BigInt(99),
      });
    }),
    parseOptionalBigInt: (value: string | undefined) => (value ? BigInt(value) : undefined),
    uploadNftMetadataBundle: uploadNftMetadataBundleMock,
  }));
}

describe("unit/server/services/paintings/mint-preparation", () => {
  beforeEach(() => {
    registerMintPreparationModuleMocks();
    findByIdMock.mockClear();
    updateMintAssetRefsMock.mockClear();
    uploadNftMetadataBundleMock.mockClear();
  });

  afterEach(() => {
    mock.restore();
  });

  it("detects the painting image content type from response headers and preserves string token ids", async () => {
    const { preparePaintingMintMetadata } = await loadMintPreparationModule();

    const fetchImpl = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      await Promise.resolve();
      if (init?.method === "HEAD") {
        return new Response(null, {
          headers: {
            "content-type": "image/png; charset=utf-8",
          },
          status: 200,
        });
      }

      throw new Error("Unexpected fetch call");
    }) as unknown as typeof fetch;

    const result = await preparePaintingMintMetadata({
      fetchImpl,
      paintingId: "painting-1",
      tokenId: "9007199254740993",
    });

    expect(result.isOk()).toBe(true);
    expect(uploadNftMetadataBundleMock).toHaveBeenCalledTimes(1);
    expect(uploadNftMetadataBundleMock.mock.calls[0]?.[0]).toMatchObject({
      imageContentType: "image/png",
      tokenId: "9007199254740993",
    });
  });
});
