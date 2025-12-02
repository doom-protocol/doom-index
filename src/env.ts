/**
 * Environment Configuration
 *
 * Type-safe environment variable management using T3 Env
 * @see https://env.t3.gg/docs/nextjs
 */

import { createEnv } from "@t3-oss/env-nextjs";
import * as v from "valibot";

export const env = createEnv({
  /**
   * Server-side environment variables
   * These are only available on the server and will not be bundled to the client
   */
  server: {
    // Image Provider API Keys
    OPENAI_API_KEY: v.optional(v.string()),
    RUNWARE_API_KEY: v.pipe(v.string(), v.minLength(1)),
    // External API Keys
    TAVILY_API_KEY: v.optional(v.string()),
    COINGECKO_API_KEY: v.optional(v.string()),
    FORCE_TOKEN_LIST: v.optional(v.string()),
    SLACK_WEBHOOK_URL: v.optional(v.string()),
    // IPFS / Pinata
    PINATA_JWT: v.optional(v.string()),
    // Admin Tools
    ADMIN_SECRET: v.optional(v.string()),
    CACHE_PURGE_API_TOKEN: v.optional(v.string()),
    CACHE_PURGE_ZONE_ID: v.optional(v.string()),
  },

  /**
   * Client-side environment variables
   * These must be prefixed with NEXT_PUBLIC_ and will be bundled to the client
   */
  client: {
    NEXT_PUBLIC_BASE_URL: v.pipe(v.string(), v.minLength(1)),
    // R2 Public URL (e.g., "https://storage.doomindex.fun" or "http://localhost:8787/api/r2")
    // If set, images will be served directly from this URL instead of /api/r2 endpoint
    NEXT_PUBLIC_R2_URL: v.pipe(v.string(), v.minLength(1)),
    // Solana RPC URL for client-side transactions
    NEXT_PUBLIC_SOLANA_RPC_URL: v.optional(v.pipe(v.string(), v.url()), "https://api.devnet.solana.com"),
  },

  /**
   * Shared environment variables
   * These can be used on both client and server
   */
  shared: {
    // Image Generation Model
    // The model name to use for image generation (e.g., "runware:106@1", "civitai:38784@44716")
    // If not specified, defaults to "runware:106@1"
    // The provider will be automatically resolved based on the model
    IMAGE_MODEL: v.optional(v.string()),
    LOG_LEVEL: v.optional(v.picklist(["ERROR", "WARN", "INFO", "DEBUG", "LOG"]), "DEBUG"),
    NODE_ENV: v.optional(v.picklist(["development", "test", "production"]), "development"),
    NEXT_PUBLIC_GENERATION_INTERVAL_MS: v.optional(v.pipe(v.unknown(), v.transform(Number)), 600000), // 10 minutes
  },

  /**
   * Runtime environment variables
   * For Next.js >= 13.4.4, we need to manually destructure all variables
   */
  runtimeEnv: {
    // Server
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    RUNWARE_API_KEY: process.env.RUNWARE_API_KEY,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
    FORCE_TOKEN_LIST: process.env.FORCE_TOKEN_LIST,
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
    PINATA_JWT: process.env.PINATA_JWT,
    ADMIN_SECRET: process.env.ADMIN_SECRET,
    CACHE_PURGE_API_TOKEN: process.env.CACHE_PURGE_API_TOKEN,
    CACHE_PURGE_ZONE_ID: process.env.CACHE_PURGE_ZONE_ID,
    // Client
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_R2_URL: process.env.NEXT_PUBLIC_R2_URL,
    NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    // Shared
    IMAGE_MODEL: process.env.IMAGE_MODEL,
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
    NEXT_PUBLIC_GENERATION_INTERVAL_MS: process.env.NEXT_PUBLIC_GENERATION_INTERVAL_MS,
  },

  /**
   * Skip validation during build if set to "1"
   * Useful for Docker builds or CI where env vars are not available
   *
   * IMPORTANT: For Cloudflare Workers deployment, validation is always skipped
   * because environment variables are passed via the `env` object at runtime,
   * not through process.env at build/load time.
   */
  skipValidation: true,

  /**
   * Makes it so that empty strings are treated as undefined
   * Useful for optional environment variables
   */
  emptyStringAsUndefined: true,
});
