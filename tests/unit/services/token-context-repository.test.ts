import { describe, expect, it, beforeEach, mock } from "bun:test";
import { createTokenContextRepository } from "@/repositories/token-context-repository";
import type { TokenContextRow } from "@/db/schema/token-contexts";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

// TODO: Fix complex Drizzle ORM mock types
describe.skip("TokenContextRepository", () => {
  let mockDb: DrizzleD1Database<typeof schema>;
  let mockGetDB: ReturnType<typeof mock>;

  beforeEach(() => {
    mock.restore();

    // Mock database with test data
    const testData: TokenContextRow[] = [
      {
        tokenId: "test-token-1",
        name: "Test Token 1",
        symbol: "TEST1",
        chainId: "ethereum",
        contractAddress: "0x123",
        category: "meme",
        tags: '["tag1","tag2"]',
        shortContext: "This is a test context",
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      },
      {
        tokenId: "test-token-2",
        name: "Test Token 2",
        symbol: "TEST2",
        chainId: "solana",
        contractAddress: null,
        category: null,
        tags: null,
        shortContext: "Another test context",
        createdAt: Math.floor(Date.now() / 1000),
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
    };

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
                name: "Test Token 1",
                symbol: "TEST1",
                chainId: "ethereum",
                contractAddress: "0x123",
                category: "meme",
                tags: '["tag1","tag2"]',
                shortContext: "This is a test context",
                createdAt: Math.floor(Date.now() / 1000),
                updatedAt: Math.floor(Date.now() / 1000),
              },
            ]),
          })),
        })),
      }));

      mockDb.select = mockSelect;
      const repo = createTokenContextRepository();
      const result = await repo.findById("test-token-1");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).not.toBeNull();
        expect(result.value?.id).toBe("test-token-1");
        expect(result.value?.name).toBe("Test Token 1");
        expect(result.value?.symbol).toBe("TEST1");
        expect(result.value?.chainId).toBe("ethereum");
        expect(result.value?.contractAddress).toBe("0x123");
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
                name: "Test Token 2",
                symbol: "TEST2",
                chainId: "solana",
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

      mockDb.select = mockSelect;
      const repo = createTokenContextRepository();
      const result = await repo.findById("test-token-2");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).not.toBeNull();
        expect(result.value?.contractAddress).toBeNull();
      }
    });

    it("should handle null category and tags", async () => {
      const mockSelect = mock(() => ({
        from: mock(() => ({
          where: mock(() => ({
            limit: mock(() => [
              {
                tokenId: "test-token-2",
                name: "Test Token 2",
                symbol: "TEST2",
                chainId: "solana",
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
                name: "Test Token 1",
                symbol: "TEST1",
                chainId: "ethereum",
                contractAddress: "0x123",
                category: "meme",
                tags: '["tag1","tag2"]',
                shortContext: "This is a test context",
                createdAt: Math.floor(Date.now() / 1000),
                updatedAt: Math.floor(Date.now() / 1000),
              },
            ]),
          })),
        })),
      }));

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
                name: "Test Token 3",
                symbol: "TEST3",
                chainId: "ethereum",
                contractAddress: null,
                category: null,
                tags: "invalid json",
                shortContext: "Test context",
                createdAt: Math.floor(Date.now() / 1000),
                updatedAt: Math.floor(Date.now() / 1000),
              },
            ]),
          })),
        })),
      }));

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
