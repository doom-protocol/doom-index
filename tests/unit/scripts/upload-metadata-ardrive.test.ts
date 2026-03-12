import { describe, expect, it } from "bun:test";

import {
  buildGatewayBaseUrls,
  buildManifestJson,
  buildPreferredAssetUrl,
  buildTransactionUrl,
  buildTokenMetadataUrl,
  buildMetadataJson,
  normalizeGatewayBaseUrl,
  inferContentTypeFromPath,
  parseArgs,
  resolveTokenMetadataGateway,
} from "../../../scripts/upload-metadata-ardrive";

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
      gateway: "https://gateway.example/",
      glb: "/tmp/model.glb",
      paintingId: "painting-123",
      thumbnail: "https://example.com/thumb.webp",
      tokenId: 1,
    });
  });

  it("normalizes gateway base urls and keeps explicit gateways first", () => {
    expect(normalizeGatewayBaseUrl("https://gateway.example///")).toBe("https://gateway.example");
    expect(
      buildGatewayBaseUrls({
        explicitGatewayBaseUrl: "https://preferred.example/",
      }),
    ).toEqual(["https://preferred.example", "https://arweave.net"]);
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
        status: url === "https://arweave.net/manifest-tx/1" ? 200 : 404,
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
      baseMetadataUrl: "https://arweave.net/manifest-tx",
      resolvedFromProbe: true,
      tokenMetadataUrl: "https://arweave.net/manifest-tx/1",
    });
  });
});
