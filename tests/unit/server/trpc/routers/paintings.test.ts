import { afterEach, describe, expect, it, mock } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createMockContext } from "../helpers";

type PaintingsRouterModule = typeof import("@/server/trpc/routers/paintings");

async function loadPaintingsRouterModule(): Promise<PaintingsRouterModule> {
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/server/trpc/routers/paintings.ts"));
  moduleUrl.searchParams.set("test", `${String(Date.now())}-${String(Math.random())}`);
  return (await import(moduleUrl.href)) as PaintingsRouterModule;
}

describe("Paintings Router", () => {
  afterEach(() => {
    mock.restore();
  });

  it("loads the archive list route without importing upload/storage dependencies", () => {
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "--eval",
        `
          import { mock } from "bun:test";

          mock.module("@/server/services/paintings/storage", () => {
            throw new Error("paintings router must not import storage for archive list reads");
          });

          const { paintingsRouter } = await import("@/server/trpc/routers/paintings");
          const { createMockContext } = await import("${join(process.cwd(), "tests/unit/server/trpc/helpers.ts")}");
          const caller = paintingsRouter.createCaller(createMockContext());

          console.log(JSON.stringify({ listType: typeof caller.list }));
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

    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as { listType: string };
    expect(output.listType).toBe("function");
  });

  it("delegates prepareMintMetadata through the paintings service boundary", async () => {
    const preparePaintingMintMetadataMock = mock(() => ({
      isErr: () => false,
      isOk: () => true,
      value: {
        baseMetadataUrl: "https://permagate.io/manifest",
        manifestTxId: "manifest-tx",
        metadataTxId: "metadata-tx",
        resolvedFromProbe: false,
        tokenMetadataUrl: "https://permagate.io/manifest/7",
      },
    }));

    void mock.module("@/server/services/paintings/mint-preparation", () => ({
      preparePaintingMintMetadata: preparePaintingMintMetadataMock,
    }));

    const { paintingsRouter } = await loadPaintingsRouterModule();
    const ctx = createMockContext();
    const caller = paintingsRouter.createCaller(ctx);

    const result = await caller.prepareMintMetadata({
      paintingId: "painting-1",
      tokenId: "7",
    });

    expect(preparePaintingMintMetadataMock).toHaveBeenCalledWith({
      d1Binding: ctx.env?.DB,
      paintingId: "painting-1",
      tokenId: "7",
    });
    expect(result).toEqual({
      baseMetadataUrl: "https://permagate.io/manifest",
      manifestTxId: "manifest-tx",
      metadataTxId: "metadata-tx",
      resolvedFromProbe: false,
      tokenMetadataUrl: "https://permagate.io/manifest/7",
    });
  });
});
