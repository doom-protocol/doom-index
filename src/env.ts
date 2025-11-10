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
    REPLICATE_API_KEY: z.string().optional(),
    RUNWARE_API_KEY: z.string().optional(),

    // Cloudflare R2 Storage
    R2_PUBLIC_DOMAIN: z.string().default("https://doom-index-storage.r2.dev"),

    // Node Environment
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z.enum(["ERROR", "WARN", "INFO", "DEBUG", "LOG"]).optional(),
  },

  /**
   * Client-side environment variables
   * These must be prefixed with NEXT_PUBLIC_ and will be bundled to the client
   */
  client: {
    // Currently no client-side env vars
  },

  /**
   * Shared environment variables
   * These can be used on both client and server
   */
  shared: {
    // Image Generation Provider
    // "smart" automatically selects the appropriate provider based on the model
    // Note: "mock" is for testing only
    IMAGE_PROVIDER: z.enum(["ai-sdk", "runware-sdk", "smart"]).default("smart"),

    // Prompt Template
    PROMPT_TEMPLATE: z.enum(["default", "experimental"]).default("default"),
  },

  /**
   * Runtime environment variables
   * For Next.js >= 13.4.4, we need to manually destructure all variables
   */
  runtimeEnv: {
    // Server
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    REPLICATE_API_KEY: process.env.REPLICATE_API_KEY,
    RUNWARE_API_KEY: process.env.RUNWARE_API_KEY,
    R2_PUBLIC_DOMAIN: process.env.R2_PUBLIC_DOMAIN,
    NODE_ENV: process.env.NODE_ENV ?? "production",
    LOG_LEVEL: process.env.LOG_LEVEL,
    // Shared
    IMAGE_PROVIDER: process.env.IMAGE_PROVIDER,
    PROMPT_TEMPLATE: process.env.PROMPT_TEMPLATE,
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
