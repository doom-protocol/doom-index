import type { AppError } from "@/types/app-error";
import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;
const ARRAY_BUFFER_ALIGNMENT = 4;
const ARRAY_BUFFER_TARGET = 34_962;
const ELEMENT_ARRAY_BUFFER_TARGET = 34_963;

const PAINTING_TRANSLATION: [number, number, number] = [0, 0, -0.035];
const PAINTING_SCALE_DEPTH = 1;
const INNER_WIDTH = 0.7;
const INNER_HEIGHT = 0.7;

interface GltfAccessor {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  max?: number[];
  min?: number[];
  normalized?: boolean;
  type: string;
}

interface GltfBuffer {
  byteLength: number;
  extensions?: {
    EXT_meshopt_compression?: {
      fallback?: boolean;
    };
  };
}

interface GltfBufferView {
  buffer: number;
  byteLength: number;
  byteOffset?: number;
  byteStride?: number;
  extensions?: {
    EXT_meshopt_compression?: {
      buffer: number;
      byteLength: number;
      byteOffset: number;
      byteStride: number;
      count: number;
      filter?: string;
      mode: string;
    };
  };
  target?: number;
}

interface GltfImage {
  bufferView: number;
  mimeType: string;
}

interface GltfJson {
  accessors?: GltfAccessor[];
  asset?: Record<string, unknown>;
  buffers?: GltfBuffer[];
  bufferViews?: GltfBufferView[];
  extensionsUsed?: string[];
  images?: GltfImage[];
  materials?: Array<Record<string, unknown>>;
  meshes?: Array<Record<string, unknown>>;
  nodes?: Array<Record<string, unknown>>;
  samplers?: Array<Record<string, unknown>>;
  scene?: number;
  scenes?: Array<{
    nodes: number[];
  }>;
  textures?: Array<Record<string, unknown>>;
}

interface GlbState {
  binChunk: Uint8Array;
  json: GltfJson;
}

class BinaryAppender {
  private readonly chunks: Uint8Array[] = [];
  private lengthValue: number;

  constructor(initialBytes: Uint8Array) {
    this.chunks.push(initialBytes);
    this.lengthValue = initialBytes.byteLength;
  }

  append(bytes: Uint8Array, alignment: number = ARRAY_BUFFER_ALIGNMENT): number {
    const alignedOffset = alignTo(this.lengthValue, alignment);
    const paddingLength = alignedOffset - this.lengthValue;
    if (paddingLength > 0) {
      this.chunks.push(new Uint8Array(paddingLength));
      this.lengthValue = alignedOffset;
    }

    this.chunks.push(bytes);
    this.lengthValue += bytes.byteLength;
    return alignedOffset;
  }

  get byteLength(): number {
    return this.lengthValue;
  }

  toUint8Array(): Uint8Array {
    const output = new Uint8Array(this.lengthValue);
    let offset = 0;

    for (const chunk of this.chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return output;
  }
}

function toAppError(message: string, cause?: unknown): AppError {
  return {
    type: "InternalError",
    message: cause ? `${message}: ${formatUnknownCause(cause)}` : message,
    cause,
  };
}

function formatUnknownCause(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }

  if (typeof cause === "string") {
    return cause;
  }

  try {
    return JSON.stringify(cause);
  } catch {
    return Object.prototype.toString.call(cause);
  }
}

function alignTo(value: number, alignment: number): number {
  const remainder = value % alignment;
  return remainder === 0 ? value : value + alignment - remainder;
}

function toUint8Array(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer);
}

