/**
 * R2 Image Serving Endpoint
 *
 * Serves images from R2 with optional transformation via IMAGES binding.
 * Features multi-layer caching (CDN, internal, browser) and conditional requests.
 *
 * URL: /api/r2/{...key}[?w=512&q=75&fit=scale-down&fmt=auto]
 */

import { get, set, type CachedBinaryResponse } from "@/lib/cache";
import {
  parseApiR2TransformParams,
  buildImageTransform,
  buildImageOutputOptions,
  buildTransformCacheKeySuffix,
  type CloudflareImageOptions,
} from "@/lib/cloudflare-image";
import { joinR2Key, resolveR2BucketAsync } from "@/lib/r2";
import { R2_IMAGE_CACHE_TTL_SECONDS } from "@/constants";
import { logger } from "@/utils/logger";
import {
  generateETag,
  shouldReturn304,
  create304Response,
  buildCacheControlHeader,
  buildBinaryResponseHeaders,
  arrayBufferToBase64,
  base64ToUint8Array,
} from "@/utils/http";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

// ============================================================================
// Route Config
// ============================================================================

export const revalidate = false;

const INTERNAL_CACHE_TTL_SECONDS = R2_IMAGE_CACHE_TTL_SECONDS * 7;
const TRANSFORM_TIMEOUT_MS = 5000;

// ============================================================================
// Main Handler - Clear Pipeline Flow
// ============================================================================

/**
 * GET /api/r2/{...key}
 *
 * Flow:
 * 1. Validate key → 2. Check cache → 3. Fetch R2 → 4. Transform (if needed) → 5. Cache & Return
 */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }): Promise<Response> {
  const startTime = Date.now();
  const { key } = await params;

  // 1. Validate key
  const objectKey = validateAndJoinKey(key);
  if (!objectKey) {
    return NextResponse.json({ error: "Invalid R2 object key" }, { status: 400 });
  }

  // 2. Build cache key & check cache
  const url = new URL(req.url);
  const transformOptions = parseApiR2TransformParams(url);
  const cacheKey = buildCacheKey(objectKey, transformOptions);

  const cached = await tryGetCached(req, cacheKey);
  if (cached) return cached;

  // 3. Fetch from R2
  const r2Object = await fetchFromR2(objectKey);
  if (!r2Object) {
    return NextResponse.json({ error: "Object not found" }, { status: 404 });
  }

  // 4. Process & Return (transform if needed, otherwise serve directly)
  return processAndServe(req, r2Object, objectKey, cacheKey, transformOptions, startTime);
}

// ============================================================================
// Step 1: Validation
// ============================================================================

function validateAndJoinKey(key: string[] | undefined): string | null {
  if (!key || key.length === 0) {
    logger.warn("[R2] Invalid key segments", { key });
    return null;
  }

  const objectKey = joinR2Key(key);
  if (!objectKey) {
    logger.warn("[R2] Empty key after normalization", { key });
    return null;
  }

  return objectKey;
}

// ============================================================================
// Step 2: Cache
// ============================================================================

function buildCacheKey(objectKey: string, transformOptions: CloudflareImageOptions | null): string {
  return `r2:route:${objectKey}${buildTransformCacheKeySuffix(transformOptions)}`;
}

async function tryGetCached(req: Request, cacheKey: string): Promise<Response | null> {
  const cached = await get<CachedBinaryResponse>(cacheKey);
  if (!cached) return null;

  // Decode body first to get accurate size for ETag calculation
  // Note: cached.body.length is base64 string length (~4/3x of actual size)
  const bodyUint8 = base64ToUint8Array(cached.body);
  const etag = cached.etag ?? generateETag(cacheKey, bodyUint8.length);

  if (shouldReturn304(req, etag)) {
    logger.debug("[R2] Cache hit → 304", { cacheKey });
    return create304Response(etag);
  }

  logger.debug("[R2] Cache hit", { cacheKey });
  return buildResponseFromCacheData(cached, bodyUint8, etag);
}

function buildResponseFromCacheData(cached: CachedBinaryResponse, bodyUint8: Uint8Array, etag: string): Response {
  const headers = new Headers(cached.headers);
  headers.set("ETag", etag);
  headers.set("Cache-Control", buildCacheControlHeader());

  const bodyBlob = new Blob([bodyUint8 as unknown as BlobPart]);

  return new Response(bodyBlob, {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  });
}

