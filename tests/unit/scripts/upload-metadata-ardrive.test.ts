import { describe, expect, it, mock } from "bun:test";
import { ok } from "neverthrow";

import {
  buildGatewayBaseUrls,
  buildMetadataJson,
  buildManifestJson,
  buildPreferredAssetUrl,
  buildTransactionUrl,
  buildTokenMetadataUrl,
  ensureTurboUploadFunding,
  normalizeGatewayBaseUrl,
  parseOptionalBigInt,
  resolveTokenMetadataGateway,
} from "@/server/services/paintings/arweave-services";
import { inferContentTypeFromPath } from "@/server/services/paintings/asset-loader";
import { parseArgs } from "../../../scripts/upload-metadata-ardrive";

describe("unit/scripts/upload-metadata-ardrive", () => {
  it("requires token id, thumbnail, and glb inputs", () => {
    expect(() => parseArgs(["--token-id", "1", "--thumbnail", "thumb.webp"])).toThrow(
      "Error: --glb <path|url> is required",
    );
    expect(() => parseArgs(["--token-id", "1", "--glb", "model.glb"])).toThrow(
      "Error: --thumbnail <path|url> is required",
    );
    expect(() => parseArgs(["--thumbnail", "thumb.webp", "--glb", "model.glb"])).toThrow(
      "Error: --token-id <n> is required",
    );
  });

  it("parses explicit asset inputs and optional painting id", () => {
    expect(
      parseArgs([
        "--token-id",
        "1",
        "--thumbnail",
        "https://example.com/thumb.webp",
        "--glb",
        "/tmp/model.glb",
        "--gateway",
        "https://gateway.example/",
        "--painting-id",
        "painting-123",
        "--dry-run",
      ]),
    ).toEqual({
      dryRun: true,
      fixture: false,
      gateway: "https://gateway.example/",
      glb: "/tmp/model.glb",
      paintingId: "painting-123",
      thumbnail: "https://example.com/thumb.webp",
      tokenId: 1,
    });
  });

  it("accepts token id zero", () => {
    expect(
      parseArgs(["--token-id", "0", "--thumbnail", "https://example.com/thumb.webp", "--glb", "/tmp/model.glb"]),
    ).toEqual({
      dryRun: false,
      fixture: false,
      gateway: undefined,
      glb: "/tmp/model.glb",
      paintingId: undefined,
      thumbnail: "https://example.com/thumb.webp",
      tokenId: 0,
    });
  });

  it("rejects missing option values instead of consuming the next flag", () => {
    expect(() => parseArgs(["--token-id", "1", "--thumbnail", "--glb", "model.glb"])).toThrow(
      "Error: --thumbnail requires a value",
    );
    expect(() => parseArgs(["--token-id"])).toThrow("Error: --token-id requires a value");
    expect(() => parseArgs(["--token-id", "1", "--thumbnail", "thumb.webp", "--glb", "--dry-run"])).toThrow(
      "Error: --glb requires a value",
    );
  });

  it("normalizes gateway base urls and keeps explicit gateways first", () => {
    expect(normalizeGatewayBaseUrl("https://gateway.example///")).toBe("https://gateway.example");
    expect(
      buildGatewayBaseUrls({
        explicitGatewayBaseUrl: "https://preferred.example/",
      }),
    ).toEqual(["https://preferred.example", "https://permagate.io"]);
  });

  it("infers content types from file extensions", () => {
    expect(inferContentTypeFromPath("thumbnail.png")).toBe("image/png");
    expect(inferContentTypeFromPath("thumbnail.webp")).toBe("image/webp");
    expect(inferContentTypeFromPath("thumbnail.jpg")).toBe("image/jpeg");
    expect(inferContentTypeFromPath("thumbnail.unknown")).toBe("application/octet-stream");
  });

  it("builds metadata.json from uploaded asset URLs", () => {
    expect(
      buildMetadataJson({
        imageContentType: "image/webp",
        imageUrl: "https://arweave.net/image-tx",
        paintingId: "painting-123",
        tokenId: 1,
        animationUrl: "https://arweave.net/animation-tx",
      }),
    ).toEqual({
      animation_url: "https://arweave.net/animation-tx",
      attributes: [
        { trait_type: "Token ID", value: 1 },
        { trait_type: "Painting ID", value: "painting-123" },
      ],
      description: "A generative artwork from DOOM INDEX - an AI-powered decentralized archive of financial emotions.",
      external_url: "https://doomindex.fun/artworks/1",
      image: "https://arweave.net/image-tx",
      name: "DOOM INDEX #1",
      properties: {
        category: "vr",
        files: [
          { type: "image/webp", uri: "https://arweave.net/image-tx" },
          { type: "model/gltf-binary", uri: "https://arweave.net/animation-tx" },
        ],
      },
      symbol: "DOOM",
    });
  });

  it("builds only the required token-id metadata path in the manifest", () => {
    expect(
      buildManifestJson({
        metadataId: "metadata-tx",
        tokenId: 1,
      }),
    ).toEqual({
      manifest: "arweave/paths",
      paths: {
        "1": {
          id: "metadata-tx",
        },
      },
      version: "0.2.0",
    });
  });

  it("builds the token metadata url from the manifest tx id and token id", () => {
    expect(
      buildTokenMetadataUrl({
        gatewayBaseUrl: "https://cache.example/",
        manifestId: "manifest-tx",
        tokenId: 1,
      }),
    ).toBe("https://cache.example/manifest-tx/1");
  });

  it("builds transaction urls from the preferred gateway", () => {
    expect(buildTransactionUrl({ gatewayBaseUrl: "https://cache.example/", txId: "tx-1" })).toBe(
      "https://cache.example/tx-1",
    );
    expect(
      buildPreferredAssetUrl({
        explicitGatewayBaseUrl: "https://preferred.example/",
        uploadResult: {
          id: "tx-1",
        },
      }),
    ).toBe("https://preferred.example/tx-1");
  });

  it("probes candidate gateways and picks the first manifest path that resolves", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      await Promise.resolve();
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input instanceof Request
              ? input.url
              : "";
      return new Response(null, {
        status: url === "https://permagate.io/manifest-tx/1" ? 200 : 404,
      });
    }) as typeof fetch;

    const resolvedGateway = await resolveTokenMetadataGateway({
      explicitGatewayBaseUrl: "https://cache-1.example/",
      fetchImpl,
      manifestUploadResult: {
        id: "manifest-tx",
      },
      tokenId: 1,
    });

    expect(resolvedGateway).toEqual({
      baseMetadataUrl: "https://permagate.io/manifest-tx",
      resolvedFromProbe: true,
      tokenMetadataUrl: "https://permagate.io/manifest-tx/1",
    });
  });

  it("parses optional bigint env values", () => {
    expect(parseOptionalBigInt("5000", "TEST_VAR")).toBe(BigInt(5000));
    expect(parseOptionalBigInt(undefined, "TEST_VAR")).toBeUndefined();
    expect(() => parseOptionalBigInt("abc", "TEST_VAR")).toThrow("TEST_VAR");
  });

  it("notifies and auto tops up when projected balance falls below the threshold", async () => {
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

    expect(result._unsafeUnwrap()).toEqual({
      currentBalanceWinc: BigInt(100),
      didNotify: true,
      didTopUp: true,
      estimatedCostWinc: BigInt(80),
      remainingBalanceWinc: BigInt(220),
      topUpTransactionId: "fund-1",
    });
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("fails when the projected balance stays negative without auto top-up", async () => {
    const notify = mock(async (_message: string) => Promise.resolve());

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

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("Turbo balance is insufficient for upload");
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
