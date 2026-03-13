import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createMockContext } from "../helpers";

type PaintingsRouterModule = typeof import("@/server/trpc/routers/paintings");

async function loadPaintingsRouterModule(): Promise<PaintingsRouterModule> {
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/server/trpc/routers/paintings.ts"));
  moduleUrl.searchParams.set("test", `${String(Date.now())}-${String(Math.random())}`);
  return (await import(moduleUrl.href)) as PaintingsRouterModule;
}

const preparePaintingMintMetadataMock = mock(async () => {
  await Promise.resolve();
  throw new Error("preparePaintingMintMetadata should not be called from the public router");
});

describe("Paintings Router", () => {
  beforeEach(() => {
    preparePaintingMintMetadataMock.mockClear();
    void mock.module("@/server/services/paintings/mint-preparation", () => ({
      preparePaintingMintMetadata: preparePaintingMintMetadataMock,
    }));
  });

  afterEach(() => {
    mock.restore();
  });

  it("blocks public prepareMintMetadata calls before any upload work starts", async () => {
    const { paintingsRouter } = await loadPaintingsRouterModule();
    const caller = paintingsRouter.createCaller(createMockContext());

    try {
      await caller.prepareMintMetadata({
        paintingId: "painting-1",
        tokenId: "7",
      });
      throw new Error("Expected prepareMintMetadata to be forbidden");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      if (error instanceof TRPCError) {
        expect(error.code).toBe("FORBIDDEN");
      }
    }

    expect(preparePaintingMintMetadataMock).not.toHaveBeenCalled();
  });
});