// ============================================================================
// Step 3: Fetch R2
// ============================================================================

async function fetchFromR2(objectKey: string): Promise<R2ObjectBody | null> {
  const bucketResult = await resolveR2BucketAsync();

  if (bucketResult.isErr()) {
    logger.error("[R2] Bucket resolve failed", { error: bucketResult.error.message });
    return null;
  }

  const object = await bucketResult.value.get(objectKey);
  if (!object) {
    logger.warn("[R2] Object not found", { objectKey });
    return null;
  }

  logger.debug("[R2] Object found", { objectKey, size: object.size });
  return object;
}

// ============================================================================
// Step 4: Process & Serve
// ============================================================================

async function processAndServe(
  req: Request,
  object: R2ObjectBody,
  objectKey: string,
  cacheKey: string,
  transformOptions: CloudflareImageOptions | null,
  startTime: number,
): Promise<Response> {
  // Read object into memory (required for both paths)
  const sourceBuffer = await object.arrayBuffer();
  const sourceContentType = object.httpMetadata?.contentType ?? "image/webp";

  // No transform needed → serve directly
  if (!transformOptions) {
    return cacheAndServe(sourceBuffer, sourceContentType, cacheKey, objectKey, startTime, object.etag);
  }

  // Try transform
  const transformed = await tryTransform(sourceBuffer, sourceContentType, transformOptions);

  if (transformed) {
    logger.info("[R2] Transform success", {
      objectKey,
      duration: Date.now() - startTime,
      size: transformed.body.byteLength,
    });
    return cacheAndServe(transformed.body, transformed.contentType, cacheKey, objectKey, startTime);
  }

  // Transform failed → serve original
  logger.warn("[R2] Transform failed, serving original", { objectKey });
  return serveWithConditional(req, sourceBuffer, sourceContentType, cacheKey);
}

// ============================================================================
// Transform Logic
// ============================================================================

async function tryTransform(
  sourceBuffer: ArrayBuffer,
  contentType: string,
  options: CloudflareImageOptions,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.IMAGES) return null;

    return await transformWithTimeout(env.IMAGES, sourceBuffer, contentType, options);
  } catch (error) {
    logger.warn("[R2] Transform error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function transformWithTimeout(
  images: ImagesBinding,
  sourceBuffer: ArrayBuffer,
  contentType: string,
  options: CloudflareImageOptions,
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const sourceStream = new Blob([sourceBuffer], { type: contentType }).stream();

  const transformPromise = (async () => {
    const result = await images
      .input(sourceStream)
      .transform(buildImageTransform(options))
      .output(buildImageOutputOptions(options));

    return {
      body: await result.response().arrayBuffer(),
      contentType: result.contentType(),
    };
  })();

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Transform timeout")), TRANSFORM_TIMEOUT_MS),
  );

  return Promise.race([transformPromise, timeoutPromise]);
}

// ============================================================================
// Response Building & Caching
// ============================================================================

function cacheAndServe(
  body: ArrayBuffer,
  contentType: string,
  cacheKey: string,
  objectKey: string,
  startTime: number,
  existingEtag?: string,
): Response {
  const etag = existingEtag ?? generateETag(cacheKey, body.byteLength);
  const headers = buildBinaryResponseHeaders(contentType, body.byteLength, etag);

  // Fire-and-forget cache write
  const cached: CachedBinaryResponse = {
    body: arrayBufferToBase64(body),
    headers: Object.fromEntries([...headers.entries()].map(([k, v]) => [k.toLowerCase(), v])),
    status: 200,
    statusText: "OK",
    etag,
  };

  set(cacheKey, cached, { ttlSeconds: INTERNAL_CACHE_TTL_SECONDS }).catch(err => {
    logger.warn("[R2] Cache write failed", { cacheKey, error: String(err) });
  });

  logger.info("[R2] Served", { objectKey, size: body.byteLength, duration: Date.now() - startTime });
  return new Response(body, { status: 200, headers });
}

function serveWithConditional(req: Request, buffer: ArrayBuffer, contentType: string, cacheKey: string): Response {
  const etag = generateETag(cacheKey + ":fallback", buffer.byteLength);

  if (shouldReturn304(req, etag)) {
    return create304Response(etag);
  }

  return new Response(buffer, {
    status: 200,
    headers: buildBinaryResponseHeaders(contentType, buffer.byteLength, etag),
  });
}
