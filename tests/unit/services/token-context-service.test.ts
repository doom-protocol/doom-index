import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { ok, err } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { createTokenContextService, FALLBACK_SHORT_CONTEXT } from "@/services/token-context-service";
import type { TavilyClient } from "@/lib/tavily-client";
import type { WorkersAiClient } from "@/lib/workers-ai-client";
import type { TokensRepository } from "@/repositories/tokens-repository";

describe("TokenContextService", () => {
  let mockTokensRepository: TokensRepository;
  let mockTavilyClient: TavilyClient;
  let mockWorkersAiClient: WorkersAiClient;

  beforeEach(() => {
    mockTokensRepository = {
      db: {} as unknown as TokensRepository["db"],
      findById: mock(() => Promise.resolve(ok(null))) as unknown as TokensRepository["findById"],
      insert: mock(() => Promise.resolve(ok(undefined))) as unknown as TokensRepository["insert"],
      update: mock(() => Promise.resolve(ok(undefined))) as unknown as TokensRepository["update"],
      updateShortContext: mock(() =>
        Promise.resolve(ok(undefined)),
      ) as unknown as TokensRepository["updateShortContext"],
      findRecentlySelected: mock(() => Promise.resolve(ok([]))) as unknown as TokensRepository["findRecentlySelected"],
    } as unknown as TokensRepository;

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

  describe("generateAndSaveShortContext", () => {
    it("should generate and save shortContext using Tavily and Workers AI", async () => {
      // Mock Tavily response
      const mockTavilyResponse = {
        articles: [{ title: "Test Token Article", url: "https://example.com", content: "Test content" }],
        combinedText: "Test Token Article\nTest content",
      };

      mockTavilyClient.searchToken = mock(() =>
        Promise.resolve(ok(mockTavilyResponse)),
      ) as unknown as TavilyClient["searchToken"];

      // Mock Workers AI response
      const mockAiResponse = {
        value: {
          short_context:
            "A test token for testing purposes. This token is designed to test various blockchain features and functionality.",
        },
        modelId: "test-model",
      };

      mockWorkersAiClient.generateJson = mock(() =>
        Promise.resolve(ok(mockAiResponse)),
      ) as unknown as WorkersAiClient["generateJson"];

      const service = createTokenContextService({
        tavilyClient: mockTavilyClient,
        workersAiClient: mockWorkersAiClient,
        tokensRepository: mockTokensRepository,
      });

      const result = await service.generateAndSaveShortContext({
        id: "test-token",
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: "0x123",
        createdAt: "2024-01-01T00:00:00Z",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(mockAiResponse.value.short_context);
      }

      // Should call Tavily and Workers AI
      expect(mockTavilyClient.searchToken).toHaveBeenCalled();
      expect(mockWorkersAiClient.generateJson).toHaveBeenCalled();
      // Should save shortContext to tokens table
      expect(mockTokensRepository.updateShortContext).toHaveBeenCalledWith(
        "test-token",
        "A test token for testing purposes. This token is designed to test various blockchain features and functionality.",
      );
    });

    it("should return error when Tavily API fails", async () => {
      const tavilyError: AppError = {
        type: "ExternalApiError",
        provider: "Tavily",
        message: "Tavily API failed",
      };

      mockTavilyClient.searchToken = mock(() =>
        Promise.resolve(err(tavilyError)),
      ) as unknown as TavilyClient["searchToken"];

      const service = createTokenContextService({
        tavilyClient: mockTavilyClient,
        workersAiClient: mockWorkersAiClient,
        tokensRepository: mockTokensRepository,
      });

      const result = await service.generateAndSaveShortContext({
        id: "test-token",
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: null,
        createdAt: "2024-01-01T00:00:00Z",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ExternalApiError");
      }
    });

    it("should generate shortContext from Tavily + Workers AI", async () => {
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
      ) as unknown as TavilyClient["searchToken"];

      const mockAiResponse = {
        short_context: "A test token designed for testing blockchain applications.",
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
        tavilyClient: mockTavilyClient,
        workersAiClient: mockWorkersAiClient,
        tokensRepository: mockTokensRepository,
      });

      const result = await service.generateAndSaveShortContext({
        id: "new-token",
        name: "New Token",
        symbol: "NEW",
        chainId: "ethereum",
        contractAddress: null,
        createdAt: "2024-01-01T00:00:00Z",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(mockAiResponse.short_context);
      }

      expect(mockTavilyClient.searchToken).toHaveBeenCalledWith({
        id: "new-token",
        name: "New Token",
        symbol: "NEW",
        chainId: "ethereum",
        contractAddress: null,
      });

      expect(mockWorkersAiClient.generateJson).toHaveBeenCalled();
      expect(mockTokensRepository.updateShortContext).toHaveBeenCalledWith(
        "new-token",
        "A test token designed for testing blockchain applications.",
      );
    });

    it("should return error when Tavily fails", async () => {
      const tavilyError: AppError = {
        type: "ExternalApiError",
        provider: "Tavily",
        message: "Tavily API error",
      };

      mockTavilyClient.searchToken = mock(() =>
        Promise.resolve(err(tavilyError)),
      ) as unknown as TavilyClient["searchToken"];

      const service = createTokenContextService({
        tavilyClient: mockTavilyClient,
        workersAiClient: mockWorkersAiClient,
        tokensRepository: mockTokensRepository,
      });

      const result = await service.generateAndSaveShortContext({
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
      ) as unknown as TavilyClient["searchToken"];

      const aiError: AppError = {
        type: "ExternalApiError",
        provider: "WorkersAI",
        message: "Workers AI error",
      };

      mockWorkersAiClient.generateJson = mock(() =>
        Promise.resolve(err(aiError)),
      ) as unknown as WorkersAiClient["generateJson"];

      const service = createTokenContextService({
        tavilyClient: mockTavilyClient,
        workersAiClient: mockWorkersAiClient,
        tokensRepository: mockTokensRepository,
      });

      const result = await service.generateAndSaveShortContext({
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

    it("should use FALLBACK_SHORT_CONTEXT if generated context is too short", async () => {
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
      ) as unknown as TavilyClient["searchToken"];

      // AI returns too short context (< 50 chars)
      const mockAiResponse = {
        short_context: "Short.",
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
        tavilyClient: mockTavilyClient,
        workersAiClient: mockWorkersAiClient,
        tokensRepository: mockTokensRepository,
      });

      const result = await service.generateAndSaveShortContext({
        id: "new-token",
        name: "New Token",
        symbol: "NEW",
        chainId: "ethereum",
        contractAddress: null,
        createdAt: "2024-01-01T00:00:00Z",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(FALLBACK_SHORT_CONTEXT);
      }
    });

    it("should use FALLBACK_SHORT_CONTEXT if generated context is too long", async () => {
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
      ) as unknown as TavilyClient["searchToken"];

      // AI returns too long context (> 1000 chars)
      const longContext = "A".repeat(1001);
      const mockAiResponse = {
        short_context: longContext,
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
        tavilyClient: mockTavilyClient,
        workersAiClient: mockWorkersAiClient,
        tokensRepository: mockTokensRepository,
      });

      const result = await service.generateAndSaveShortContext({
        id: "new-token",
        name: "New Token",
        symbol: "NEW",
        chainId: "ethereum",
        contractAddress: null,
        createdAt: "2024-01-01T00:00:00Z",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(FALLBACK_SHORT_CONTEXT);
      }
    });

    it("should accept valid shortContext length", async () => {
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
      ) as unknown as TavilyClient["searchToken"];

      // AI returns valid length context (50-500 chars)
      const mockAiResponse = {
        short_context:
          "A test token designed for testing blockchain applications. It provides a simple way to test various features.",
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
        tavilyClient: mockTavilyClient,
        workersAiClient: mockWorkersAiClient,
        tokensRepository: mockTokensRepository,
      });

      const result = await service.generateAndSaveShortContext({
        id: "new-token",
        name: "New Token",
        symbol: "NEW",
        chainId: "ethereum",
        contractAddress: null,
        createdAt: "2024-01-01T00:00:00Z",
      });

      expect(result.isOk()).toBe(true);
    });

    it("should use FALLBACK_SHORT_CONTEXT if generated context is not a string", async () => {
      mockTavilyClient.searchToken = mock(() =>
        Promise.resolve(
          ok({
            articles: [],
            combinedText: "Some text",
          }),
        ),
      ) as unknown as TavilyClient["searchToken"];

      // AI returns invalid type (not a string)
      const mockAiResponse = {
        short_context: 12345, // Invalid type
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
        tavilyClient: mockTavilyClient,
        workersAiClient: mockWorkersAiClient,
        tokensRepository: mockTokensRepository,
      });

      const result = await service.generateAndSaveShortContext({
        id: "new-token",
        name: "New Token",
        symbol: "NEW",
        chainId: "ethereum",
        contractAddress: null,
        createdAt: "2024-01-01T00:00:00Z",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(FALLBACK_SHORT_CONTEXT);
      }
    });
  });
});
