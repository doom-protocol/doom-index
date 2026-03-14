import { describe, expect, it } from "bun:test";

describe("unit/server/services/paintings/mint-preparation", () => {
  it("detects the painting image content type from response headers and preserves string token ids", () => {
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "--eval",
        `
          import { mock } from "bun:test";
          import { ok } from "neverthrow";

          const findByIdMock = mock(async () =>
            ok({
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
              id: contentType === "application/x.arweave-manifest+json" ? "manifest-tx" : "upload-tx",
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
                  "content-type": "image/png; charset=utf-8",
                },
                status: 200,
              });
            }

            if (url.endsWith("/manifest-tx/9007199254740993")) {
              return new Response("{}", {
                headers: {
                  "content-type": "application/json",
                },
                status: 200,
              });
            }

            throw new Error("Unexpected fetch call");
          });

          const mintResult = await preparePaintingMintMetadata({
            fetchImpl,
            paintingId: "painting-1",
            tokenId: "9007199254740993",
          });

          console.log(
            JSON.stringify({
              result: mintResult.isOk() ? mintResult.value : mintResult.error,
              resultIsOk: mintResult.isOk(),
              updateMintAssetRefsCalls: updateMintAssetRefsMock.mock.calls.length,
              uploadedMetadata: uploadJsonMock.mock.calls[0]?.[0] ?? null,
              uploadJsonCalls: uploadJsonMock.mock.calls.length,
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
      result: {
        baseMetadataUrl: string;
        manifestTxId: string;
        metadataTxId: string;
        resolvedFromProbe: boolean;
        tokenMetadataUrl: string;
      };
      resultIsOk: boolean;
      updateMintAssetRefsCalls: number;
      uploadedMetadata: {
        animation_url: string;
        image: string;
        name: string;
        properties: {
          files: Array<{
            type: string;
            uri: string;
          }>;
        };
      } | null;
      uploadJsonCalls: number;
    };

    expect(output.resultIsOk).toBe(true);
    expect(output.updateMintAssetRefsCalls).toBe(0);
    expect(output.uploadJsonCalls).toBe(1);
    expect(output.uploadedMetadata?.animation_url).toBe("https://example.test/glb-tx");
    expect(output.uploadedMetadata?.image).toBe("https://example.test/painting");
    expect(output.uploadedMetadata?.name).toBe("DOOM NFT #9007199254740993");
    expect(output.uploadedMetadata?.properties.files).toContainEqual({
      type: "image/png",
      uri: "https://example.test/painting",
    });
    expect(output.result).toEqual({
      baseMetadataUrl: "https://example.test/manifest-tx",
      manifestTxId: "manifest-tx",
      metadataTxId: "metadata-tx",
      resolvedFromProbe: true,
      tokenMetadataUrl: "https://example.test/manifest-tx/9007199254740993",
    });
  });
});
