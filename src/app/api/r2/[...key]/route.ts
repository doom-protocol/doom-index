import { NextResponse } from "next/server";
import { resolveR2Bucket } from "@/lib/r2";

type RouteContext = {
  params: Promise<{
    key: string[];
  }>;
};

const joinKey = (segments: string[]): string =>
  segments
    .map(segment => segment.replace(/^\/*|\/*$/g, ""))
    .filter(Boolean)
    .join("/");

export async function GET(_request: Request, { params }: RouteContext) {
  const { key } = await params;
  if (!Array.isArray(key) || key.length === 0) {
    return NextResponse.json({ error: "Missing R2 object key" }, { status: 400 });
  }

  const objectKey = joinKey(key);
  if (!objectKey) {
    return NextResponse.json({ error: "Invalid R2 object key" }, { status: 400 });
  }

  const bucketResult = resolveR2Bucket();
  if (bucketResult.isErr()) {
    return NextResponse.json({ error: bucketResult.error }, { status: 500 });
  }

  const bucket = bucketResult.value;
  const object = await bucket.get(objectKey);

  if (!object) {
    return new NextResponse(null, { status: 404 });
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
}
