import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  buildFramedPaintingGlbFromPublicFrame,
  copyBytesToArrayBuffer,
} from "@/server/services/paintings/framed-painting-bundle-service";

interface GlbJson {
  nodes?: Array<{
    name?: string;
    translation?: [number, number, number];
  }>;
}

function readGlbJson(glb: ArrayBuffer): GlbJson {
  const bytes = new Uint8Array(glb);
  const view = new DataView(glb);
  const jsonChunkLength = view.getUint32(12, true);
  const jsonChunkStart = 20;
  const jsonChunkEnd = jsonChunkStart + jsonChunkLength;
  const jsonText = new TextDecoder().decode(bytes.slice(jsonChunkStart, jsonChunkEnd)).trimEnd();
  return JSON.parse(jsonText) as GlbJson;
}

describe("unit/server/services/paintings/framed-painting-bundle-service", () => {
  it("loads /frame.glb and produces the finalized Worker-safe framed painting glb", async () => {
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
    const json = readGlbJson(result._unsafeUnwrap());
    expect(json.nodes?.find((node) => node.name === "painting-plane")?.translation).toEqual([0, 0, -0.035]);
  });
});
