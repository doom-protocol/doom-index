import { env } from "@/env";

export const GITHUB_URL = "https://github.com/doom-protocol/doom-index";
export const X_URL = "https://x.com/doom_index";
export const PUMP_FUN_URL = "https://pump.fun/coin/AJfn5M1bWeSsZDq89TgkKXm7AdtAQCsqzkYRxYGoqdev";
export const DEV_FUN_URL = "https://dev.fun/p/155bae58a27d2f0905ed";

export const GENERATION_INTERVAL_MS = Number(env.NEXT_PUBLIC_GENERATION_INTERVAL_MS ?? 600000);

// Image cache version for busting browser cache (increment when CORS or content changes)
export const IMAGE_CACHE_VERSION = "2";

// Fallback image path for when painting images fail to load
export const FALLBACK_PAINTING_IMAGE = "/placeholder-painting.webp";
