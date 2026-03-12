import { describe, expect, it, mock } from "bun:test";
import { err, ok } from "neverthrow";

import {
  buildBaseMetadataUrl,
  buildManifestJson,
  buildMetadataJson,
  buildPreferredAssetUrl,
  buildTokenMetadataUrl,
  ensureTurboUploadFunding,
  uploadNftMetadataBundle,
  uploadPaintingAssetBundle,
} from "@/server/services/paintings/arweave-services";

describe("unit/server/services/paintings/arweave-services", () => {
  it("preserves the token-id-only Arweave path manifest structure", () => {
    expect(
      buildManifestJson({
        metadataId: "metadata-tx",
        tokenId: 42,
      }),
    ).toEqual({
      manifest: "arweave/paths",
      paths: {
        "42": {
          id: "metadata-tx",
        },
      },
      version: "0.2.0",
    });
  });

  it("builds metadata urls from the manifest root plus token id", () => {
    expect(
      buildTokenMetadataUrl({
        gatewayBaseUrl: "https://cache.example/",
        manifestId: "manifest-tx",
        tokenId: 42,
      }),
    ).toBe("https://cache.example/manifest-tx/42");

    expect(
      buildBaseMetadataUrl({
        gatewayBaseUrl: "https://cache.example/",
        manifestId: "manifest-tx",
      }),
    ).toBe("https://cache.example/manifest-tx");
  });

  it("uploads the image and glb painting bundle and returns preferred urls", async () => {
    const uploadFile = mock(async (_bytes: Uint8Array, contentType: string) => {
      await Promise.resolve();
      if (contentType === "image/webp") {
        return ok({
          dataCaches: [],
          fastFinalityIndexes: [],
          id: "image-tx",
          url: "https://permagate.io/image-tx",
        });
      }

      return ok({
        dataCaches: [],
        fastFinalityIndexes: [],
        id: "glb-tx",
        url: "https://permagate.io/glb-tx",
      });
    });

    const result = await uploadPaintingAssetBundle({
      ardrive: {
        uploadFile,
      },
      explicitGatewayBaseUrl: "https://preferred.example/",
      image: {
        bytes: new Uint8Array([1, 2, 3]),
        contentType: "image/webp",
      },
      paintingId: "painting-123",
      glb: {
        bytes: new Uint8Array([4, 5, 6]),
        contentType: "model/gltf-binary",
      },
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      glbTxId: "glb-tx",
      glbUrl: buildPreferredAssetUrl({
        explicitGatewayBaseUrl: "https://preferred.example/",
        uploadResult: { id: "glb-tx" },
      }),
      imageTxId: "image-tx",
      imageUrl: buildPreferredAssetUrl({
        explicitGatewayBaseUrl: "https://preferred.example/",
        uploadResult: { id: "image-tx" },
      }),
    });
  });

  it("uploads metadata and manifest while preserving the existing token path layout", async () => {
    const uploadJson = mock(async (json: object) => {
      await Promise.resolve();
      expect(json).toEqual(
        buildMetadataJson({
          animationUrl: "https://preferred.example/glb-tx",
          imageContentType: "image/webp",
          imageUrl: "https://preferred.example/image-tx",
          paintingId: "painting-123",
          tokenId: 7,
        }),
      );

      return ok({
        dataCaches: [],
        fastFinalityIndexes: [],
        id: "metadata-tx",
        url: "https://permagate.io/metadata-tx",
      });
    });

    const uploadFile = mock(async (bytes: Uint8Array, contentType: string) => {
      await Promise.resolve();
      expect(contentType).toBe("application/x.arweave-manifest+json");
      expect(new TextDecoder().decode(bytes)).toContain('"7"');
      return ok({
        dataCaches: [],
        fastFinalityIndexes: [],
        id: "manifest-tx",
        url: "https://permagate.io/manifest-tx",
      });
    });

    const result = await uploadNftMetadataBundle({
      ardrive: {
        uploadFile,
        uploadJson,
      },
      explicitGatewayBaseUrl: "https://preferred.example/",
      fetchImpl: mock(async () => {
        await Promise.resolve();
        return new Response(null, { status: 200 });
      }) as unknown as typeof fetch,
      glbUrl: "https://preferred.example/glb-tx",
      imageContentType: "image/webp",
      imageUrl: "https://preferred.example/image-tx",
      paintingId: "painting-123",
      tokenId: 7,
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      baseMetadataUrl: "https://preferred.example/manifest-tx",
      manifestTxId: "manifest-tx",
      metadataTxId: "metadata-tx",
      resolvedFromProbe: true,
      tokenMetadataUrl: "https://preferred.example/manifest-tx/7",
    });
  });

  it("checks Turbo funding before upload when a threshold is configured", async () => {
    const notify = mock(async (_message: string) => Promise.resolve());
    let balanceCalls = 0;

    const result = await ensureTurboUploadFunding({
      ardrive: {
        getBalance: async () => {
          await Promise.resolve();
          balanceCalls += 1;
          return ok({
            controlledWinc: balanceCalls === 1 ? "100" : "300",
            effectiveBalance: balanceCalls === 1 ? "100" : "300",
            givenApprovals: [],
            receivedApprovals: [],
            winc: balanceCalls === 1 ? "100" : "300",
          });
        },
        getUploadCosts: async () => {
          await Promise.resolve();
          return ok([{ adjustments: [], fees: [], winc: "80" }]);
        },
        topUpWithTokens: async () => {
          await Promise.resolve();
          return ok({
            id: "fund-1",
            owner: "owner",
            quantity: "1000",
            status: "confirmed",
            target: "target",
            token: "arweave",
            winc: "900",
          });
        },
      },
      autoTopUpAmountWinston: BigInt(1000),
      byteCounts: [1024],
      notify,
      notifyThresholdWinc: BigInt(50),
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      currentBalanceWinc: BigInt(100),
      didNotify: true,
      didTopUp: true,
      estimatedCostWinc: BigInt(80),
      remainingBalanceWinc: BigInt(220),
      topUpTransactionId: "fund-1",
    });
  });

  it("reports that the pending upload is likely insufficient when projected balance goes negative", async () => {
    const notify = mock(async (_message: string) => Promise.resolve());

    await ensureTurboUploadFunding({
      ardrive: {
        getBalance: async () => {
          await Promise.resolve();
          return ok({
            controlledWinc: "50",
            effectiveBalance: "50",
            givenApprovals: [],
            receivedApprovals: [],
            winc: "50",
          });
        },
        getUploadCosts: async () => {
          await Promise.resolve();
          return ok([{ adjustments: [], fees: [], winc: "80" }]);
        },
        topUpWithTokens: async () => {
          await Promise.resolve();
          return ok({
            id: "fund-1",
            owner: "owner",
            quantity: "1000",
            status: "confirmed",
            target: "target",
            token: "arweave",
            winc: "900",
          });
        },
      },
      byteCounts: [1024],
      notify,
    });

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0]?.[0]).toContain("likely insufficient");
  });

  it("fails when projected balance is insufficient and auto top-up is not configured", async () => {
    const result = await ensureTurboUploadFunding({
      ardrive: {
        getBalance: async () => {
          await Promise.resolve();
          return ok({
            controlledWinc: "50",
            effectiveBalance: "50",
            givenApprovals: [],
            receivedApprovals: [],
            winc: "50",
          });
        },
        getUploadCosts: async () => {
          await Promise.resolve();
          return ok([{ adjustments: [], fees: [], winc: "80" }]);
        },
        topUpWithTokens: async () => {
          await Promise.resolve();
          return err({
            type: "InternalError",
            message: "top-up should not run",
          });
        },
      },
      byteCounts: [1024],
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("insufficient");
  });

  it("fails when projected balance is still insufficient after auto top-up", async () => {
    let balanceCalls = 0;
    const result = await ensureTurboUploadFunding({
      ardrive: {
        getBalance: async () => {
          await Promise.resolve();
          balanceCalls += 1;
          return ok({
            controlledWinc: balanceCalls === 1 ? "50" : "60",
            effectiveBalance: balanceCalls === 1 ? "50" : "60",
            givenApprovals: [],
            receivedApprovals: [],
            winc: balanceCalls === 1 ? "50" : "60",
          });
        },
        getUploadCosts: async () => {
          await Promise.resolve();
          return ok([{ adjustments: [], fees: [], winc: "80" }]);
        },
        topUpWithTokens: async () => {
          await Promise.resolve();
          return ok({
            id: "fund-1",
            owner: "owner",
            quantity: "1000",
            status: "confirmed",
            target: "target",
            token: "arweave",
            winc: "10",
          });
        },
      },
      autoTopUpAmountWinston: BigInt(1000),
      byteCounts: [1024],
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("insufficient");
  });
});
