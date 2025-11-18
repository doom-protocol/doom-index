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
    // Fallback if origin is empty or invalid (e.g., in test environments)
    if (origin && origin !== "null" && origin !== "undefined") {
      return origin;
    }
  }

  // On server side, use env variable or fallback
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  // Fallback for server-side rendering
  const isProduction = process.env.NODE_ENV === "production";
  return isProduction ? "https://doomindex.fun" : "http://localhost:8787";
}

export function getPumpFunUrl(address: string): string {
  return `https://pump.fun/${address}`;
}
