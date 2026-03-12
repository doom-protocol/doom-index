/**
 * Environment Configuration
 *
 * Type-safe environment variable management using T3 Env
 * @see https://env.t3.gg/docs/nextjs
 */

import { createEnv } from "@t3-oss/env-nextjs";
import * as v from "valibot";

const serverSchema = {
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
};

const clientSchema = {
  NEXT_PUBLIC_BASE_URL: v.pipe(v.string(), v.url()),
  NEXT_PUBLIC_R2_URL: v.optional(v.pipe(v.string(), v.minLength(1)), "/api/r2"),
  NEXT_PUBLIC_SOLANA_RPC_URL: v.optional(v.pipe(v.string(), v.url()), "https://api.devnet.solana.com"),
};

const sharedSchema = {
  IMAGE_MODEL: v.optional(v.string()),
  LOG_LEVEL: v.optional(v.picklist(["ERROR", "WARN", "INFO", "DEBUG", "LOG"]), "DEBUG"),
  NODE_ENV: v.optional(v.picklist(["development", "test", "production"]), "development"),
  NEXT_PUBLIC_GENERATION_INTERVAL_MS: v.pipe(v.string(), v.transform(Number), v.number(), v.integer(), v.minValue(1)),
};

const readServerRuntimeEnv = () => ({
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
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_R2_URL: process.env.NEXT_PUBLIC_R2_URL,
  NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  IMAGE_MODEL: process.env.IMAGE_MODEL,
  NODE_ENV: process.env.NODE_ENV,
  LOG_LEVEL: process.env.LOG_LEVEL,
  NEXT_PUBLIC_GENERATION_INTERVAL_MS: process.env.NEXT_PUBLIC_GENERATION_INTERVAL_MS,
});

const readPublicRuntimeEnv = () => ({
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_R2_URL: process.env.NEXT_PUBLIC_R2_URL,
  NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  IMAGE_MODEL: process.env.IMAGE_MODEL,
  NODE_ENV: process.env.NODE_ENV,
  LOG_LEVEL: process.env.LOG_LEVEL,
  NEXT_PUBLIC_GENERATION_INTERVAL_MS: process.env.NEXT_PUBLIC_GENERATION_INTERVAL_MS,
});

const createServerEnv = () =>
  createEnv({
    server: serverSchema,
    client: clientSchema,
    shared: sharedSchema,
    runtimeEnv: readServerRuntimeEnv(),
    emptyStringAsUndefined: true,
    isServer: true,
  });

type ServerEnv = ReturnType<typeof createServerEnv>;

const shouldEagerlyValidateServerEnv = () => {
  return typeof window === "undefined" && process.env.NEXT_RUNTIME !== "";
};

export const publicEnv = createEnv({
  client: clientSchema,
  shared: sharedSchema,
  runtimeEnv: readPublicRuntimeEnv(),
  emptyStringAsUndefined: true,
  isServer: false,
});

let cachedServerEnv: ServerEnv | null = null;

const getServerEnv = (): ServerEnv => {
  cachedServerEnv ??= createServerEnv();
  return cachedServerEnv;
};

const ignoredServerEnvProperties = new Set(["__esModule", "$$typeof", "then"]);
const envProxyTarget = Object.freeze({});

export const env = new Proxy(envProxyTarget, {
  get(_target, property) {
    if (typeof property === "string" && ignoredServerEnvProperties.has(property)) {
      return undefined;
    }

    const serverEnv = getServerEnv() as Record<PropertyKey, unknown>;
    return serverEnv[property];
  },
  has(_target, property) {
    if (typeof property === "string" && ignoredServerEnvProperties.has(property)) {
      return false;
    }

    return Reflect.has(getServerEnv(), property);
  },
  ownKeys() {
    return Reflect.ownKeys(getServerEnv());
  },
  getOwnPropertyDescriptor(_target, property) {
    if (typeof property === "string" && ignoredServerEnvProperties.has(property)) {
      return undefined;
    }

    return Reflect.getOwnPropertyDescriptor(getServerEnv(), property);
  },
}) as ServerEnv;

if (shouldEagerlyValidateServerEnv()) {
  getServerEnv();
}

export function isDevelopment(): boolean {
  return publicEnv.NEXT_PUBLIC_BASE_URL.includes("localhost");
}

export function getEnvironmentName(): "development" | "production" {
  return isDevelopment() ? "development" : "production";
}
