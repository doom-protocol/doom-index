/**
 * Environment Configuration
 *
 * Type-safe environment variable management using T3 Env
 * @see https://env.t3.gg/docs/nextjs
 */

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Server-side environment variables
   * These are only available on the server and will not be bundled to the client
   */
  server: {
    // Image Provider API Keys
    OPENAI_API_KEY: z.string().optional(),
    RUNWARE_API_KEY: z.string().min(1),
    // External API Keys
    TAVILY_API_KEY: z.string().optional(),
    COINGECKO_API_KEY: z.string().optional(),
    FORCE_TOKEN_LIST: z.string().optional(),
  },

  /**
   * Client-side environment variables
   * These must be prefixed with NEXT_PUBLIC_ and will be bundled to the client
   */
  client: {
    NEXT_PUBLIC_BASE_URL: z.string().min(1),
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
    IMAGE_MODEL: z.string().optional(),
    LOG_LEVEL: z.enum(["ERROR", "WARN", "INFO", "DEBUG", "LOG"]).default("DEBUG"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
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
    // Client
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    // Shared
    IMAGE_MODEL: process.env.IMAGE_MODEL,
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
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
