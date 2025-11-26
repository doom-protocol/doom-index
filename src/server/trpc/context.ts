import { logger } from "@/utils/logger";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export type Context = {
  headers: Headers;
  logger: typeof logger;
  env?: CloudflareEnv;
  kvNamespace?: KVNamespace;
  r2Bucket?: R2Bucket;
};

// Context creation for API Handler
export async function createContext(opts: FetchCreateContextFnOptions): Promise<Context> {
  const { req } = opts;

  try {
    const { env } = await getCloudflareContext({ async: true });

    return {
      headers: req.headers,
      logger,
      env,
      kvNamespace: env.VIEWER_KV,
      r2Bucket: env.R2_BUCKET,
    };
  } catch (_error) {
    logger.warn("trpc.context.cloudflare-unavailable", {
      message: "Cloudflare context not available, using fallback",
    });

    return {
      headers: req.headers,
      logger,
    };
  }
}

// Context creation for Server Component
export async function createServerContext(): Promise<Context> {
  const { headers } = await import("next/headers");
  const headersList = await headers();

  try {
    const { env } = await getCloudflareContext({ async: true });

    return {
      headers: headersList,
      logger,
      env,
      kvNamespace: env.VIEWER_KV,
      r2Bucket: env.R2_BUCKET,
    };
  } catch (_error) {
    logger.warn("trpc.context.cloudflare-unavailable", {
      message: "Cloudflare context not available in server component",
    });

    return {
      headers: headersList,
      logger,
    };
  }
}
