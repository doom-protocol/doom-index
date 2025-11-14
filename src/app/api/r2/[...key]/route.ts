import { resolveR2BucketAsync } from "@/lib/r2";
import { NextResponse } from "next/server";
import { withRequestCache } from "@/lib/cache";

/**
 * Direct R2 object access endpoint for binary data (images, etc.)
 * This endpoint is used by browsers directly via <img src> tags,
 * so it cannot use tRPC streaming which requires tRPC client.
 *
 * URL format: /api/r2/key1/key2/file.webp
 */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }): Promise<Response> {
  return withRequestCache(req, 60, async () => {
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
    return new Response(bodyStream, {
      status: 200,
      headers,
    });
  });
}