function parseGlb(glbBuffer: ArrayBuffer): Result<GlbState, AppError> {
  try {
    const bytes = toUint8Array(glbBuffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    if (view.getUint32(0, true) !== GLB_MAGIC) {
      return err(toAppError("Invalid GLB magic header"));
    }
    if (view.getUint32(4, true) !== GLB_VERSION) {
      return err(toAppError("Unsupported GLB version"));
    }

    const totalLength = view.getUint32(8, true);
    if (totalLength > bytes.byteLength) {
      return err(toAppError("GLB total length exceeds available bytes"));
    }

    const jsonChunkLength = view.getUint32(12, true);
    const jsonChunkType = view.getUint32(16, true);
    if (jsonChunkType !== JSON_CHUNK_TYPE) {
      return err(toAppError("GLB JSON chunk was missing"));
    }

    const jsonChunkStart = 20;
    const jsonChunkEnd = jsonChunkStart + jsonChunkLength;
    const jsonText = new TextDecoder().decode(bytes.slice(jsonChunkStart, jsonChunkEnd)).trimEnd();
    const json = JSON.parse(jsonText) as GltfJson;

    const binHeaderStart = alignTo(jsonChunkEnd, ARRAY_BUFFER_ALIGNMENT);
    const binChunkLength = view.getUint32(binHeaderStart, true);
    const binChunkType = view.getUint32(binHeaderStart + 4, true);
    if (binChunkType !== BIN_CHUNK_TYPE) {
      return err(toAppError("GLB BIN chunk was missing"));
    }

    const binChunkStart = binHeaderStart + 8;
    const binChunkEnd = binChunkStart + binChunkLength;

    return ok({
      binChunk: bytes.slice(binChunkStart, binChunkEnd),
      json,
    });
  } catch (error) {
    return err(toAppError("Failed to parse GLB", error));
  }
}

function prepareGlbForAppend(
  json: GltfJson,
  binChunk: Uint8Array,
): Result<{ appender: BinaryAppender; json: GltfJson }, AppError> {
  const preparedJson: GltfJson = structuredClone(json);
  if (!preparedJson.buffers?.[0]) {
    return err(toAppError("Frame GLB did not contain an embedded primary buffer"));
  }

  return ok({
    appender: new BinaryAppender(binChunk),
    json: preparedJson,
  });
}

function parseImageDimensions(
  bytes: Uint8Array,
  contentType: string,
): Result<{ height: number; width: number }, AppError> {
  switch (detectImageContentType(bytes, contentType)) {
    case "image/png":
      return parsePngDimensions(bytes);
    case "image/jpeg":
    case "image/jpg":
      return parseJpegDimensions(bytes);
    case "image/webp":
      return parseWebpDimensions(bytes);
    default:
      return err(toAppError(`Unsupported painting image content type for GLB composition: ${contentType}`));
  }
}

function detectImageContentType(bytes: Uint8Array, fallbackContentType: string): string {
  if (
    bytes.byteLength >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.byteLength >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  if (bytes.byteLength >= 2) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint16(0, false) === 0xffd8) {
      return "image/jpeg";
    }
  }

  return fallbackContentType;
}

function parsePngDimensions(bytes: Uint8Array): Result<{ height: number; width: number }, AppError> {
  if (bytes.byteLength < 24) {
    return err(toAppError("PNG bytes were too short"));
  }

  if (
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a
  ) {
    return err(toAppError("PNG signature was invalid"));
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return ok({
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  });
}

function parseJpegDimensions(bytes: Uint8Array): Result<{ height: number; width: number }, AppError> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(0, false) !== 0xffd8) {
    return err(toAppError("JPEG signature was invalid"));
  }

  let offset = 2;
  while (offset + 9 < bytes.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = view.getUint8(offset + 1);
    offset += 2;

    if (marker === 0xd8 || marker === 0xd9) {
      continue;
    }

    const segmentLength = view.getUint16(offset, false);
    if (segmentLength < 2 || offset + segmentLength > bytes.byteLength) {
      return err(toAppError("JPEG segment length was invalid"));
    }

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      return ok({
        height: view.getUint16(offset + 3, false),
        width: view.getUint16(offset + 5, false),
      });
    }

    offset += segmentLength;
  }

  return err(toAppError("JPEG dimensions could not be determined"));
}

