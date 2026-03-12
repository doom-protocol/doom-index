import { isDevelopment, publicEnv } from "@/env";

/**
 * Get base URL for static asset access
 * In browser/client: uses window.location.origin (current page origin)
 * On server: uses NEXT_PUBLIC_BASE_URL or falls back to production URL
 *
 * @returns Base URL with protocol and host (e.g., "http://localhost:8787" or "https://example.com")
 */
export function getBaseUrl(): string {
  // In browser/client context, always use the current page origin
  // This ensures requests go to the same origin as the page
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    if (origin && origin !== "null" && origin !== "undefined") {
      return origin;
    }
  }

  const runtimeBaseUrl = publicEnv.NEXT_PUBLIC_BASE_URL;
  if (runtimeBaseUrl) {
    return runtimeBaseUrl;
  }

  // Fallback for server-side rendering
  return isDevelopment() ? "http://localhost:8787" : "https://doomindex.fun";
}
