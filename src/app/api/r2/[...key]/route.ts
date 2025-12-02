import { env } from "@/env";
import { get, set } from "@/lib/cache";
import { parseApiR2TransformParams, type CloudflareImageOptions } from "@/lib/cloudflare-image";
import { joinR2Key, resolveR2BucketAsync } from "@/lib/r2";
import { R2_IMAGE_CACHE_TTL_SECONDS } from "@/constants";
import { logger } from "@/utils/logger";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

type CachedResponse = {
  body: string; // Base64 encoded for binary data
  headers: Record<string, string>;
  status: number;
  statusText: string;
};

/**
 * Fetch image with Cloudflare Image Resizing applied
 * Uses Workers Image Resizing API via cf.image options on fetch
 *
 * @param originUrl - Full URL to the image origin (R2_IMAGE_ORIGIN + objectKey)
 * @param options - Image transformation options
 * @returns Response with transformed image or null if transformation failed
 */
async function fetchWithImageTransform(originUrl: string, options: CloudflareImageOptions): Promise<Response | null> {
  try {
    // Build cf.image options for Workers Image Resizing
    const cfImageOptions: RequestInitCfPropertiesImage = {};

    if (options.width) cfImageOptions.width = options.width;
    if (options.height) cfImageOptions.height = options.height;
    if (options.quality) cfImageOptions.quality = options.quality;
    if (options.fit) cfImageOptions.fit = options.fit;
    // Map "auto" format to undefined (let Cloudflare decide), otherwise use the specified format
    if (options.format && options.format !== "auto") {
      cfImageOptions.format = options.format;
    }
    if (options.dpr) cfImageOptions.dpr = options.dpr;

    logger.debug("[R2 Route] Fetching with image transform", {
      originUrl,
      cfImageOptions,
    });

    const response = await fetch(originUrl, {
      cf: {
        image: cfImageOptions,
      },
    });

    if (!response.ok) {
      logger.warn("[R2 Route] Image transform fetch failed", {
        originUrl,
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    return response;
  } catch (error) {
    logger.error("[R2 Route] Image transform error", {
      originUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Direct R2 object access endpoint for binary data (images, etc.)
 * This endpoint is used by browsers directly via <img src> tags,
 * so it cannot use tRPC streaming which requires tRPC client.
 *
 * URL format: /api/r2/key1/key2/file.webp
 * With transforms: /api/r2/key1/key2/file.webp?w=512&q=75&fit=scale-down&fmt=auto
 *
 * NOTE: This endpoint is available for both development and production environments.
 * - Images are served via R2 binding, regardless of NEXT_PUBLIC_R2_URL configuration.
 * - When R2_IMAGE_ORIGIN is configured and transform params are present,
 *   images are transformed using Cloudflare Workers Image Resizing.
 * - Without transform params, images are served directly from R2 (cached in KV).
 */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }): Promise<Response> {
  const startTime = Date.now();
  const requestUrl = req.url;

  logger.debug("[R2 Route] Request received", {
    url: requestUrl,
    method: req.method,
  });

  // If R2 public URL is configured, this endpoint should not be used
  // All images should be served directly from the public bucket
  // EXCEPT when the public URL points to this endpoint itself (local development)
  const r2Url = env.NEXT_PUBLIC_R2_URL || process.env.NEXT_PUBLIC_R2_URL;
  const _isLocalR2Route = r2Url?.includes("/api/r2");
  const _isDevelopment = env.NODE_ENV === "development" || process.env.NODE_ENV === "development";

  // This endpoint is available for both development and production
  // Images are served via R2 binding, regardless of NEXT_PUBLIC_R2_URL configuration

  const { key } = await params;

  if (!key || key.length === 0) {
    logger.warn("[R2 Route] Invalid key segments", { key });
    return NextResponse.json({ error: "Invalid R2 object key" }, { status: 400 });
  }

  // Join key segments and normalize
  const objectKey = joinR2Key(key);

  logger.debug("[R2 Route] Parsed object key", {
    keySegments: key,
    objectKey,
  });

  if (!objectKey) {
    logger.warn("[R2 Route] Empty object key after normalization", { key });
    return NextResponse.json({ error: "Invalid R2 object key" }, { status: 400 });
  }

  // Parse image transformation options from query params
  const url = new URL(req.url);
  const transformOptions = parseApiR2TransformParams(url);

  // Get R2_IMAGE_ORIGIN from Cloudflare env (server-side only)
  let r2ImageOrigin: string | undefined;
  try {
    const { env: cfEnv } = await getCloudflareContext({ async: true });
    r2ImageOrigin = (cfEnv as unknown as Record<string, unknown>).R2_IMAGE_ORIGIN as string | undefined;
  } catch {
    // Fallback to process.env for local development
    r2ImageOrigin = process.env.R2_IMAGE_ORIGIN;
  }

  // If transform options are present and R2_IMAGE_ORIGIN is configured,
  // use Workers Image Resizing instead of direct R2 access
  if (transformOptions && r2ImageOrigin) {
    logger.debug("[R2 Route] Using image transformation", {
      objectKey,
      transformOptions,
      r2ImageOrigin,
    });

    // Build origin URL for the image
    const originUrl = new URL(objectKey, r2ImageOrigin).toString();

    // Fetch with image transformation
    const transformedResponse = await fetchWithImageTransform(originUrl, transformOptions);

    if (transformedResponse) {
      const duration = Date.now() - startTime;
      logger.info("[R2 Route] Transform success", {
        objectKey,
        transformOptions,
        duration,
      });

      // Clone headers and add cache control
      const responseHeaders = new Headers(transformedResponse.headers);
      responseHeaders.set("Cache-Control", `public, max-age=${R2_IMAGE_CACHE_TTL_SECONDS}, immutable`);

      return new Response(transformedResponse.body, {
        status: transformedResponse.status,
        headers: responseHeaders,
      });
    }

    // Fall through to direct R2 access if transformation failed
    logger.warn("[R2 Route] Transform failed, falling back to direct R2", {
      objectKey,
      transformOptions,
    });
  } else if (transformOptions && !r2ImageOrigin) {
    // Log warning if transform params present but no origin configured
    logger.warn("[R2 Route] Transform params present but R2_IMAGE_ORIGIN not configured", {
      objectKey,
      transformOptions,
    });
  }

  const cacheKey = `r2:route:${objectKey}`;
  logger.debug("[R2 Route] Checking cache", { cacheKey });

  const cached = await get<CachedResponse>(cacheKey);

  if (cached !== null) {
    logger.debug("[R2 Route] Cache hit", {
      cacheKey,
      status: cached.status,
    });
    // Reconstruct Response from cached data
    const headers = new Headers(cached.headers);
    const body = Uint8Array.from(atob(cached.body), c => c.charCodeAt(0));
    return new Response(body, {
      status: cached.status,
      statusText: cached.statusText,
      headers,
    });
  }

  logger.debug("[R2 Route] Cache miss, resolving bucket", { objectKey });
  const bucketResult = await resolveR2BucketAsync();

  if (bucketResult.isErr()) {
    logger.error("[R2 Route] Failed to resolve bucket", {
      objectKey,
      error: bucketResult.error.message,
    });
    return NextResponse.json({ error: bucketResult.error.message }, { status: 500 });
  }

  const bucket = bucketResult.value;
  logger.debug("[R2 Route] Fetching object from R2", { objectKey });
  const object = await bucket.get(objectKey);

  if (!object) {
    logger.warn("[R2 Route] Object not found", {
      objectKey,
      duration: Date.now() - startTime,
    });
    return NextResponse.json({ error: "Object not found" }, { status: 404 });
  }

  logger.debug("[R2 Route] Object found", {
    objectKey,
    size: object.size,
    contentType: object.httpMetadata?.contentType,
  });

  const headers = new Headers();

  // Manually set headers from httpMetadata to avoid serialization issues
  if (object.httpMetadata?.contentType) {
    headers.set("Content-Type", object.httpMetadata.contentType);
  }

  if (object.httpMetadata?.contentEncoding) {
    headers.set("Content-Encoding", object.httpMetadata.contentEncoding);
  }

  if (object.httpMetadata?.contentLanguage) {
    headers.set("Content-Language", object.httpMetadata.contentLanguage);
  }

  if (object.httpMetadata?.contentDisposition) {
    headers.set("Content-Disposition", object.httpMetadata.contentDisposition);
  }

  if (object.httpMetadata?.cacheControl) {
    headers.set("Cache-Control", object.httpMetadata.cacheControl);
  }

  if (typeof object.size === "number") {
    headers.set("Content-Length", object.size.toString());
  }

  // Images are immutable (filename includes timestamp, hash, and seed)
  // Cache for 1 day with immutable directive
  headers.set("Cache-Control", `public, max-age=${R2_IMAGE_CACHE_TTL_SECONDS}, immutable`);

  if (object.etag) {
    headers.set("ETag", object.etag);
  }

  if (object.uploaded instanceof Date) {
    headers.set("Last-Modified", object.uploaded.toUTCString());
  }

  try {
    const bodyStream = (object as R2ObjectBody).body;
    logger.debug("[R2 Route] Reading object body", { objectKey });
    const bodyArrayBuffer = await new Response(bodyStream).arrayBuffer();

    logger.debug("[R2 Route] Object body read", {
      objectKey,
      bodySize: bodyArrayBuffer.byteLength,
    });

    // Convert ArrayBuffer to Base64 safely
    const uint8Array = new Uint8Array(bodyArrayBuffer);
    let binaryString = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]!);
    }
    const bodyBase64 = btoa(binaryString);

    // Cache the response
    // Normalize header keys to lowercase for consistent retrieval
    const normalizedHeaders: Record<string, string> = {};
    for (const [key, value] of headers.entries()) {
      normalizedHeaders[key.toLowerCase()] = value;
    }
    const cachedResponse: CachedResponse = {
      body: bodyBase64,
      headers: normalizedHeaders,
      status: 200,
      statusText: "OK",
    };

    logger.debug("[R2 Route] Caching response", {
      objectKey,
      cacheKey,
    });
    // Cache for 1 day since images never change
    await set(cacheKey, cachedResponse, { ttlSeconds: R2_IMAGE_CACHE_TTL_SECONDS });

    const duration = Date.now() - startTime;
    logger.info("[R2 Route] Success", {
      objectKey,
      size: bodyArrayBuffer.byteLength,
      duration,
    });

    return new Response(bodyArrayBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    logger.error("[R2 Route] Error processing object", {
      objectKey,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