function parseWebpDimensions(bytes: Uint8Array): Result<{ height: number; width: number }, AppError> {
  if (bytes.byteLength < 30) {
    return err(toAppError("WebP bytes were too short"));
  }

  if (
    bytes[0] !== 0x52 ||
    bytes[1] !== 0x49 ||
    bytes[2] !== 0x46 ||
    bytes[3] !== 0x46 ||
    bytes[8] !== 0x57 ||
    bytes[9] !== 0x45 ||
    bytes[10] !== 0x42 ||
    bytes[11] !== 0x50
  ) {
    return err(toAppError("WebP signature was invalid"));
  }

  const chunkHeaderBytes = bytes.slice(12, 16);
  const chunkHeader = String.fromCharCode(...chunkHeaderBytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (chunkHeader === "VP8X") {
    return ok({
      width: 1 + view.getUint8(24) + (view.getUint8(25) << 8) + (view.getUint8(26) << 16),
      height: 1 + view.getUint8(27) + (view.getUint8(28) << 8) + (view.getUint8(29) << 16),
    });
  }

  if (chunkHeader === "VP8 ") {
    return ok({
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    });
  }

  if (chunkHeader === "VP8L") {
    const bits = view.getUint32(21, true);
    return ok({
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    });
  }

  return err(toAppError("Unsupported WebP chunk type"));
}

function calculatePlaneScale(width: number, height: number): [number, number] {
  const imageAspect = width / height;
  const frameAspect = INNER_WIDTH / INNER_HEIGHT;

  if (imageAspect > frameAspect) {
    return [INNER_WIDTH, INNER_WIDTH / imageAspect];
  }

  return [INNER_HEIGHT * imageAspect, INNER_HEIGHT];
}

function buildPlaneGeometry(): {
  indices: Uint16Array;
  normals: Float32Array;
  positions: Float32Array;
  uvs: Float32Array;
} {
  return {
    positions: new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uvs: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
    indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  };
}

function asUint8Array(view: Float32Array | Uint16Array): Uint8Array {
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice();
}

function appendAccessor(params: {
  appender: BinaryAppender;
  componentType: number;
  count: number;
  data: Float32Array | Uint16Array;
  json: GltfJson;
  max?: number[];
  min?: number[];
  normalized?: boolean;
  target?: number;
  type: string;
}): number {
  const byteOffset = params.appender.append(asUint8Array(params.data), ARRAY_BUFFER_ALIGNMENT);
  const bufferViews = (params.json.bufferViews ??= []);
  const accessors = (params.json.accessors ??= []);

  const bufferViewIndex =
    bufferViews.push({
      buffer: 0,
      byteLength: params.data.byteLength,
      byteOffset,
      byteStride:
        params.target === ARRAY_BUFFER_TARGET && params.type !== "SCALAR"
          ? params.data.byteLength / params.count
          : undefined,
      target: params.target,
    }) - 1;

  return (
    accessors.push({
      bufferView: bufferViewIndex,
      componentType: params.componentType,
      count: params.count,
      max: params.max,
      min: params.min,
      normalized: params.normalized,
      type: params.type,
    }) - 1
  );
}

function appendImageBufferView(params: { appender: BinaryAppender; bytes: Uint8Array; json: GltfJson }): number {
  const byteOffset = params.appender.append(params.bytes, ARRAY_BUFFER_ALIGNMENT);
  const bufferViews = (params.json.bufferViews ??= []);

  return (
    bufferViews.push({
      buffer: 0,
      byteLength: params.bytes.byteLength,
      byteOffset,
    }) - 1
  );
}

function createTextureReference(
  contentType: string,
  imageIndex: number,
  samplerIndex: number,
): Record<string, unknown> {
  if (contentType === "image/webp") {
    return {
      sampler: samplerIndex,
      extensions: {
        EXT_texture_webp: {
          source: imageIndex,
        },
      },
    };
  }

  return {
    sampler: samplerIndex,
    source: imageIndex,
  };
}

function ensureExtensionsUsed(json: GltfJson, extension: string): void {
  const extensionsUsed = (json.extensionsUsed ??= []);
  if (!extensionsUsed.includes(extension)) {
    extensionsUsed.push(extension);
  }
}

function appendSceneGraph(params: {
  frameNodeIndex: number;
  json: GltfJson;
  paintingMeshIndex: number;
  scale: [number, number, number];
}): void {
  const nodes = (params.json.nodes ??= []);

  const paintingPlaneNodeIndex =
    nodes.push({
      translation: PAINTING_TRANSLATION,
      scale: params.scale,
      name: "painting-plane",
      mesh: params.paintingMeshIndex,
    }) - 1;

  params.json.scene = 0;
  params.json.scenes = [
    {
      nodes: [params.frameNodeIndex, paintingPlaneNodeIndex],
    },
  ];
}

function buildFinalGlb(json: GltfJson, binaryBytes: Uint8Array): ArrayBuffer {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const paddedJsonLength = alignTo(jsonBytes.byteLength, ARRAY_BUFFER_ALIGNMENT);
  const paddedBinLength = alignTo(binaryBytes.byteLength, ARRAY_BUFFER_ALIGNMENT);
  const totalLength = 12 + 8 + paddedJsonLength + 8 + paddedBinLength;
  const output = new Uint8Array(totalLength);
  const view = new DataView(output.buffer);

  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, totalLength, true);

  let offset = 12;
  view.setUint32(offset, paddedJsonLength, true);
  offset += 4;
  view.setUint32(offset, JSON_CHUNK_TYPE, true);
  offset += 4;
  output.set(jsonBytes, offset);
  output.fill(0x20, offset + jsonBytes.byteLength, offset + paddedJsonLength);
  offset += paddedJsonLength;

  view.setUint32(offset, paddedBinLength, true);
  offset += 4;
  view.setUint32(offset, BIN_CHUNK_TYPE, true);
  offset += 4;
  output.set(binaryBytes, offset);

  return output.buffer;
}

