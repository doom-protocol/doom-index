import { env } from "@/env";

/**
 * Get base URL for static asset access
 * Uses NEXT_PUBLIC_BASE_URL when available, falls back to localhost preview port.
 *
 * @returns Base URL with protocol and host (e.g., "http://localhost:8787" or "https://example.com")
 */
export function getBaseUrl(): string {
  const baseUrl = env.NEXT_PUBLIC_BASE_URL;
  return baseUrl;
}

export function getPumpFunUrl(address: string): string {
  return `https://pump.fun/${address}`;
}
