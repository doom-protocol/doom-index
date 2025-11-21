import { describe, expect, it, beforeEach, mock } from "bun:test";
import { createTokenContextRepository } from "@/repositories/token-context-repository";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

// TokenContextRow type definition (moved from token-contexts.ts)
type TokenContextRow = {
  tokenId: string;
  symbol: string;
  displayName: string;
  chain: string;
  category: string | null;
  tags: string | null;
  shortContext: string;
  updatedAt: number;
};

// TODO: Fix complex Drizzle ORM mock types
describe.skip("TokenContextRepository", () => {
  let mockDb: DrizzleD1Database<typeof schema>;
  let mockGetDB: ReturnType<typeof mock>;

  beforeEach(() => {
    mock.restore();

    // Mock database with test data matching TokenContextRow schema
    const testData: TokenContextRow[] = [
      {
        tokenId: "test-token-1",
        symbol: "TEST1",
        displayName: "Test Token 1",
        chain: "ethereum",
        category: "meme",
        tags: '["tag1","tag2"]',
        shortContext: "This is a test context",
        updatedAt: Math.floor(Date.now() / 1000),
      },
      {
        tokenId: "test-token-2",
        symbol: "TEST2",
        displayName: "Test Token 2",
        chain: "solana",
        category: null,
        tags: null,
        shortContext: "Another test context",
        updatedAt: Math.floor(Date.now() / 1000),
      },
    ];

    mockDb = {
      select: mock(() => ({
        from: mock(() => ({
          where: mock(() => ({
            limit: mock(() => testData.slice(0, 1)), // Simplified mock
          })),
        })),
      })),
    } as unknown as DrizzleD1Database<typeof schema>;

    mockGetDB = mock(() => Promise.resolve(mockDb));

    mock.module("@/db", () => ({
      getDB: mockGetDB,
    }));
  });

  describe("findById", () => {
    it("should find token context by id", async () => {
      // Mock Drizzle query chain
      const mockSelect = mock(() => ({
        from: mock(() => ({
          where: mock(() => ({
            limit: mock(() => [
              {
                tokenId: "test-token-1",
                symbol: "TEST1",
                displayName: "Test Token 1",
                chain: "ethereum",
                category: "meme",
                tags: '["tag1","tag2"]',
                shortContext: "This is a test context",
                updatedAt: Math.floor(Date.now() / 1000),
              },
            ]),
          })),
        })),
      }));

      // @ts-expect-error - Complex Drizzle ORM mock types don't match exactly but work at runtime
      mockDb.select = mockSelect;
      const repo = createTokenContextRepository();
      const result = await repo.findById("test-token-1");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).not.toBeNull();
        expect(result.value?.tokenId).toBe("test-token-1");
        expect(result.value?.displayName).toBe("Test Token 1");
        expect(result.value?.symbol).toBe("TEST1");
        expect(result.value?.chain).toBe("ethereum");
        expect(result.value?.category).toBe("meme");
        expect(result.value?.tags).toEqual(["tag1", "tag2"]);
        expect(result.value?.shortContext).toBe("This is a test context");
      }
    });

    it("should return null when token not found", async () => {
      const mockSelect = mock(() => ({
        from: mock(() => ({
          where: mock(() => ({
            limit: mock(() => []),
          })),
        })),
      }));

      // @ts-expect-error - Complex Drizzle ORM mock types don't match exactly but work at runtime
      mockDb.select = mockSelect;
      const repo = createTokenContextRepository();
      const result = await repo.findById("non-existent");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBeNull();
      }
    });

    it("should handle null contract address", async () => {
      const mockSelect = mock(() => ({
        from: mock(() => ({
          where: mock(() => ({
            limit: mock(() => [
              {
                tokenId: "test-token-2",
                tokenName: "Test Token 2",
                tokenSymbol: "TEST2",
                tokenChain: "solana",
                contractAddress: null,
                category: null,
                tags: null,
                shortContext: "Another test context",
                createdAt: Math.floor(Date.now() / 1000),
                updatedAt: Math.floor(Date.now() / 1000),
              },
            ]),
          })),
        })),
      }));

      // @ts-expect-error - Complex Drizzle ORM mock types don't match exactly but work at runtime
      mockDb.select = mockSelect;
      const repo = createTokenContextRepository();
      const result = await repo.findById("test-token-2");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).not.toBeNull();
        expect(result.value?.category).toBeNull();
      }
    });

    it("should handle null category and tags", async () => {
      const mockSelect = mock(() => ({
        from: mock(() => ({
          where: mock(() => ({
            limit: mock(() => [
              {
                tokenId: "test-token-2",
                tokenName: "Test Token 2",
                tokenSymbol: "TEST2",
                tokenChain: "solana",
                contractAddress: null,
                category: null,
                tags: null,
                shortContext: "Another test context",
                createdAt: Math.floor(Date.now() / 1000),
                updatedAt: Math.floor(Date.now() / 1000),
              },
            ]),
          })),
        })),
      }));

      // @ts-expect-error - Complex Drizzle ORM mock types don't match exactly but work at runtime
      mockDb.select = mockSelect;
      const repo = createTokenContextRepository();
      const result = await repo.findById("test-token-2");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).not.toBeNull();
        expect(result.value?.category).toBeNull();
        expect(result.value?.tags).toBeNull();
      }
    });

    it("should parse tags JSON correctly", async () => {
      const mockSelect = mock(() => ({
        from: mock(() => ({
          where: mock(() => ({
            limit: mock(() => [
              {
                tokenId: "test-token-1",
                symbol: "TEST1",
                displayName: "Test Token 1",
                chain: "ethereum",
                category: "meme",
                tags: '["tag1","tag2"]',
                shortContext: "This is a test context",
                updatedAt: Math.floor(Date.now() / 1000),
              },
            ]),
          })),
        })),
      }));

      // @ts-expect-error - Complex Drizzle ORM mock types don't match exactly but work at runtime
      mockDb.select = mockSelect;
      const repo = createTokenContextRepository();
      const result = await repo.findById("test-token-1");

      expect(result.isOk()).toBe(true);
      if (result.isOk() && result.value) {
        expect(result.value.tags).toEqual(["tag1", "tag2"]);
      }
    });

    it("should handle invalid tags JSON gracefully", async () => {
      const mockSelect = mock(() => ({
        from: mock(() => ({
          where: mock(() => ({
            limit: mock(() => [
              {
                tokenId: "test-token-3",
                symbol: "TEST3",
                displayName: "Test Token 3",
                chain: "ethereum",
                category: null,
                tags: "invalid json",
                shortContext: "Test context",
                updatedAt: Math.floor(Date.now() / 1000),
              },
            ]),
          })),
        })),
      }));

      // @ts-expect-error - Complex Drizzle ORM mock types don't match exactly but work at runtime
      mockDb.select = mockSelect;
      const repo = createTokenContextRepository();
      const result = await repo.findById("test-token-3");

      expect(result.isOk()).toBe(true);
      if (result.isOk() && result.value) {
        // Should return null for tags when JSON is invalid
        expect(result.value.tags).toBeNull();
      }
    });

    it("should return InternalError when D1 query fails", async () => {
      mockGetDB.mockImplementation(() => Promise.reject(new Error("D1 connection error")));

      const repo = createTokenContextRepository();
      const result = await repo.findById("test-token-1");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("InternalError");
      }
    });
  });
});
