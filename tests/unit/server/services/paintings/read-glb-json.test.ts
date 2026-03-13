import { describe, expect, it } from "bun:test";

import { readGlbJson } from "../../../../helpers/read-glb-json";

function buildGlbWithJsonChunk(jsonText: string, paddingByte: number): ArrayBuffer {
  const encoder = new TextEncoder();
  const jsonBytes = encoder.encode(jsonText);
  const paddedJsonLength = Math.ceil(jsonBytes.byteLength / 4) * 4;
  const totalLength = 12 + 8 + paddedJsonLength;
  const output = new Uint8Array(totalLength);
  const view = new DataView(output.buffer);

  view.setUint32(0, 1_179_937_895, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, paddedJsonLength, true);
  view.setUint32(16, 1_313_821_514, true);
  output.set(jsonBytes, 20);
  output.fill(paddingByte, 20 + jsonBytes.byteLength, 20 + paddedJsonLength);

  return output.buffer;
}

describe("unit/server/services/paintings/read-glb-json", () => {
  it("parses a GLB JSON chunk even when the chunk padding uses NUL bytes", () => {
    const glb = buildGlbWithJsonChunk('{"nodes":[{"name":"painting-plane"}]}', 0x00);

    expect(readGlbJson(glb)).toEqual({
      nodes: [{ name: "painting-plane" }],
    });
  });

  it("rejects truncated GLB JSON chunks with a clear boundary error", () => {
    const fullGlb = buildGlbWithJsonChunk('{"nodes":[{"name":"painting-plane"}]}', 0x20);
    const truncatedGlb = fullGlb.slice(0, fullGlb.byteLength - 2);
    new DataView(truncatedGlb).setUint32(8, truncatedGlb.byteLength, true);

    expect(() => readGlbJson(truncatedGlb)).toThrow("GLB JSON chunk exceeded available bytes");
  });
});
