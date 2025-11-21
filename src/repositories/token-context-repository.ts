import { Result, err, ok } from "neverthrow";
import { eq } from "drizzle-orm";
import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";
import { getDB } from "@/db";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Token Contexts table - stores AI-generated token context (shortContext, category, tags)
 * Used by token-context-service to cache Tavily + Workers AI results
 * Requirement: dynamic-prompt spec
 */
const tokenContexts = sqliteTable(
  "token_contexts",
  {
    tokenId: text("token_id").primaryKey().notNull(), // CoinGecko token ID (e.g., "bitcoin")
    symbol: text("symbol").notNull(), // Token symbol (e.g., "BTC")
    displayName: text("display_name").notNull(), // Token display name (e.g., "Bitcoin")
    chain: text("chain").notNull(), // Chain ID (e.g., "solana", "ethereum")
    category: text("category"), // Single word category (e.g., "meme", "defi")
    tags: text("tags"), // JSON array string (e.g., '["meme", "viral"]')
    shortContext: text("short_context").notNull(), // 2-4 sentence English description (200-400 chars)
    updatedAt: integer("updated_at").notNull(), // Unix epoch seconds
  },
  table => [index("idx_token_contexts_symbol_chain").on(table.symbol, table.chain)],
);

type TokenContextRow = typeof tokenContexts.$inferSelect;

/**
 * Token context record with parsed tags
 */
export type TokenContextRecord = {
  tokenId: string;
  symbol: string;
  displayName: string;
  chain: string;
  category: string | null;
  tags: string[] | null;
  shortContext: string;
  updatedAt: number;
};

/**
 * Token context repository interface
 */
export interface TokenContextRepository {
  findById(tokenId: string): Promise<Result<TokenContextRecord | null, AppError>>;
}

type CreateTokenContextRepositoryDeps = {
  d1Binding?: D1Database;
  log?: typeof logger;
};

/**
 * Create token context repository
 *
 * @param deps - Dependencies including D1 binding
 * @returns Token context repository instance
 */
export function createTokenContextRepository({
  d1Binding,
  log = logger,
}: CreateTokenContextRepositoryDeps = {}): TokenContextRepository {
  // Parse tags from JSON string
  const parseTags = (tagsJson: string | null): string[] | null => {
    if (!tagsJson) {
      return null;
    }

    try {
      const parsed = JSON.parse(tagsJson);
      if (Array.isArray(parsed) && parsed.every(item => typeof item === "string")) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  };

  // Map database row to record
  const mapRowToRecord = (row: TokenContextRow): TokenContextRecord => {
    return {
      tokenId: row.tokenId,
      symbol: row.symbol,
      displayName: row.displayName,
      chain: row.chain,
      category: row.category,
      tags: parseTags(row.tags),
      shortContext: row.shortContext,
      updatedAt: row.updatedAt,
    };
  };

  async function findById(tokenId: string): Promise<Result<TokenContextRecord | null, AppError>> {
    try {
      const db = await getDB(d1Binding);

      log.debug("token-context-repo.find-by-id.start", {
        tokenId,
      });

      const result = await db.select().from(tokenContexts).where(eq(tokenContexts.tokenId, tokenId)).limit(1);

      if (result.length === 0) {
        log.debug("token-context-repo.find-by-id.not-found", {
          tokenId,
        });
        return ok(null);
      }

      const record = mapRowToRecord(result[0]);

      log.debug("token-context-repo.find-by-id.success", {
        tokenId,
        symbol: record.symbol,
        chain: record.chain,
      });

      return ok(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown D1 error";
      const stack = error instanceof Error ? error.stack : undefined;

      log.error("token-context-repo.find-by-id.error", {
        tokenId,
        errorType: "InternalError",
        message: `Failed to query token context: ${message}`,
        stack,
      });

      return err({
        type: "InternalError",
        message: `Failed to query token context: ${message}`,
        cause: error,
      });
    }
  }

  return {
    findById,
  };
}
