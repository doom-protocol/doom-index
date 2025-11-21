import { Result, err, ok } from "neverthrow";
import { eq } from "drizzle-orm";
import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";
import { getDB } from "@/db";
import { tokenContexts, type TokenContextRow } from "@/db/schema/token-contexts";

/**
 * Token context record with parsed tags
 */
export type TokenContextRecord = {
  id: string;
  name: string;
  symbol: string;
  chainId: string;
  contractAddress: string | null;
  category: string | null;
  tags: string[] | null;
  shortContext: string;
  createdAt: number;
  updatedAt: number;
};

/**
 * Token context repository interface
 */
export interface TokenContextRepository {
  findById(id: string): Promise<Result<TokenContextRecord | null, AppError>>;
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
      id: row.tokenId,
      name: row.name,
      symbol: row.symbol,
      chainId: row.chainId,
      contractAddress: row.contractAddress ?? null,
      category: row.category ?? null,
      tags: parseTags(row.tags ?? null),
      shortContext: row.shortContext,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  };

  async function findById(id: string): Promise<Result<TokenContextRecord | null, AppError>> {
    try {
      const db = await getDB(d1Binding);

      log.debug("token-context-repo.find-by-id.start", {
        tokenId: id,
      });

      const result = await db.select().from(tokenContexts).where(eq(tokenContexts.tokenId, id)).limit(1);

      if (result.length === 0) {
        log.debug("token-context-repo.find-by-id.not-found", {
          tokenId: id,
        });
        return ok(null);
      }

      const record = mapRowToRecord(result[0]);

      log.debug("token-context-repo.find-by-id.success", {
        tokenId: id,
        symbol: record.symbol,
        chainId: record.chainId,
      });

      return ok(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown D1 error";
      const stack = error instanceof Error ? error.stack : undefined;

      log.error("token-context-repo.find-by-id.error", {
        tokenId: id,
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
