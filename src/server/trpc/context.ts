import { getCloudflareContext } from "@opennextjs/cloudflare";
import { logger } from "@/utils/logger";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export type Context = {
  headers: Headers;
  logger: typeof logger;
  env?: Cloudflare.Env;
  kvNamespace?: KVNamespace;
  r2Bucket?: R2Bucket;
};

// API Handler用コンテキスト作成
export async function createContext(opts: FetchCreateContextFnOptions): Promise<Context> {
  const { req } = opts;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as Cloudflare.Env;

    return {
      headers: req.headers,
      logger,
      env: cfEnv,
      kvNamespace: cfEnv.VIEWER_KV,
      r2Bucket: cfEnv.R2_BUCKET,
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

// Server Component用コンテキスト作成
export async function createServerContext(): Promise<Context> {
  const { headers } = await import("next/headers");
  const headersList = await headers();

  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as Cloudflare.Env;

    return {
      headers: headersList,
      logger,
      env: cfEnv,
      kvNamespace: cfEnv.VIEWER_KV,
      r2Bucket: cfEnv.R2_BUCKET,
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
