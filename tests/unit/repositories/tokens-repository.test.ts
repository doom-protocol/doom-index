import * as dbSchema from "@/db/schema";
import { tokens } from "@/db/schema/tokens";
import { TokensRepository } from "@/repositories/tokens-repository";
import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";

describe("TokensRepository", () => {
  let db: ReturnType<typeof drizzle>;
  let repository: TokensRepository;

  beforeEach(() => {
    // Create in-memory SQLite database
    const sqlite = new Database(":memory:");

    // Create tokens table
    sqlite.exec(`
      CREATE TABLE tokens (
        id TEXT PRIMARY KEY NOT NULL,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        coingecko_id TEXT NOT NULL,
        logo_url TEXT,
        short_context TEXT,
        categories TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_tokens_symbol ON tokens(symbol);
      CREATE INDEX idx_tokens_coingecko_id ON tokens(coingecko_id);
    `);

    db = drizzle(sqlite, { schema: dbSchema });

    repository = new TokensRepository(db as any);
  });

  describe("findById", () => {
    it("should return null when token does not exist", async () => {
      const result = await repository.findById("non-existent");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBeNull();
      }
    });

    it("should return token when it exists", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = {
        id: "bitcoin",
        symbol: "BTC",
        name: "Bitcoin",
        coingeckoId: "bitcoin",
        logoUrl: "https://example.com/bitcoin.png",
        categories: JSON.stringify(["l1", "store-of-value"]),
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(tokens).values(token);

      const result = await repository.findById("bitcoin");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).not.toBeNull();
        expect(result.value?.id).toBe("bitcoin");
        expect(result.value?.symbol).toBe("BTC");
      }
    });
  });

  describe("insert", () => {
    it("should insert new token", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = {
        id: "bitcoin",
        symbol: "BTC",
        name: "Bitcoin",
        coingeckoId: "bitcoin",
        logoUrl: "https://example.com/bitcoin.png",
        categories: JSON.stringify(["l1", "store-of-value"]),
        createdAt: now,
        updatedAt: now,
      };

      const result = await repository.insert(token);

      expect(result.isOk()).toBe(true);

      // Verify token was inserted
      const findResult = await repository.findById("bitcoin");
      expect(findResult.isOk()).toBe(true);
      if (findResult.isOk()) {
        expect(findResult.value?.id).toBe("bitcoin");
      }
    });

    it("should update existing token on conflict", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = {
        id: "bitcoin",
        symbol: "BTC",
        name: "Bitcoin",
        coingeckoId: "bitcoin",
        logoUrl: "https://example.com/bitcoin.png",
        categories: JSON.stringify(["l1", "store-of-value"]),
        createdAt: now,
        updatedAt: now,
      };

      // Insert first time
      await repository.insert(token);

      // Insert again with updated data
      const updatedToken = {
        ...token,
        name: "Bitcoin Updated",
        updatedAt: now + 1000,
      };
      const result = await repository.insert(updatedToken);

      expect(result.isOk()).toBe(true);

      // Verify token was updated
      const findResult = await repository.findById("bitcoin");
      expect(findResult.isOk()).toBe(true);
      if (findResult.isOk()) {
        expect(findResult.value?.name).toBe("Bitcoin Updated");
        expect(findResult.value?.updatedAt).toBe(now + 1000);
      }
    });
  });

  describe("update", () => {
    it("should update token fields", async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = {
        id: "bitcoin",
        symbol: "BTC",
        name: "Bitcoin",
        coingeckoId: "bitcoin",
        logoUrl: "https://example.com/bitcoin.png",
        categories: JSON.stringify(["l1", "store-of-value"]),
        createdAt: now,
        updatedAt: now,
      };

      await repository.insert(token);

      const result = await repository.update("bitcoin", {
        name: "Bitcoin Updated",
        updatedAt: now + 1000,
      });

      expect(result.isOk()).toBe(true);

      // Verify update
      const findResult = await repository.findById("bitcoin");
      expect(findResult.isOk()).toBe(true);
      if (findResult.isOk()) {
        expect(findResult.value?.name).toBe("Bitcoin Updated");
        expect(findResult.value?.updatedAt).toBe(now + 1000);
      }
    });
  });

  describe("findRecentlySelected", () => {
    it("should return tokens updated within window", async () => {
      const now = Math.floor(Date.now() / 1000);
      const oldTimestamp = now - 25 * 60 * 60; // 25 hours ago
      const recentTimestamp = now - 1 * 60 * 60; // 1 hour ago

      // Insert old token
      await repository.insert({
        id: "bitcoin",
        symbol: "BTC",
        name: "Bitcoin",
        coingeckoId: "bitcoin",
        logoUrl: null,
        categories: JSON.stringify(["l1"]),
        createdAt: oldTimestamp,
        updatedAt: oldTimestamp,
      });

      // Insert recent token
      await repository.insert({
        id: "ethereum",
        symbol: "ETH",
        name: "Ethereum",
        coingeckoId: "ethereum",
        logoUrl: null,
        categories: JSON.stringify(["l1"]),
        createdAt: recentTimestamp,
        updatedAt: recentTimestamp,
      });

      const result = await repository.findRecentlySelected(24);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.length).toBe(1);
        expect(result.value[0].id).toBe("ethereum");
      }
    });

    it("should return empty array when no recent tokens", async () => {
      const result = await repository.findRecentlySelected(24);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.length).toBe(0);
      }
    });
  });
});
