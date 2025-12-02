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
 * Build ImageTransform options from CloudflareImageOptions
 * Maps our internal options to Cloudflare Images binding transform options
 */
function buildImageTransform(options: CloudflareImageOptions): ImageTransform {
  const transform: ImageTransform = {};

  if (options.width) transform.width = options.width;
  if (options.height) transform.height = options.height;
  if (options.fit) transform.fit = options.fit;
  if (options.sharpen) transform.sharpen = options.sharpen;

  return transform;
}

/**
 * Build ImageOutputOptions from CloudflareImageOptions
 * Maps our internal options to Cloudflare Images binding output options
 */
function buildImageOutputOptions(options: CloudflareImageOptions): ImageOutputOptions {
  // Map format string to MIME type
  let format: ImageOutputOptions["format"] = "image/webp"; // default

  if (options.format && options.format !== "auto") {
    const formatMap: Record<string, ImageOutputOptions["format"]> = {
      webp: "image/webp",
      avif: "image/avif",
      jpeg: "image/jpeg",
      png: "image/png",
    };
    format = formatMap[options.format] ?? "image/webp";
  }

  const output: ImageOutputOptions = { format };

  if (options.quality) output.quality = options.quality;

  return output;
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
 * - When transform params are present, images are transformed using IMAGES binding
 *   (Cloudflare Images API) for type-safe image transformation.
 * - Without transform params, images are served directly from R2 (cached in KV).
 */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }): Promise<Response> {
  const startTime = Date.now();
  const requestUrl = req.url;

  logger.debug("[R2 Route] Request received", {
    url: requestUrl,
    method: req.method,
  });

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

  // For non-transformed images, use KV cache
  const cacheKey = `r2:route:${objectKey}`;

  // Skip cache for transformed images (they're handled by IMAGES binding)
  if (!transformOptions) {
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

  // If transform options are present, use IMAGES binding to transform the image
  if (transformOptions) {
    try {
      const { env: cfEnv } = await getCloudflareContext({ async: true });
      const images = cfEnv.IMAGES;

      if (images) {
        logger.debug("[R2 Route] Using IMAGES binding for transformation", {
          objectKey,
          transformOptions,
        });

        const bodyStream = object.body;
        const imageTransform = buildImageTransform(transformOptions);
        const outputOptions = buildImageOutputOptions(transformOptions);

        // Apply transformation using IMAGES binding
        const transformer = images.input(bodyStream);
        const transformedResult = await transformer.transform(imageTransform).output(outputOptions);

        const duration = Date.now() - startTime;
        logger.info("[R2 Route] Transform success", {
          objectKey,
          transformOptions,
          duration,
          contentType: transformedResult.contentType(),
        });

        // Get the response and add cache headers
        const transformedResponse = transformedResult.response();
        const responseHeaders = new Headers(transformedResponse.headers);
        responseHeaders.set("Cache-Control", `public, max-age=${R2_IMAGE_CACHE_TTL_SECONDS}, immutable`);

        return new Response(transformedResponse.body, {
          status: transformedResponse.status,
          headers: responseHeaders,
        });
      } else {
        logger.warn("[R2 Route] IMAGES binding not available, falling back to direct R2", {
          objectKey,
        });
      }
    } catch (error) {
      logger.error("[R2 Route] Image transform error, falling back to direct R2", {
        objectKey,
        error: error instanceof Error ? error.message : String(error),
      });
      // Re-fetch the object since the stream was consumed during transformation attempt
      const freshObject = await bucket.get(objectKey);
      if (!freshObject) {
        return NextResponse.json({ error: "Object not found" }, { status: 404 });
      }
      // Continue with the fresh object for direct R2 access
      return serveR2Object(freshObject, objectKey, cacheKey, startTime);
    }
  }

  return serveR2Object(object, objectKey, cacheKey, startTime);
}

/**
 * Serve an R2 object directly without transformation
 * Extracted to avoid code duplication between normal path and transform fallback
 */
async function serveR2Object(
  object: R2ObjectBody,
  objectKey: string,
  cacheKey: string,
  startTime: number,
): Promise<Response> {
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
    const bodyStream = object.body;
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
