import { resolveR2BucketAsync, joinR2Key } from "@/lib/r2";
import { NextResponse } from "next/server";
import { get, set } from "@/lib/cache";
import { logger } from "@/utils/logger";

type CachedResponse = {
  body: string; // Base64 encoded for binary data
  headers: Record<string, string>;
  status: number;
  statusText: string;
};

/**
 * Direct R2 object access endpoint for binary data (images, etc.)
 * This endpoint is used by browsers directly via <img src> tags,
 * so it cannot use tRPC streaming which requires tRPC client.
 *
 * URL format: /api/r2/key1/key2/file.webp
 */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }): Promise<Response> {
  const startTime = Date.now();
  const requestUrl = req.url;

  logger.debug("[R2 Route] Request received", {
    url: requestUrl,
    method: req.method,
  });

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
  object.writeHttpMetadata?.(headers);

  if (!headers.has("Content-Type")) {
    const contentType = object.httpMetadata?.contentType;
    if (contentType) {
      headers.set("Content-Type", contentType);
    }
  }

  if (typeof object.size === "number") {
    headers.set("Content-Length", object.size.toString());
  }

  // Images are immutable (filename includes timestamp, hash, and seed)
  // Cache for 1 year with immutable directive
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

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
    // Cache for 1 year since images never change
    await set(cacheKey, cachedResponse, { ttlSeconds: 31536000 });

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
