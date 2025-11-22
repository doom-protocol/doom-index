import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { logger } from "@/utils/logger";

export async function POST(req: NextRequest) {
  // check authentication
  const authHeader = req.headers.get("Authorization");
  const apiKey = authHeader?.replace("Bearer ", "");

  // if env.ADMIN_SECRET is not set, always reject (for security)
  if (!env.ADMIN_SECRET || apiKey !== env.ADMIN_SECRET) {
    logger.warn("admin.purge.unauthorized", {
      ip: req.headers.get("cf-connecting-ip"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // check configuration
  if (!env.CACHE_PURGE_API_TOKEN || !env.CACHE_PURGE_ZONE_ID) {
    return NextResponse.json({ error: "Cache purge configuration missing" }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({ files: [] as string[] }));
    const { files } = body as { files?: string[] }; // { files: string[] } or undefined (purge all files)

    const endpoint = `https://api.cloudflare.com/client/v4/zones/${env.CACHE_PURGE_ZONE_ID}/purge_cache`;

    const payload = files && Array.isArray(files) && files.length > 0 ? { files } : { purge_everything: true };

    logger.info("admin.purge.start", { payload });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.CACHE_PURGE_API_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("admin.purge.failed", {
        status: response.status,
        error: errorText,
      });
      return NextResponse.json({ error: "Cloudflare API error", details: errorText }, { status: response.status });
    }

    const result = await response.json();
    logger.info("admin.purge.success", { result });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    logger.error("admin.purge.error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
