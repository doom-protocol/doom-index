import { env } from "@/env";

/**
 * Get base URL for static asset access
 * Uses NEXT_PUBLIC_BASE_URL when available, falls back to localhost preview port.
 *
 * @returns Base URL with protocol and host (e.g., "http://localhost:8787" or "https://example.com")
 */
export function getBaseUrl(): string {
  // 1) Explicit env takes precedence (works on prod and preview)
  if (env.NEXT_PUBLIC_BASE_URL) return env.NEXT_PUBLIC_BASE_URL;
  // 2) Fallback by environment for local/dev vs production
  const isProduction = env.NODE_ENV === "production";
  return isProduction ? "https://doomindex.fun" : "http://localhost:8787";
}

export function getPumpFunUrl(address: string): string {
  return `https://pump.fun/${address}`;
}
