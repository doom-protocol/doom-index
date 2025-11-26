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

/**
 * Check if a path matches any suspicious pattern
 */
function isSuspiciousPath(pathname: string): boolean {
  return SUSPICIOUS_PATH_PATTERNS.some(pattern => pattern.test(pathname));
}

/**
 * Cache key for 404 responses
 */
function get404CacheKey(pathname: string): string {
  return `middleware:404:${pathname}`;
}

/**
 * Next.js Middleware
 *
 * Blocks suspicious paths (WordPress, PHP, .env, etc.) early to prevent
 * unnecessary processing and reduce log noise from bot/scanner attacks.
 *
 * Also caches 404 responses for suspicious paths to reduce repeated processing.
 */
export async function middleware(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  // Skip middleware for API routes and static assets
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/icon.png")
  ) {
    return null;
  }

  // Check if path is suspicious
  if (!isSuspiciousPath(pathname)) {
    return null;
  }

  // Check cache for previously blocked paths
  const cacheKey = get404CacheKey(pathname);
  const cached = await get<{ status: number; headers: Record<string, string> }>(cacheKey);

  if (cached !== null) {
    // Return cached 404 response (no logging to reduce noise)
    return new NextResponse(null, {
      status: cached.status,
      headers: cached.headers,
    });
  }

  // Cache 404 responses for suspicious paths for 1 hour
  // This reduces repeated processing of the same attack patterns
  const cacheHeaders: Record<string, string> = {
    "Cache-Control": "public, max-age=3600",
  };

  await set(
    cacheKey,
    {
      status: 404,
      headers: cacheHeaders,
    },
    { ttlSeconds: 3600 },
  );

  // Log only once per path (when cache is set) to reduce log noise
  logger.debug("[Middleware] Blocked suspicious path", {
    pathname,
    method: request.method,
    userAgent: request.headers.get("user-agent"),
  });

  // Return 404 response directly
  return new NextResponse(null, {
    status: 404,
    headers: cacheHeaders,
  });
}

/**
 * Middleware matcher configuration
 * Only run middleware on paths that might be suspicious
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon.png (static assets)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png).*)",
  ],
};
