const GLB_MAGIC = 1_179_937_895;
const JSON_CHUNK_TYPE = 1_313_821_514;
const MIN_GLB_JSON_HEADER_BYTES = 20;

function trimJsonChunkPadding(jsonText: string): string {
  let end = jsonText.length;
  while (end > 0) {
    const code = jsonText.charCodeAt(end - 1);
    if (code !== 0 && code !== 0x20) {
      break;
    }
    end -= 1;
  }

  return jsonText.slice(0, end);
}

export function readGlbJson(glb: ArrayBuffer): unknown {
  const bytes = new Uint8Array(glb);
  if (bytes.byteLength < MIN_GLB_JSON_HEADER_BYTES) {
    throw new Error("GLB was too short to contain a JSON chunk");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error("GLB magic header was invalid");
  }

  const totalLength = view.getUint32(8, true);
  if (totalLength > bytes.byteLength) {
    throw new Error("GLB total length exceeded available bytes");
  }

  const jsonChunkLength = view.getUint32(12, true);
  const jsonChunkType = view.getUint32(16, true);
  if (jsonChunkType !== JSON_CHUNK_TYPE) {
    throw new Error("GLB JSON chunk was missing");
  }

  const jsonChunkStart = 20;
  const jsonChunkEnd = jsonChunkStart + jsonChunkLength;
  if (jsonChunkEnd > totalLength || jsonChunkEnd > bytes.byteLength) {
    throw new Error("GLB JSON chunk exceeded available bytes");
  }

  const jsonBytes = bytes.slice(jsonChunkStart, jsonChunkEnd);
  const jsonText = trimJsonChunkPadding(new TextDecoder().decode(jsonBytes));
  return JSON.parse(jsonText) as unknown;
}
