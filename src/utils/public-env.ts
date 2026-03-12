const PUBLIC_LOG_LEVELS = ["ERROR", "WARN", "INFO", "DEBUG", "LOG"] as const;

export const DEFAULT_PUBLIC_GENERATION_INTERVAL_MS = 600_000;
export const DEFAULT_PUBLIC_LOG_LEVEL = "INFO";

export type PublicLogLevel = (typeof PUBLIC_LOG_LEVELS)[number];

export function parsePublicGenerationIntervalMs(value: string | undefined): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
    return DEFAULT_PUBLIC_GENERATION_INTERVAL_MS;
  }

  return parsed;
}

export function parsePublicLogLevel(value: string | undefined): PublicLogLevel {
  const normalized = value?.trim().toUpperCase();

  if (normalized && PUBLIC_LOG_LEVELS.includes(normalized as PublicLogLevel)) {
    return normalized as PublicLogLevel;
  }

  return DEFAULT_PUBLIC_LOG_LEVEL;
}

export function readBaseUrlDevelopment(baseUrl: string | undefined): boolean {
  return typeof baseUrl === "string" && baseUrl.includes("localhost");
}

export function readHostnameDevelopment(hostname: string | undefined): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function getPublicGenerationIntervalMs(): number {
  return parsePublicGenerationIntervalMs(process.env.NEXT_PUBLIC_GENERATION_INTERVAL_MS);
}

export function getPublicLogLevel(): PublicLogLevel {
  return parsePublicLogLevel(process.env.LOG_LEVEL);
}

export function isPublicDevelopment(): boolean {
  if (typeof window !== "undefined") {
    return (
      readHostnameDevelopment(window.location.hostname) || readBaseUrlDevelopment(process.env.NEXT_PUBLIC_BASE_URL)
    );
  }

  return readBaseUrlDevelopment(process.env.NEXT_PUBLIC_BASE_URL);
}
