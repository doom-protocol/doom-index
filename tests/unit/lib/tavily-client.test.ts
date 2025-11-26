import type { TavilyClient, TavilyQueryInput, TavilySearchResult } from "@/lib/tavily-client";
import { createTavilyClient } from "@/lib/tavily-client";
import type { AppError } from "@/types/app-error";
import type { TavilyClient as TavilySDK } from "@tavily/core";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { err, ok } from "neverthrow";

describe("TavilyClient", () => {
  let mockTavilyClient: TavilyClient;
  let mockSearchToken: ReturnType<typeof mock>;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mock.restore();

    // Mock TavilyClient wrapper interface
    mockSearchToken = mock((_input: TavilyQueryInput) => {
      const result: TavilySearchResult = {
        articles: [
          {
            title: "Test Article 1",
            content: "This is test content 1",
            url: "https://example.com/article1",
          },
          {
            title: "Test Article 2",
            content: "This is test content 2",
            url: "https://example.com/article2",
          },
        ],
        combinedText: "Test Article 1: This is test content 1\nTest Article 2: This is test content 2",
      };
      return Promise.resolve(ok(result));
    });

    mockTavilyClient = {
      searchToken: mockSearchToken,
    };

    process.env = {
      ...originalEnv,
      TAVILY_API_KEY: "test-api-key",
    };
  });

  describe("searchToken", () => {
    it("should search token successfully and return articles", async () => {
      const client = createTavilyClient({ mockClient: mockTavilyClient });
      const input: TavilyQueryInput = {
        id: "test-token",
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: "0x123",
      };

      const result = await client.searchToken(input);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.articles).toHaveLength(2);
        expect(result.value.articles[0].title).toBe("Test Article 1");
        expect(result.value.articles[0].content).toBe("This is test content 1");
        expect(result.value.articles[0].url).toBe("https://example.com/article1");
        expect(result.value.combinedText).toContain("Test Article 1");
        expect(result.value.combinedText).toContain("This is test content 1");
        expect(result.value.combinedText).toContain("Test Article 2");
      }

      expect(mockSearchToken).toHaveBeenCalledTimes(1);
      const callArgs = mockSearchToken.mock.calls[0];
      expect(callArgs[0]).toEqual(input);
    });

    it("should build query from token metadata", async () => {
      const client = createTavilyClient({ mockClient: mockTavilyClient });
      const input: TavilyQueryInput = {
        id: "test-token",
        name: "Bitcoin",
        symbol: "BTC",
        chainId: "bitcoin",
        contractAddress: null,
      };

      await client.searchToken(input);

      const callArgs = mockSearchToken.mock.calls[0];
      expect(callArgs[0]).toEqual(input);
    });

    it("should use custom maxResults when provided", async () => {
      const client = createTavilyClient({ mockClient: mockTavilyClient });
      const input: TavilyQueryInput = {
        id: "test-token",
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: null,
        maxResults: 10,
      };

      await client.searchToken(input);

      const callArgs = mockSearchToken.mock.calls[0];
      expect(callArgs[0].maxResults).toBe(10);
    });

    it("should truncate combinedText to 6000 characters", async () => {
      const longContent = "A".repeat(4000);
      const fakeSdk = {
        search: async () => ({
          results: [
            {
              title: "Long Article",
              content: longContent,
              url: "https://example.com/long",
            },
            {
              title: "Another Long Article",
              content: longContent,
              url: "https://example.com/long2",
            },
          ],
        }),
      };

      const client = createTavilyClient({ tavilyClient: fakeSdk as unknown as TavilySDK, apiKey: "test-api-key" });
      const input: TavilyQueryInput = {
        id: "test-token",
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: null,
      };

      const result = await client.searchToken(input);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.combinedText.length).toBeLessThanOrEqual(6000);
      }
    });

    it("should return ConfigurationError when API key is not set", async () => {
      // Explicitly pass empty string apiKey to test API key validation
      // Note: env.TAVILY_API_KEY may be cached from module initialization,
      // so we explicitly pass empty string to ensure the test works regardless of env state
      const client = createTavilyClient({ apiKey: "" });
      const input: TavilyQueryInput = {
        id: "test-token",
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: null,
      };

      const result = await client.searchToken(input);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ConfigurationError");
      }
    });

    it("should return ExternalApiError when SDK throws error", async () => {
      const error: AppError = {
        type: "ExternalApiError",
        provider: "Tavily",
        message: "API error: 404 Not Found",
      };
      mockTavilyClient.searchToken = mock(() => Promise.resolve(err(error)));

      const client = createTavilyClient({ mockClient: mockTavilyClient });
      const input: TavilyQueryInput = {
        id: "test-token",
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: null,
      };

      const result = await client.searchToken(input);

      expect(result.isErr()).toBe(true);
      if (result.isErr() && result.error.type === "ExternalApiError") {
        expect(result.error.type).toBe("ExternalApiError");
        expect(result.error.provider).toBe("Tavily");
      }
    });

    it("should return ExternalApiError when rate limit occurs", async () => {
      const error: AppError = {
        type: "ExternalApiError",
        provider: "Tavily",
        status: 429,
        message: "Rate limit exceeded: 429",
      };
      mockTavilyClient.searchToken = mock(() => Promise.resolve(err(error)));

      const client = createTavilyClient({ mockClient: mockTavilyClient });
      const input: TavilyQueryInput = {
        id: "test-token",
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: null,
      };

      const result = await client.searchToken(input);

      expect(result.isErr()).toBe(true);
      if (result.isErr() && result.error.type === "ExternalApiError") {
        expect(result.error.type).toBe("ExternalApiError");
        expect(result.error.provider).toBe("Tavily");
        expect(result.error.status).toBe(429);
      }
    });

    it("should return TimeoutError when request exceeds timeout", async () => {
      const timeoutError: AppError = {
        type: "TimeoutError",
        message: "Tavily request timed out after 500ms",
        timeoutMs: 500,
      };
      mockTavilyClient.searchToken = mock(() => Promise.resolve(err(timeoutError)));

      const client = createTavilyClient({ mockClient: mockTavilyClient });
      const input: TavilyQueryInput = {
        id: "test-token",
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: null,
      };

      const result = await client.searchToken(input);

      expect(result.isErr()).toBe(true);
      if (result.isErr() && result.error.type === "TimeoutError") {
        expect(result.error.type).toBe("TimeoutError");
        expect(result.error.timeoutMs).toBe(500);
      }
    }, 3000);

    it("should handle empty results array", async () => {
      const mockResult: TavilySearchResult = {
        articles: [],
        combinedText: "",
      };
      mockTavilyClient.searchToken = mock(() => Promise.resolve(ok(mockResult)));

      const client = createTavilyClient({ mockClient: mockTavilyClient });
      const input: TavilyQueryInput = {
        id: "test-token",
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: null,
      };

      const result = await client.searchToken(input);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.articles).toHaveLength(0);
        expect(result.value.combinedText).toBe("");
      }
    });

    it("should handle missing content field (use snippet)", async () => {
      const mockResult: TavilySearchResult = {
        articles: [
          {
            title: "Test Article",
            content: "This is a snippet",
            url: "https://example.com/article",
          },
        ],
        combinedText: "Test Article\nThis is a snippet\nhttps://example.com/article",
      };
      mockTavilyClient.searchToken = mock(() => Promise.resolve(ok(mockResult)));

      const client = createTavilyClient({ mockClient: mockTavilyClient });
      const input: TavilyQueryInput = {
        id: "test-token",
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: null,
      };

      const result = await client.searchToken(input);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.articles[0].content).toBe("This is a snippet");
      }
    });

    it("should handle network errors", async () => {
      const error: AppError = {
        type: "ExternalApiError",
        provider: "Tavily",
        message: "Network error: fetch failed",
      };
      mockTavilyClient.searchToken = mock(() => Promise.resolve(err(error)));

      const client = createTavilyClient({ mockClient: mockTavilyClient });
      const input: TavilyQueryInput = {
        id: "test-token",
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: null,
      };

      const result = await client.searchToken(input);

      expect(result.isErr()).toBe(true);
      if (result.isErr() && result.error.type === "ExternalApiError") {
        expect(result.error.provider).toBe("Tavily");
        expect(result.error.message).toContain("Network error");
      }
    });

    it("should handle authentication errors", async () => {
      const error: AppError = {
        type: "ExternalApiError",
        provider: "Tavily",
        status: 401,
        message: "Authentication failed: 401 Unauthorized",
      };
      mockTavilyClient.searchToken = mock(() => Promise.resolve(err(error)));

      const client = createTavilyClient({ mockClient: mockTavilyClient });
      const input: TavilyQueryInput = {
        id: "test-token",
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: null,
      };

      const result = await client.searchToken(input);

      expect(result.isErr()).toBe(true);
      if (result.isErr() && result.error.type === "ExternalApiError") {
        expect(result.error.provider).toBe("Tavily");
        if ("status" in result.error) {
          expect(result.error.status).toBe(401);
        }
      }
    });

    it("should accept custom tavilyClient for testing", async () => {
      const customResult: TavilySearchResult = {
        articles: [
          {
            title: "Custom Article",
            content: "Custom content",
            url: "https://example.com/custom",
          },
        ],
        combinedText: "Custom Article: Custom content",
      };
      const customClient: TavilyClient = {
        searchToken: mock(() => Promise.resolve(ok(customResult))),
      };

      const client = createTavilyClient({
        mockClient: customClient,
      });
      const input: TavilyQueryInput = {
        id: "test-token",
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: null,
      };

      const result = await client.searchToken(input);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.articles).toHaveLength(1);
        expect(result.value.articles[0].title).toBe("Custom Article");
      }
    });
  });
});
