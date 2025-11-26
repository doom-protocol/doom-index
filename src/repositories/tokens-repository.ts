import type * as schema from "@/db/schema";
import { tokens, type NewToken, type Token } from "@/db/schema/tokens";
import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";
import { desc, eq, gte } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { err, ok, type Result } from "neverthrow";

/**
 * Tokens Repository
 * Handles CRUD operations for token metadata
 * Requirements: 4, 9, 1D
 */
type TokensDb =
  | DrizzleD1Database<typeof schema>
  | BetterSQLite3Database<typeof schema>
  | BunSQLiteDatabase<typeof schema>;

export class TokensRepository {
  constructor(private readonly db: TokensDb) {}

  /**
   * Find token by CoinGecko ID (Requirement 4)
   */
  async findById(id: string): Promise<Result<Token | null, AppError>> {
    try {
      logger.debug(`[TokensRepository] Finding token by ID: ${id}`);

      const result = await this.db.select().from(tokens).where(eq(tokens.id, id)).limit(1);

      if (result.length === 0) {
        logger.debug(`[TokensRepository] Token not found: ${id}`);
        return ok(null);
      }

      logger.debug(`[TokensRepository] Found token: ${id}`);
      return ok(result[0]);
    } catch (error) {
      logger.error(`[TokensRepository] Failed to find token: ${id}`, { error });
      return err({
        type: "StorageError" as const,
        op: "get" as const,
        key: `tokens/${id}`,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Insert new token (Requirement 9)
   */
  async insert(token: NewToken): Promise<Result<void, AppError>> {
    try {
      logger.debug(`[TokensRepository] Inserting token: ${token.id}`);

      await this.db
        .insert(tokens)
        .values(token)
        .onConflictDoUpdate({
          target: tokens.id,
          set: {
            symbol: token.symbol,
            name: token.name,
            logoUrl: token.logoUrl,
            shortContext: token.shortContext,
            categories: token.categories,
            updatedAt: token.updatedAt,
          },
        });

      logger.info(`[TokensRepository] Inserted token: ${token.id}`);
      return ok(undefined);
    } catch (error) {
      logger.error(`[TokensRepository] Failed to insert token: ${token.id}`, { error });
      return err({
        type: "StorageError" as const,
        op: "put" as const,
        key: `tokens/${token.id}`,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Update token metadata (Requirement 9)
   */
  async update(id: string, updates: Partial<NewToken>): Promise<Result<void, AppError>> {
    try {
      logger.debug(`[TokensRepository] Updating token: ${id}`);

      await this.db.update(tokens).set(updates).where(eq(tokens.id, id));

      logger.info(`[TokensRepository] Updated token: ${id}`);
      return ok(undefined);
    } catch (error) {
      logger.error(`[TokensRepository] Failed to update token: ${id}`, { error });
      return err({
        type: "StorageError" as const,
        op: "put" as const,
        key: `tokens/${id}`,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Update token shortContext
   */
  async updateShortContext(id: string, shortContext: string): Promise<Result<void, AppError>> {
    try {
      logger.debug(`[TokensRepository] Updating shortContext for token: ${id}`);

      await this.db
        .update(tokens)
        .set({ shortContext, updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(tokens.id, id));

      logger.info(`[TokensRepository] Updated shortContext for token: ${id}`);
      return ok(undefined);
    } catch (error) {
      logger.error(`[TokensRepository] Failed to update shortContext for token: ${id}`, { error });
      return err({
        type: "StorageError" as const,
        op: "put" as const,
        key: `tokens/${id}/shortContext`,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Find recently selected tokens (Requirement 1D)
   * Returns tokens that were updated within the specified window
   */
  async findRecentlySelected(windowHours: number): Promise<Result<Token[], AppError>> {
    try {
      const windowMs = windowHours * 60 * 60 * 1000;
      const cutoffTimestamp = Math.floor((Date.now() - windowMs) / 1000);

      logger.debug(`[TokensRepository] Finding tokens updated after ${new Date(cutoffTimestamp * 1000).toISOString()}`);

      const result = await this.db
        .select()
        .from(tokens)
        .where(gte(tokens.updatedAt, cutoffTimestamp))
        .orderBy(desc(tokens.updatedAt));

      logger.debug(`[TokensRepository] Found ${result.length} recently selected tokens`);
      return ok(result);
    } catch (error) {
      logger.error(`[TokensRepository] Failed to find recently selected tokens`, { error });
      return err({
        type: "StorageError" as const,
        op: "list" as const,
        key: "tokens",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
