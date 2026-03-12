import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { composeFramedPaintingGlb } from "@/server/services/paintings/framed-glb-composition-service";

interface GlbJson {
  accessors?: unknown[];
  bufferViews?: unknown[];
  extensionsUsed?: string[];
  images?: unknown[];
  materials?: Array<{
    name?: string;
    normalTexture?: { index: number };
    pbrMetallicRoughness?: {
      baseColorTexture?: { index: number };
      metallicRoughnessTexture?: { index: number };
      roughnessFactor?: number;
      metallicFactor?: number;
    };
  }>;
  meshes?: unknown[];
  nodes?: Array<{
    children?: number[];
    mesh?: number;
    name?: string;
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
    translation?: [number, number, number];
  }>;
  scenes?: Array<{
    nodes: number[];
  }>;
  textures?: unknown[];
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
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

describe("unit/server/services/paintings/framed-glb-composition-service", () => {
  it("composes a worker-safe framed glb that keeps the raw frame orientation and only adds a painting plane", async () => {
    const rootDir = process.cwd();
    const frameGlb = await readFile(join(rootDir, "public/frame.glb"));
    const paintingImage = await readFile(join(rootDir, "public/placeholder-painting.webp"));

    const result = composeFramedPaintingGlb({
      frameGlbBuffer: toArrayBuffer(frameGlb),
      paintingImageBuffer: toArrayBuffer(paintingImage),
      paintingImageContentType: "image/webp",
    });

    expect(result.isOk()).toBe(true);
    const glb = result._unsafeUnwrap();
    const json = readGlbJson(glb);

    expect(glb.byteLength).toBeGreaterThan(500_000);
    expect(json.extensionsUsed).toContain("EXT_meshopt_compression");
    expect(json.extensionsUsed).toContain("EXT_texture_webp");
    expect(json.extensionsUsed).toContain("KHR_mesh_quantization");
    expect(json.images?.length).toBe(4);
    expect(json.textures?.length).toBe(4);
    expect(json.materials?.some((material) => material.name === "Material_0")).toBe(true);
    expect(
      json.materials?.some(
        (material) =>
          material.name === "painting-material" &&
          material.pbrMetallicRoughness?.baseColorTexture !== undefined &&
          material.pbrMetallicRoughness.roughnessFactor === 0.3 &&
          material.pbrMetallicRoughness.metallicFactor === 0,
      ),
    ).toBe(true);
    expect(json.nodes?.find((node) => node.name === "painting-plane")?.translation).toEqual([0, 0, -0.035]);
    expect(json.nodes?.find((node) => node.name === "painting-plane")?.scale).toBeDefined();
    expect(json.nodes?.[0]?.name).toBe("Mesh_0");
    expect(json.scenes?.[0]?.nodes).toEqual([0, 1]);
  });
});
