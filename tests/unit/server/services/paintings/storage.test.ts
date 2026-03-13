import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { ok } from "neverthrow";

const ensureTurboUploadFundingMock = mock(async () => {
  await Promise.resolve();
  return ok({
    currentBalanceWinc: BigInt(100),
    didNotify: false,
    didTopUp: false,
    estimatedCostWinc: BigInt(1),
    remainingBalanceWinc: BigInt(99),
  });
});
const uploadPaintingImageAssetMock = mock(async () => {
  await Promise.resolve();
  return ok({
    imageTxId: "image-tx",
    imageUrl: "https://preferred.example/image-tx",
  });
});
const uploadPaintingGlbAssetMock = mock(async () => {
  await Promise.resolve();
  return ok({
    glbTxId: "glb-tx",
    glbUrl: "https://preferred.example/glb-tx",
  });
});
const uploadNftMetadataBundleMock = mock(async () => {
  await Promise.resolve();
  return ok({
    baseMetadataUrl: "https://preferred.example/manifest-tx",
    manifestTxId: "manifest-tx",
    metadataTxId: "metadata-tx",
    resolvedFromProbe: true,
    tokenMetadataUrl: "https://preferred.example/manifest-tx/1",
  });
});
const buildFramedPaintingGlbFromPublicFrameMock = mock(async () => {
  await Promise.resolve();
  return ok(new ArrayBuffer(8));
});

function registerStorageModuleMocks() {
  void mock.module("@/env", () => ({
    env: {
      ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON: undefined,
      ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC: undefined,
      ARDRIVE_TURBO_SECRET_KEY: '{"kty":"RSA"}',
      ARWEAVE_GATEWAY_BASE_URL: "https://preferred.example",
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
      uploadFile: mock(async () => {
        await Promise.resolve();
        return ok({
          dataCaches: [],
          fastFinalityIndexes: [],
          id: "image-tx",
          url: "https://permagate.io/image-tx",
        });
      }),
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
    ensureTurboUploadFunding: ensureTurboUploadFundingMock,
    parseOptionalBigInt: (value: string | undefined) => (value ? BigInt(value) : undefined),
    uploadNftMetadataBundle: uploadNftMetadataBundleMock,
    uploadPaintingGlbAsset: uploadPaintingGlbAssetMock,
    uploadPaintingImageAsset: uploadPaintingImageAssetMock,
  }));

  void mock.module("@/server/services/paintings/framed-painting-bundle-service", () => ({
    buildFramedPaintingGlbFromPublicFrame: buildFramedPaintingGlbFromPublicFrameMock,
  }));
}

describe("unit/server/services/paintings/storage", () => {
  beforeEach(() => {
    registerStorageModuleMocks();
    ensureTurboUploadFundingMock.mockClear();
    uploadNftMetadataBundleMock.mockClear();
    uploadPaintingGlbAssetMock.mockClear();
    uploadPaintingImageAssetMock.mockClear();
    buildFramedPaintingGlbFromPublicFrameMock.mockClear();
  });

  afterEach(() => {
    mock.restore();
  });

  it("uploads only the image during recurring storage and skips GLB composition", async () => {
    const { storePaintingAssets } = await import("@/server/services/paintings/storage");

    const result = await storePaintingAssets({
      imageBuffer: new Uint8Array([1, 2, 3]).buffer,
      imageContentType: "image/webp",
      paintingId: "painting-123",
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      imageTxId: "image-tx",
      imageUrl: "https://preferred.example/image-tx",
    });
    expect(uploadPaintingImageAssetMock).toHaveBeenCalledTimes(1);
    expect(buildFramedPaintingGlbFromPublicFrameMock).not.toHaveBeenCalled();
  });
});
