import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { logger } from "@/utils/logger";
import * as schema from "./schema";

export * from "./schema";
export { schema };

let db: DrizzleD1Database<typeof schema> | undefined;

/**
 * Get D1 database instance
 * Works in both Cloudflare Workers (direct env.DB) and Next.js/OpenNext (getCloudflareContext)
 * 
 * @param d1Binding - Optional D1Database binding (for Worker entrypoints)
 * @returns DrizzleD1Database instance
 */
export async function getDB(d1Binding?: D1Database): Promise<DrizzleD1Database<typeof schema>> {
  if (db) return db;

  let binding = d1Binding;
  if (!binding) {
    try {
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

  logger.info("Connecting to Cloudflare D1 database");
  db = drizzle(binding, { schema });
  return db;
}
