/**
 * Tavily Client Integration Tests
 *
 * Tests actual Tavily API calls with real token names.
 * These tests require ENABLE_EXTERNAL_API_TESTS=true and TAVILY_API_KEY.
 */

import type { TavilyQueryInput } from "@/lib/tavily-client";
import { createTavilyClient } from "@/lib/tavily-client";
import { beforeEach, describe, expect, it } from "bun:test";

const ENABLE_EXTERNAL_API_TESTS = process.env.ENABLE_EXTERNAL_API_TESTS === "true";
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

describe("TavilyClient Integration (External API)", () => {
  beforeEach(() => {
    // Rate limit: Wait 1 second between tests to avoid hitting rate limits
    return new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe("searchToken", () => {
    it.skipIf(!ENABLE_EXTERNAL_API_TESTS || !TAVILY_API_KEY)(
      "should search for Bitcoin token and return articles",
      async () => {
        const client = createTavilyClient();
        const input: TavilyQueryInput = {
          id: "bitcoin-integration-test",
          name: "Bitcoin",
          symbol: "BTC",
          chainId: "bitcoin",
          contractAddress: null,
          maxResults: 5,
        };

        const startTime = Date.now();
        const result = await client.searchToken(input);
        const elapsedMs = Date.now() - startTime;

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          // Should return at least 1 article
          expect(result.value.articles.length).toBeGreaterThan(0);
          // Combined text should not be empty
          expect(result.value.combinedText.length).toBeGreaterThan(0);
          // Should complete within timeout (5 seconds)
          expect(elapsedMs).toBeLessThan(5000);
          // Verify article structure
          const firstArticle = result.value.articles[0];
          expect(firstArticle.title).toBeTruthy();
          expect(firstArticle.content).toBeTruthy();
          expect(firstArticle.url).toBeTruthy();
        }
      },
    );

    it.skipIf(!ENABLE_EXTERNAL_API_TESTS || !TAVILY_API_KEY)(
      "should search for Ethereum token and return articles",
      async () => {
        const client = createTavilyClient();
        const input: TavilyQueryInput = {
          id: "ethereum-integration-test",
          name: "Ethereum",
          symbol: "ETH",
          chainId: "ethereum",
          contractAddress: "0x0000000000000000000000000000000000000000",
          maxResults: 3,
        };

        const startTime = Date.now();
        const result = await client.searchToken(input);
        const elapsedMs = Date.now() - startTime;

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.articles.length).toBeGreaterThan(0);
          expect(result.value.combinedText.length).toBeGreaterThan(0);
          expect(elapsedMs).toBeLessThan(5000);
          // Verify combined text contains relevant information
          expect(result.value.combinedText.toLowerCase()).toMatch(/ethereum|eth|blockchain|crypto/);
        }
      },
    );

    it.skipIf(!ENABLE_EXTERNAL_API_TESTS || !TAVILY_API_KEY)("should handle timeout correctly", async () => {
      // Use a very short timeout to test timeout handling
      const client = createTavilyClient({ timeoutMs: 1 });
      const input: TavilyQueryInput = {
        id: "timeout-test",
        name: "Bitcoin",
        symbol: "BTC",
        chainId: "bitcoin",
        contractAddress: null,
      };

      const result = await client.searchToken(input);

      // Should return timeout error
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("TimeoutError");
      }
    });

    it.skipIf(!ENABLE_EXTERNAL_API_TESTS || !TAVILY_API_KEY)(
      "should truncate combinedText to 6000 characters",
      async () => {
        const client = createTavilyClient();
        const input: TavilyQueryInput = {
          id: "truncate-test",
          name: "Bitcoin",
          symbol: "BTC",
          chainId: "bitcoin",
          contractAddress: null,
          maxResults: 10, // Request more results to potentially exceed limit
        };

        const result = await client.searchToken(input);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          // Combined text should not exceed 6000 characters
          expect(result.value.combinedText.length).toBeLessThanOrEqual(6000);
        }
      },
    );
  });
});
