import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { ok, err } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { createTokenContextService } from "@/services/token-context-service";
import type { TokenContextRepository, TokenContextRecord } from "@/repositories/token-context-repository";
import type { TavilyClient } from "@/lib/tavily-client";
import type { WorkersAiClient } from "@/lib/workers-ai-client";

describe("TokenContextService", () => {
  let mockRepository: TokenContextRepository;
  let mockTavilyClient: TavilyClient;
  let mockWorkersAiClient: WorkersAiClient;

  beforeEach(() => {
    mockRepository = {
      findById: mock(() => Promise.resolve(ok(null))) as unknown as TokenContextRepository["findById"],
    };

    mockTavilyClient = {
      searchToken: mock(() =>
        Promise.resolve(err({ type: "ExternalApiError", provider: "Tavily", message: "Not implemented" })),
      ) as unknown as TavilyClient["searchToken"],
    };

    mockWorkersAiClient = {
      generateText: mock(() =>
        Promise.resolve(err({ type: "ExternalApiError", provider: "WorkersAI", message: "Not implemented" })),
      ) as unknown as WorkersAiClient["generateText"],
      generateJson: mock(() =>
        Promise.resolve(err({ type: "ExternalApiError", provider: "WorkersAI", message: "Not implemented" })),
      ) as unknown as WorkersAiClient["generateJson"],
    };
  });

  afterEach(() => {
    mock.restore();
  });

  describe("generateTokenContext", () => {
    it("should return TokenContext from D1 when record exists", async () => {
      const mockRecord: TokenContextRecord = {
        tokenId: "test-token",
        symbol: "TEST",
        displayName: "Test Token",
        chain: "ethereum",
        category: "meme",
        tags: ["test", "token"],
        shortContext: "A test token for testing purposes.",
        updatedAt: 1000000,
      };

      mockRepository.findById = mock(() => Promise.resolve(ok(mockRecord)));

      const service = createTokenContextService({
        repository: mockRepository,
        tavilyClient: mockTavilyClient,
        workersAiClient: mockWorkersAiClient,
      });

      const result = await service.generateTokenContext({
        id: "test-token",
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: "0x123",
        createdAt: "2024-01-01T00:00:00Z",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual({
          shortContext: "A test token for testing purposes.",
          category: "meme",
          tags: ["test", "token"],
        });
      }

      // Should not call Tavily when D1 hit
      expect(mockTavilyClient.searchToken).not.toHaveBeenCalled();
    });

    it("should return error when D1 query fails", async () => {
      const d1Error: AppError = {
        type: "InternalError",
        message: "D1 query failed",
      };

      mockRepository.findById = mock(() => Promise.resolve(err(d1Error)));

      const service = createTokenContextService({
        repository: mockRepository,
        tavilyClient: mockTavilyClient,
        workersAiClient: mockWorkersAiClient,
      });

      const result = await service.generateTokenContext({
        id: "test-token",
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: null,
        createdAt: "2024-01-01T00:00:00Z",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("InternalError");
      }
    });

    it("should handle null category and tags from D1", async () => {
      const mockRecord: TokenContextRecord = {
        tokenId: "test-token",
        symbol: "TEST",
        displayName: "Test Token",
        chain: "ethereum",
        category: null,
        tags: null,
        shortContext: "A test token.",
        updatedAt: 1000000,
      };

      mockRepository.findById = mock(() => Promise.resolve(ok(mockRecord)));

      const service = createTokenContextService({
        repository: mockRepository,
        tavilyClient: mockTavilyClient,
        workersAiClient: mockWorkersAiClient,
      });

      const result = await service.generateTokenContext({
        id: "test-token",
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: null,
        createdAt: "2024-01-01T00:00:00Z",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.category).toBe("");
        expect(result.value.tags).toEqual([]);
      }
    });

    it("should generate TokenContext from Tavily + Workers AI when D1 miss", async () => {
      mockRepository.findById = mock(() => Promise.resolve(ok(null)));

      mockTavilyClient.searchToken = mock(() =>
        Promise.resolve(
          ok({
            articles: [
              {
                title: "Test Token Article",
                content: "This is a test token for testing purposes.",
                url: "https://example.com/test",
              },
            ],
            combinedText: "Test Token Article\nThis is a test token for testing purposes.\nhttps://example.com/test",
          }),
        ),
      );

      const mockAiResponse = {
        short_context: "A test token designed for testing blockchain applications.",
        category: "test",
        tags: ["testing", "blockchain"],
      };

      mockWorkersAiClient.generateJson = mock(() =>
        Promise.resolve(
          ok({
            modelId: "@cf/meta/llama-3.1-8b-instruct",
            value: mockAiResponse,
          }),
        ),
      ) as unknown as WorkersAiClient["generateJson"];

      const service = createTokenContextService({
        repository: mockRepository,
        tavilyClient: mockTavilyClient,
        workersAiClient: mockWorkersAiClient,
      });

      const result = await service.generateTokenContext({
        id: "new-token",
        name: "New Token",
        symbol: "NEW",
        chainId: "ethereum",
        contractAddress: null,
        createdAt: "2024-01-01T00:00:00Z",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual({
          shortContext: "A test token designed for testing blockchain applications.",
          category: "test",
          tags: ["testing", "blockchain"],
        });
      }

      expect(mockTavilyClient.searchToken).toHaveBeenCalledWith({
        id: "new-token",
        name: "New Token",
        symbol: "NEW",
        chainId: "ethereum",
        contractAddress: null,
      });

      expect(mockWorkersAiClient.generateJson).toHaveBeenCalled();
    });

    it("should return error when Tavily fails", async () => {
      mockRepository.findById = mock(() => Promise.resolve(ok(null)));

      const tavilyError: AppError = {
        type: "ExternalApiError",
        provider: "Tavily",
        message: "Tavily API error",
      };

      mockTavilyClient.searchToken = mock(() => Promise.resolve(err(tavilyError)));

      const service = createTokenContextService({
        repository: mockRepository,
        tavilyClient: mockTavilyClient,
        workersAiClient: mockWorkersAiClient,
      });

      const result = await service.generateTokenContext({
        id: "new-token",
        name: "New Token",
        symbol: "NEW",
        chainId: "ethereum",
        contractAddress: null,
        createdAt: "2024-01-01T00:00:00Z",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ExternalApiError");
        if (result.error.type === "ExternalApiError") {
          expect(result.error.provider).toBe("Tavily");
        }
      }

      expect(mockWorkersAiClient.generateJson).not.toHaveBeenCalled();
    });

    it("should return error when Workers AI fails", async () => {
      mockRepository.findById = mock(() => Promise.resolve(ok(null)));

      mockTavilyClient.searchToken = mock(() =>
        Promise.resolve(
          ok({
            articles: [
              {
                title: "Test Token Article",
                content: "This is a test token.",
                url: "https://example.com/test",
              },
            ],
            combinedText: "Test Token Article\nThis is a test token.\nhttps://example.com/test",
          }),
        ),
      );

      const aiError: AppError = {
        type: "ExternalApiError",
        provider: "WorkersAI",
        message: "Workers AI error",
      };

      mockWorkersAiClient.generateJson = mock(() => Promise.resolve(err(aiError)));

      const service = createTokenContextService({
        repository: mockRepository,
        tavilyClient: mockTavilyClient,
        workersAiClient: mockWorkersAiClient,
      });

      const result = await service.generateTokenContext({
        id: "new-token",
        name: "New Token",
        symbol: "NEW",
        chainId: "ethereum",
        contractAddress: null,
        createdAt: "2024-01-01T00:00:00Z",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ExternalApiError");
        if (result.error.type === "ExternalApiError") {
          expect(result.error.provider).toBe("WorkersAI");
        }
      }
    });

    it("should validate shortContext length and return error if too short", async () => {
      mockRepository.findById = mock(() => Promise.resolve(ok(null)));

      mockTavilyClient.searchToken = mock(() =>
        Promise.resolve(
          ok({
            articles: [
              {
                title: "Test Token Article",
                content: "This is a test token.",
                url: "https://example.com/test",
              },
            ],
            combinedText: "Test Token Article\nThis is a test token.\nhttps://example.com/test",
          }),
        ),
      );

      // AI returns too short context (< 50 chars)
      const mockAiResponse = {
        short_context: "Short.",
        category: "test",
        tags: ["testing"],
      };

      mockWorkersAiClient.generateJson = mock(() =>
        Promise.resolve(
          ok({
            modelId: "@cf/meta/llama-3.1-8b-instruct",
            value: mockAiResponse,
          }),
        ),
      ) as unknown as WorkersAiClient["generateJson"];

      const service = createTokenContextService({
        repository: mockRepository,
        tavilyClient: mockTavilyClient,
        workersAiClient: mockWorkersAiClient,
      });

      const result = await service.generateTokenContext({
        id: "new-token",
        name: "New Token",
        symbol: "NEW",
        chainId: "ethereum",
        contractAddress: null,
        createdAt: "2024-01-01T00:00:00Z",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ValidationError");
      }
    });

    it("should validate shortContext length and return error if too long", async () => {
      mockRepository.findById = mock(() => Promise.resolve(ok(null)));

      mockTavilyClient.searchToken = mock(() =>
        Promise.resolve(
          ok({
            articles: [
              {
                title: "Test Token Article",
                content: "This is a test token.",
                url: "https://example.com/test",
              },
            ],
            combinedText: "Test Token Article\nThis is a test token.\nhttps://example.com/test",
          }),
        ),
      );

      // AI returns too long context (> 500 chars)
      const longContext = "A".repeat(501);
      const mockAiResponse = {
        short_context: longContext,
        category: "test",
        tags: ["testing"],
      };

      mockWorkersAiClient.generateJson = mock(() =>
        Promise.resolve(
          ok({
            modelId: "@cf/meta/llama-3.1-8b-instruct",
            value: mockAiResponse,
          }),
        ),
      ) as unknown as WorkersAiClient["generateJson"];

      const service = createTokenContextService({
        repository: mockRepository,
        tavilyClient: mockTavilyClient,
        workersAiClient: mockWorkersAiClient,
      });

      const result = await service.generateTokenContext({
        id: "new-token",
        name: "New Token",
        symbol: "NEW",
        chainId: "ethereum",
        contractAddress: null,
        createdAt: "2024-01-01T00:00:00Z",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ValidationError");
      }
    });

    it("should accept valid shortContext length", async () => {
      mockRepository.findById = mock(() => Promise.resolve(ok(null)));

      mockTavilyClient.searchToken = mock(() =>
        Promise.resolve(
          ok({
            articles: [
              {
                title: "Test Token Article",
                content: "This is a test token.",
                url: "https://example.com/test",
              },
            ],
            combinedText: "Test Token Article\nThis is a test token.\nhttps://example.com/test",
          }),
        ),
      );

      // AI returns valid length context (50-500 chars)
      const mockAiResponse = {
        short_context:
          "A test token designed for testing blockchain applications. It provides a simple way to test various features.",
        category: "test",
        tags: ["testing", "blockchain"],
      };

      mockWorkersAiClient.generateJson = mock(() =>
        Promise.resolve(
          ok({
            modelId: "@cf/meta/llama-3.1-8b-instruct",
            value: mockAiResponse,
          }),
        ),
      ) as unknown as WorkersAiClient["generateJson"];

      const service = createTokenContextService({
        repository: mockRepository,
        tavilyClient: mockTavilyClient,
        workersAiClient: mockWorkersAiClient,
      });

      const result = await service.generateTokenContext({
        id: "new-token",
        name: "New Token",
        symbol: "NEW",
        chainId: "ethereum",
        contractAddress: null,
        createdAt: "2024-01-01T00:00:00Z",
      });

      expect(result.isOk()).toBe(true);
    });
  });
});
