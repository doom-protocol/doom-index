import { resolveR2BucketAsync } from "@/lib/r2";
import { NextResponse } from "next/server";
import { get, set } from "@/lib/cache";

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
  const { key } = await params;

  if (!key || key.length === 0) {
    return NextResponse.json({ error: "Invalid R2 object key" }, { status: 400 });
  }

  // Join key segments and normalize
  const objectKey = key
    .map(segment => segment.replace(/^\/*|\/*$/g, ""))
    .filter(Boolean)
    .join("/");

  if (!objectKey) {
    return NextResponse.json({ error: "Invalid R2 object key" }, { status: 400 });
  }

  const cacheKey = `r2:route:${objectKey}`;
  const cached = await get<CachedResponse>(cacheKey);

  if (cached !== null) {
    // Reconstruct Response from cached data
    const headers = new Headers(cached.headers);
    const body = Uint8Array.from(atob(cached.body), c => c.charCodeAt(0));
    return new Response(body, {
      status: cached.status,
      statusText: cached.statusText,
      headers,
    });
  }

  const bucketResult = await resolveR2BucketAsync();

  if (bucketResult.isErr()) {
    return NextResponse.json({ error: bucketResult.error.message }, { status: 500 });
  }

  const bucket = bucketResult.value;
  const object = await bucket.get(objectKey);

  if (!object) {
    return NextResponse.json({ error: "Object not found" }, { status: 404 });
  }

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

  headers.set("Cache-Control", "public, max-age=60");

  if (object.etag) {
    headers.set("ETag", object.etag);
  }

  if (object.uploaded instanceof Date) {
    headers.set("Last-Modified", object.uploaded.toUTCString());
  }

  const bodyStream = (object as R2ObjectBody).body;
  const bodyArrayBuffer = await new Response(bodyStream).arrayBuffer();

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
  await set(cacheKey, cachedResponse, { ttlSeconds: 60 });

  return new Response(bodyArrayBuffer, {
    status: 200,
    headers,
  });
}
