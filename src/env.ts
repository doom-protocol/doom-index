/**
 * Environment Configuration
 *
 * Type-safe environment variable management using T3 Env
 * @see https://env.t3.gg/docs/nextjs
 */

import { createEnv } from "@t3-oss/env-nextjs";
import * as v from "valibot";
import { DEFAULT_ARWEAVE_GATEWAY_BASE_URL } from "@/constants/arweave";

const unsignedIntegerStringSchema = v.pipe(v.string(), v.regex(/^\d+$/, "Expected an unsigned integer string"));
const nonEmptyEnvString = v.pipe(v.string(), v.trim(), v.minLength(1));

const serverSchema = {
  // Image Provider API Keys
  RUNWARE_API_KEY: nonEmptyEnvString,
  // External API Keys
  TAVILY_API_KEY: nonEmptyEnvString,
  COINGECKO_API_KEY: nonEmptyEnvString,
  FORCE_TOKEN_LIST: v.optional(nonEmptyEnvString),
  SLACK_WEBHOOK_URL: v.optional(v.pipe(v.string(), v.trim(), v.url())),
  // ArDrive / Arweave
  ARDRIVE_TURBO_SECRET_KEY: nonEmptyEnvString,
  ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON: v.optional(unsignedIntegerStringSchema),
  ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC: v.optional(unsignedIntegerStringSchema),
  ARWEAVE_GATEWAY_BASE_URL: v.optional(v.pipe(v.string(), v.trim(), v.url()), DEFAULT_ARWEAVE_GATEWAY_BASE_URL),
  // Admin Tools
  ADMIN_SECRET: nonEmptyEnvString,
  CACHE_PURGE_API_TOKEN: nonEmptyEnvString,
  CACHE_PURGE_ZONE_ID: nonEmptyEnvString,
};

const clientSchema = {
  NEXT_PUBLIC_BASE_URL: v.pipe(v.string(), v.url()),
  NEXT_PUBLIC_SOLANA_RPC_URL: v.optional(v.pipe(v.string(), v.url()), "https://api.devnet.solana.com"),
};

const sharedSchema = {
  IMAGE_MODEL: v.optional(v.string(), "runware:400@1"),
  LOG_LEVEL: v.optional(v.picklist(["ERROR", "WARN", "INFO", "DEBUG", "LOG"]), "DEBUG"),
  NODE_ENV: v.optional(v.picklist(["development", "test", "production"]), "development"),
  NEXT_PUBLIC_GENERATION_INTERVAL_MS: v.pipe(v.string(), v.transform(Number), v.number(), v.integer(), v.minValue(1)),
};

const readServerRuntimeEnv = () => ({
  RUNWARE_API_KEY: process.env.RUNWARE_API_KEY,
  TAVILY_API_KEY: process.env.TAVILY_API_KEY,
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
  FORCE_TOKEN_LIST: process.env.FORCE_TOKEN_LIST,
  SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
  ARDRIVE_TURBO_SECRET_KEY: process.env.ARDRIVE_TURBO_SECRET_KEY,
  ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON: process.env.ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON,
  ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC: process.env.ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC,
  ARWEAVE_GATEWAY_BASE_URL: process.env.ARWEAVE_GATEWAY_BASE_URL,
  ADMIN_SECRET: process.env.ADMIN_SECRET,
  CACHE_PURGE_API_TOKEN: process.env.CACHE_PURGE_API_TOKEN,
  CACHE_PURGE_ZONE_ID: process.env.CACHE_PURGE_ZONE_ID,
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  IMAGE_MODEL: process.env.IMAGE_MODEL,
  NODE_ENV: process.env.NODE_ENV,
  LOG_LEVEL: process.env.LOG_LEVEL,
  NEXT_PUBLIC_GENERATION_INTERVAL_MS: process.env.NEXT_PUBLIC_GENERATION_INTERVAL_MS,
});

const readPublicRuntimeEnv = () => ({
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
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
