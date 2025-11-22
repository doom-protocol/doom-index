import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { logger } from "@/utils/logger";
import * as schema from "./schema";

let db: DrizzleD1Database<typeof schema> | undefined;

/**
 * Get D1 database instance
 * Works in both Cloudflare Workers (direct env.DB) and Next.js/OpenNext (getCloudflareContext)
 *
 * @param d1Binding - Optional D1Database binding (for Worker entrypoints)
 * @returns DrizzleD1Database instance
 */
export async function getDB(d1Binding?: D1Database): Promise<DrizzleD1Database<typeof schema>> {
  // If explicit binding is provided, always create a new instance (or update cache)
  // This ensures that in Cron/Worker context, we use the fresh binding passed from env
  if (d1Binding) {
    db = drizzle(d1Binding, { schema });
    return db;
  }

  if (db) return db;

  let binding: D1Database | undefined = d1Binding;
  if (!binding) {
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const { env } = await getCloudflareContext({ async: true });
      binding = (env as Cloudflare.Env).DB;
    } catch (error) {
      logger.error("Failed to get Cloudflare context", { error });
      throw new Error("Failed to get Cloudflare context for D1 binding");
    }
  }

  if (!binding) {
    throw new Error("D1 DB binding not found (env.DB). Check wrangler.toml [[d1_databases]].");
  }

  logger.debug("Connecting to Cloudflare D1 database");
  db = drizzle(binding, { schema });
  return db;
}
