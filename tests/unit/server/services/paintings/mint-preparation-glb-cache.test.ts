import { describe, expect, it } from "bun:test";
import { join } from "node:path";

describe("unit/server/services/paintings/mint-preparation glb cache", () => {
  it("uploads and caches a GLB when the painting does not have one yet", () => {
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "--eval",
        `
          import { readFile } from "node:fs/promises";
          import { mock } from "bun:test";
          import { ok } from "neverthrow";

          const findByIdMock = mock(async () =>
            ok({
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
            }),
          );
          const updateMintAssetRefsMock = mock(async () => ok(undefined));
          const getBalanceMock = mock(async () =>
            ok({
              controlledWinc: "100",
              effectiveBalance: "100",
              givenApprovals: [],
              receivedApprovals: [],
              winc: "100",
            }),
          );
          const getUploadCostsMock = mock(async () => ok([{ adjustments: [], fees: [], winc: "1" }]));
          const topUpWithTokensMock = mock(async () =>
            ok({
              id: "topup-tx",
              owner: "owner",
              quantity: "1",
              status: "confirmed",
              target: "target",
              token: "arweave",
              winc: "1",
            }),
          );
          const uploadFileMock = mock(async (_bytes, contentType) =>
            ok({
              dataCaches: [],
              fastFinalityIndexes: [],
              id: contentType === "model/gltf-binary" ? "glb-tx" : "manifest-tx",
              url: "https://permagate.io/upload-tx",
            }),
          );
          const uploadJsonMock = mock(async (json) =>
            ok({
              dataCaches: [],
              fastFinalityIndexes: [],
              id: "metadata-tx",
              json,
              url: "https://permagate.io/metadata-tx",
            }),
          );

          mock.module("@/env", () => ({
            env: {
              ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON: undefined,
              ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC: undefined,
              ARDRIVE_TURBO_SECRET_KEY: '{"kty":"RSA"}',
              ARWEAVE_GATEWAY_BASE_URL: "https://example.test",
            },
            getEnvironmentName: () => "test",
            isDevelopment: () => false,
            publicEnv: {
              NEXT_PUBLIC_BASE_URL: "https://example.test",
            },
          }));

          mock.module("@/lib/ardrive-client", () => ({
            createArdriveClient: () => ({
              getBalance: getBalanceMock,
              getUploadCosts: getUploadCostsMock,
              topUpWithTokens: topUpWithTokensMock,
              uploadFile: uploadFileMock,
              uploadJson: uploadJsonMock,
            }),
          }));

          mock.module("@/server/repositories/paintings-repository", () => ({
            createPaintingsRepository: () => ({
              findById: findByIdMock,
              updateMintAssetRefs: updateMintAssetRefsMock,
            }),
          }));

          const { preparePaintingMintMetadata } = await import("@/server/services/paintings/mint-preparation");
          const imageBytes = await readFile(${JSON.stringify(join(process.cwd(), "public/placeholder-painting.webp"))});

          const fetchImpl = mock(async (input, init) => {
            const url =
              typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input instanceof Request
                    ? input.url
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
          });

          const mintResult = await preparePaintingMintMetadata({
            fetchImpl,
            paintingId: "painting-1",
            tokenId: "42",
          });

          const glbUploadCall = uploadFileMock.mock.calls.find((call) => call[1] === "model/gltf-binary") ?? null;

          console.log(
            JSON.stringify({
              glbUploadByteLength:
                glbUploadCall && typeof glbUploadCall[0] === "object" && glbUploadCall[0] !== null
                  ? glbUploadCall[0].byteLength
                  : null,
              result: mintResult.isOk() ? mintResult.value : mintResult.error,
              resultIsOk: mintResult.isOk(),
              updateMintAssetRefsArgs: updateMintAssetRefsMock.mock.calls[0] ?? null,
              uploadFileCalls: uploadFileMock.mock.calls.length,
              uploadedMetadata: uploadJsonMock.mock.calls[0]?.[0] ?? null,
            }),
          );
        `,
      ],
      cwd: process.cwd(),
      env: {
        ...process.env,
      },
      stderr: "pipe",
      stdout: "pipe",
    });

    expect(result.exitCode).toBe(0);

    const stdout = new TextDecoder().decode(result.stdout);
    const outputLine = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .at(-1);
    expect(outputLine).toBeDefined();

    const output = JSON.parse(outputLine ?? "") as {
      glbUploadByteLength: number | null;
      result: {
        baseMetadataUrl: string;
        manifestTxId: string;
        metadataTxId: string;
        resolvedFromProbe: boolean;
        tokenMetadataUrl: string;
      };
      resultIsOk: boolean;
      updateMintAssetRefsArgs: [string, { glbTxId: string; glbUrl: string }] | null;
      uploadFileCalls: number;
      uploadedMetadata: {
        animation_url: string;
        image: string;
        name: string;
      } | null;
    };

    expect(output.resultIsOk).toBe(true);
    expect(output.uploadFileCalls).toBe(2);
    expect(output.glbUploadByteLength).toBeGreaterThan(16);
    expect(output.updateMintAssetRefsArgs).toEqual([
      "painting-1",
      {
        glbTxId: "glb-tx",
        glbUrl: "https://example.test/glb-tx",
      },
    ]);
    expect(output.uploadedMetadata).toMatchObject({
      animation_url: "https://example.test/glb-tx",
      image: "https://example.test/painting.webp",
      name: "DOOM NFT #42",
    });
    expect(output.result).toEqual({
      baseMetadataUrl: "https://example.test/manifest-tx",
      manifestTxId: "manifest-tx",
      metadataTxId: "metadata-tx",
      resolvedFromProbe: true,
      tokenMetadataUrl: "https://example.test/manifest-tx/42",
    });
  });
});
