import { beforeEach, describe, expect, it, mock } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { readGlbJson } from "../../../../helpers/read-glb-json";

interface GlbJson {
  nodes?: Array<{
    name?: string;
    translation?: [number, number, number];
  }>;
}

async function loadFramedPaintingBundleService() {
  return import("@/server/services/paintings/framed-painting-bundle-service");
}

describe("unit/server/services/paintings/framed-painting-bundle-service", () => {
  beforeEach(() => {
    mock.restore();
  });

  it("loads /frame.glb and produces the finalized Worker-safe framed painting glb", async () => {
    const { buildFramedPaintingGlbFromPublicFrame, copyBytesToArrayBuffer } = await loadFramedPaintingBundleService();
    const rootDir = process.cwd();
    const frameBytes = await readFile(join(rootDir, "public/frame.glb"));
    const imageBytes = await readFile(join(rootDir, "public/placeholder-painting.webp"));

    const assetsFetcher = {
      connect: () => {
        throw new Error("connect should not be called in this test");
      },
      fetch: async (request: RequestInfo | URL) => {
        await Promise.resolve();
        const url =
          typeof request === "string"
            ? request
            : request instanceof URL
              ? request.toString()
              : request instanceof Request
                ? request.url
                : "";

        if (!url.endsWith("/frame.glb")) {
          return new Response(null, { status: 404 });
        }

        return new Response(frameBytes, {
          headers: {
            "content-type": "model/gltf-binary",
          },
          status: 200,
        });
      },
    } satisfies Fetcher;

    const result = await buildFramedPaintingGlbFromPublicFrame({
      assetsFetcher,
      paintingImageBuffer: copyBytesToArrayBuffer(new Uint8Array(imageBytes)),
      paintingImageContentType: "image/webp",
    });

    expect(result.isOk()).toBe(true);
    const json = readGlbJson(result._unsafeUnwrap()) as GlbJson;
    expect(json.nodes?.find((node) => node.name === "painting-plane")?.translation).toEqual([0, 0, -0.035]);
  });
});