export function composeFramedPaintingGlb(params: {
  frameGlbBuffer: ArrayBuffer;
  paintingImageBuffer: ArrayBuffer;
  paintingImageContentType: string;
}): Result<ArrayBuffer, AppError> {
  const parsedGlb = parseGlb(params.frameGlbBuffer);
  if (parsedGlb.isErr()) {
    return err(parsedGlb.error);
  }

  const mergedState = prepareGlbForAppend(parsedGlb.value.json, parsedGlb.value.binChunk);
  if (mergedState.isErr()) {
    return err(mergedState.error);
  }

  const imageDimensions = parseImageDimensions(
    toUint8Array(params.paintingImageBuffer),
    params.paintingImageContentType,
  );
  if (imageDimensions.isErr()) {
    return err(imageDimensions.error);
  }

  const paintingImageContentType = detectImageContentType(
    toUint8Array(params.paintingImageBuffer),
    params.paintingImageContentType,
  );

  const json = mergedState.value.json;
  const appender = mergedState.value.appender;
  const frameNodeIndex = 0;

  if (paintingImageContentType === "image/webp") {
    ensureExtensionsUsed(json, "EXT_texture_webp");
  }

  const planeGeometry = buildPlaneGeometry();
  const planePositionAccessor = appendAccessor({
    appender,
    componentType: 5126,
    count: planeGeometry.positions.length / 3,
    data: planeGeometry.positions,
    json,
    max: [0.5, 0.5, 0],
    min: [-0.5, -0.5, 0],
    target: ARRAY_BUFFER_TARGET,
    type: "VEC3",
  });
  const planeNormalAccessor = appendAccessor({
    appender,
    componentType: 5126,
    count: planeGeometry.normals.length / 3,
    data: planeGeometry.normals,
    json,
    max: [0, 0, 1],
    min: [0, 0, 1],
    target: ARRAY_BUFFER_TARGET,
    type: "VEC3",
  });
  const planeUvAccessor = appendAccessor({
    appender,
    componentType: 5126,
    count: planeGeometry.uvs.length / 2,
    data: planeGeometry.uvs,
    json,
    max: [1, 1],
    min: [0, 0],
    target: ARRAY_BUFFER_TARGET,
    type: "VEC2",
  });
  const planeIndexAccessor = appendAccessor({
    appender,
    componentType: 5123,
    count: planeGeometry.indices.length,
    data: planeGeometry.indices,
    json,
    max: [3],
    min: [0],
    target: ELEMENT_ARRAY_BUFFER_TARGET,
    type: "SCALAR",
  });

  const paintingImageBufferView = appendImageBufferView({
    appender,
    bytes: toUint8Array(params.paintingImageBuffer),
    json,
  });

  const images = (json.images ??= []);
  const textures = (json.textures ??= []);
  const materials = (json.materials ??= []);
  const meshes = (json.meshes ??= []);
  const samplers = (json.samplers ??= [
    {
      magFilter: 9729,
      minFilter: 9987,
      wrapS: 10497,
      wrapT: 10497,
    },
  ]);

  const paintingImageIndex =
    images.push({
      bufferView: paintingImageBufferView,
      mimeType: paintingImageContentType,
    }) - 1;

  const paintingTextureIndex =
    textures.push(createTextureReference(paintingImageContentType, paintingImageIndex, 0)) - 1;

  const paintingMaterialIndex =
    materials.push({
      name: "painting-material",
      pbrMetallicRoughness: {
        metallicFactor: 0,
        roughnessFactor: 0.3,
        baseColorTexture: {
          index: paintingTextureIndex,
          texCoord: 0,
        },
      },
      doubleSided: true,
    }) - 1;

  const [planeWidth, planeHeight] = calculatePlaneScale(imageDimensions.value.width, imageDimensions.value.height);
  const paintingMeshIndex =
    meshes.push({
      name: "painting-plane-mesh",
      primitives: [
        {
          mode: 4,
          attributes: {
            POSITION: planePositionAccessor,
            NORMAL: planeNormalAccessor,
            TEXCOORD_0: planeUvAccessor,
          },
          indices: planeIndexAccessor,
          material: paintingMaterialIndex,
        },
      ],
    }) - 1;

  appendSceneGraph({
    frameNodeIndex,
    json,
    paintingMeshIndex,
    scale: [planeWidth, planeHeight, PAINTING_SCALE_DEPTH],
  });

  const primaryBuffer = json.buffers?.[0];
  if (!primaryBuffer) {
    return err(toAppError("Frame GLB primary buffer metadata disappeared during composition"));
  }

  primaryBuffer.byteLength = appender.byteLength;
  return ok(buildFinalGlb(json, appender.toUint8Array()));
}
