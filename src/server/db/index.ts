import { resolveCloudflareEnv } from "@/lib/cloudflare-context";
import { logger } from "@/utils/logger";
import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

interface DbBindings {
  DB?: D1Database;
}

let db: DrizzleD1Database<typeof schema> | undefined;

export function resetDBForTests(): void {
  db = undefined;
}

/**
 * Get D1 database instance
 * Works in both Cloudflare Workers and Next.js Cloudflare adapters.
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

  if (db !== undefined) return db;

  let binding: D1Database | undefined;
  const env = await resolveCloudflareEnv();
  if (!env) {
    logger.error("Failed to get Cloudflare context");
    throw new Error("Failed to get Cloudflare context for D1 binding");
  }

  try {
    binding = (env as DbBindings).DB;
  } catch (error) {
    logger.error("Failed to get Cloudflare context", { error });
    throw new Error("Failed to get Cloudflare context for D1 binding");
  }

  if (!binding) {
    throw new Error("D1 DB binding not found (env.DB). Check the Wrangler D1 bindings configuration.");
  }

  logger.debug("Connecting to Cloudflare D1 database");
  db = drizzle(binding, { schema });
  return db;
}
