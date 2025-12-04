import { env } from "@/env";

export const GITHUB_URL = "https://github.com/doom-protocol/doom-index";
export const X_URL = "https://x.com/doom_index";
export const PUMP_FUN_URL = "https://pump.fun/coin/AJfn5M1bWeSsZDq89TgkKXm7AdtAQCsqzkYRxYGoqdev";
export const DEV_FUN_URL = "https://dev.fun/p/155bae58a27d2f0905ed";

export const GENERATION_INTERVAL_MS = Number(env.NEXT_PUBLIC_GENERATION_INTERVAL_MS ?? 3600000);

// Fallback image path for when painting images fail to load
export const FALLBACK_PAINTING_IMAGE = "/placeholder-painting.webp";

// Cache TTL constants (in seconds)
export const CACHE_TTL_SECONDS = {
  // 1 minute
  ONE_MINUTE: 60,
  // 1 hour
  ONE_HOUR: 3600,
  // 1 day
  ONE_DAY: 86400,
} as const;

// R2 image cache TTL (1 day)
export const R2_IMAGE_CACHE_TTL_SECONDS = CACHE_TTL_SECONDS.ONE_DAY;
