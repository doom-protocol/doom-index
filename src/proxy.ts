import { CACHE_TTL_SECONDS } from "@/constants";
import { get, set } from "@/lib/cache";
import { logger } from "@/utils/logger";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Suspicious path patterns that are commonly targeted by bots/scanners
 * These paths are known WordPress, PHP, and common vulnerability scan targets
 */
const SUSPICIOUS_PATH_PATTERNS = [
  /^\/wp-admin/i,
  /^\/wp-content/i,
  /^\/wp-includes/i,
  /^\/wp-login/i,
  /^\/wp-config/i,
  /\.php$/i,
  /\.env$/i,
  /^\/\.env/i,
  /^\/_profiler/i,
  /^\/phpinfo/i,
  /^\/phpMyAdmin/i,
  /^\/admin/i,
  /^\/administrator/i,
  /^\/\.git/i,
  /^\/\.svn/i,
  /^\/\.htaccess/i,
  /^\/\.well-known\/acme-challenge/i,
  /^\/\.well-known\/security\.txt/i,
  /^\/xmlrpc\.php/i,
  /^\/readme\.html/i,
  /^\/license\.txt/i,
] as const;

function isSuspiciousPath(pathname: string): boolean {
  return SUSPICIOUS_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

function get404CacheKey(pathname: string): string {
  return `middleware:404:${pathname}`;
}

export async function proxy(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/icon.png")
  ) {
    return null;
  }

  if (!isSuspiciousPath(pathname)) {
    return null;
  }

  const cacheKey = get404CacheKey(pathname);
  const cached = await get<{ status: number; headers: Record<string, string> }>(cacheKey);

  if (cached !== null) {
    return new NextResponse(null, {
      status: cached.status,
      headers: cached.headers,
    });
  }

  const cacheHeaders: Record<string, string> = {
    "Cache-Control": `public, max-age=${String(CACHE_TTL_SECONDS.ONE_HOUR)}`,
  };

  await set(
    cacheKey,
    {
      status: 404,
      headers: cacheHeaders,
    },
    { ttlSeconds: CACHE_TTL_SECONDS.ONE_HOUR },
  );

  logger.debug("[Proxy] Blocked suspicious path", {
    pathname,
    method: request.method,
    userAgent: request.headers.get("user-agent"),
  });

  return new NextResponse(null, {
    status: 404,
    headers: cacheHeaders,
  });
}

export default proxy;

export const config = {
  matcher: ["/((?!api|_next/static|favicon.ico|icon.png).*)"],
};
