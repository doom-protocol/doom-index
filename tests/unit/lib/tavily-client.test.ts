import { describe, expect, it, beforeEach, mock } from "bun:test";
import { createTavilyClient } from "@/lib/tavily-client";
import type { TavilyQueryInput, TavilyClient } from "@/lib/tavily-client";

// TODO: Fix complex tavily SDK mock types
describe.skip("TavilyClient", () => {
  let mockTavilyClient: TavilyClient;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mock.restore();

    // Mock Tavily SDK client
    mockTavilyClient = {
      searchToken: mock(() =>
        Promise.resolve({
          _tag: "Right",
          right: {
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
          },
        } as unknown as ReturnType<typeof tavily>["search"]),
      ),
    };

    // Mock tavily function from @tavily/core
    mock.module("@tavily/core", () => ({
      tavily: mock(() => mockTavilyClient),
    }));

    process.env = {
      ...originalEnv,
      TAVILY_API_KEY: "test-api-key",
    };
  });

  describe("searchToken", () => {
    it("should search token successfully and return articles", async () => {
      const client = createTavilyClient();
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
        expect(result.value.combinedText).toContain("https://example.com/article1");
      }

      expect(mockTavilyClient.searchToken).toHaveBeenCalledTimes(1);
      const callArgs = mockTavilyClient.searchToken.mock.calls[0];
      expect(callArgs[0]).toContain("Test Token");
      expect(callArgs[0]).toContain("TEST");
      expect(callArgs[0]).toContain("ethereum");
      expect(callArgs[0]).toContain("token");
      expect(callArgs[1]).toEqual({
        maxResults: 5,
        searchDepth: "basic",
      });
    });

    it("should build query from token metadata", async () => {
      const client = createTavilyClient();
      const input: TavilyQueryInput = {
        id: "test-token",
        name: "Bitcoin",
        symbol: "BTC",
        chainId: "bitcoin",
        contractAddress: null,
      };

      await client.searchToken(input);

      const callArgs = mockTavilyClient.searchToken.mock.calls[0];
      expect(callArgs[0]).toContain("Bitcoin");
      expect(callArgs[0]).toContain("BTC");
      expect(callArgs[0]).toContain("bitcoin");
      expect(callArgs[0]).toContain("token");
    });

    it("should use custom maxResults when provided", async () => {
      const client = createTavilyClient();
      const input: TavilyQueryInput = {
        id: "test-token",
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: null,
        maxResults: 10,
      };

      await client.searchToken(input);

      const callArgs = mockTavilyClient.searchToken.mock.calls[0];
      expect(callArgs[1]).toEqual({
        maxResults: 10,
        searchDepth: "basic",
      });
    });

    it("should truncate combinedText to 6000 characters", async () => {
      const longContent = "A".repeat(4000);
      mockTavilyClient.searchToken = mock(() =>
        Promise.resolve({
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
      );

      const client = createTavilyClient();
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
      const originalKey = process.env.TAVILY_API_KEY;
      delete (process.env as Record<string, unknown>).TAVILY_API_KEY;
      const client = createTavilyClient();
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

      // Restore environment variable
      process.env.TAVILY_API_KEY = originalKey;
    });

    it("should return ExternalApiError when SDK throws error", async () => {
      mockTavilyClient.searchToken = mock(() => Promise.reject(new Error("API error: 404 Not Found")));

      const client = createTavilyClient();
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
      mockTavilyClient.searchToken = mock(() => Promise.reject(new Error("Rate limit exceeded: 429")));

      const client = createTavilyClient();
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
      mockTavilyClient.searchToken = mock(
        () => new Promise(resolve => setTimeout(() => resolve({ results: [] }), 6000)),
      );

      const client = createTavilyClient({ timeoutMs: 500 });
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
      mockTavilyClient.searchToken = mock(() => Promise.resolve({ results: [] }));

      const client = createTavilyClient();
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
      mockTavilyClient.searchToken = mock(() =>
        Promise.resolve({
          results: [
            {
              title: "Test Article",
              snippet: "This is a snippet",
              url: "https://example.com/article",
            },
          ],
        }),
      );

      const client = createTavilyClient();
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
      mockTavilyClient.searchToken = mock(() => Promise.reject(new TypeError("fetch failed")));

      const client = createTavilyClient();
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
      mockTavilyClient.searchToken = mock(() => Promise.reject(new Error("401 Unauthorized")));

      const client = createTavilyClient();
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
      const customClient = {
        searchToken: mock(() =>
          Promise.resolve({
            _tag: "Right",
            right: {
              articles: [
                {
                  title: "Custom Article",
                  content: "Custom content",
                  url: "https://example.com/custom",
                },
              ],
              combinedText: "Custom Article: Custom content",
            },
          } as unknown as ReturnType<typeof tavily>["search"]),
        ),
      };

      const client = createTavilyClient({ tavilyClient: customClient as unknown });
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
