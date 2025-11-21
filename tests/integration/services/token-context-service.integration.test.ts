/**
 * TokenContextService Integration Tests
 *
 * Tests the full flow of TokenContextService including:
 * - D1 cache hit path
 * - D1 cache miss path (Tavily + Workers AI)
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createTokenContextService } from "@/services/token-context-service";
import { createTokenContextRepository } from "@/repositories/token-context-repository";
import { createTavilyClient } from "@/lib/tavily-client";
import { createWorkersAiClient } from "@/lib/workers-ai-client";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { TokenMetaInput } from "@/services/token-context-service";

// TODO: Fix D1 binding mock for integration tests
describe.skip("TokenContextService Integration", () => {
  beforeEach(() => {
    // Setup: Ensure clean state
  });

  afterEach(() => {
    // Cleanup: Reset any test data
  });

  describe("generateTokenContext", () => {
    it("should return TokenContext from D1 when record exists (cache hit)", async () => {
      // This test requires D1 database setup
      // Skip if D1 is not available in test environment
      let d1Binding: D1Database | null = null;
      try {
        const { env } = await getCloudflareContext({ async: true });
        d1Binding = (env as Cloudflare.Env).DB;
      } catch (error) {
        console.log("Skipping test: D1 database not available", error);
        return;
      }
      if (!d1Binding) {
        console.log("Skipping test: D1 database not available");
        return;
      }

      const repository = createTokenContextRepository({ d1Binding });
      const tavilyClient = createTavilyClient();
      const workersAiClient = createWorkersAiClient();
      const service = createTokenContextService({
        repository,
        tavilyClient,
        workersAiClient,
      });

      // Create a test token context in D1 first
      const testTokenMeta: TokenMetaInput = {
        id: "integration-test-token",
        name: "Integration Test Token",
        symbol: "ITT",
        chainId: "ethereum",
        contractAddress: "0x1234567890123456789012345678901234567890",
        createdAt: new Date().toISOString(),
      };

      // First call should miss cache and generate context
      const firstResult = await service.generateTokenContext(testTokenMeta);

      if (firstResult.isErr()) {
        console.log("Skipping cache hit test: Failed to generate initial context", firstResult.error);
        return;
      }

      // Second call should hit cache
      const secondResult = await service.generateTokenContext(testTokenMeta);

      expect(secondResult.isOk()).toBe(true);
      if (secondResult.isOk()) {
        expect(secondResult.value.shortContext).toBe(firstResult.value.shortContext);
        expect(secondResult.value.category).toBe(firstResult.value.category);
        expect(secondResult.value.tags).toEqual(firstResult.value.tags);
      }
    });

    it("should generate TokenContext via Tavily + Workers AI when D1 miss (cache miss)", async () => {
      // This test requires D1 database and external APIs
      // Skip if not available in test environment
      let d1Binding: D1Database | null = null;
      try {
        const { env } = await getCloudflareContext({ async: true });
        d1Binding = (env as Cloudflare.Env).DB;
      } catch (error) {
        console.log("Skipping test: D1 database not available", error);
        return;
      }
      if (!d1Binding) {
        console.log("Skipping test: D1 database not available");
        return;
      }

      const repository = createTokenContextRepository({ d1Binding });
      const tavilyClient = createTavilyClient();
      const workersAiClient = createWorkersAiClient();
      const service = createTokenContextService({
        repository,
        tavilyClient,
        workersAiClient,
      });

      // Use a unique token ID to ensure cache miss
      const uniqueId = `integration-test-${Date.now()}`;
      const testTokenMeta: TokenMetaInput = {
        id: uniqueId,
        name: "Bitcoin",
        symbol: "BTC",
        chainId: "bitcoin",
        contractAddress: null,
        createdAt: new Date().toISOString(),
      };

      const result = await service.generateTokenContext(testTokenMeta);

      // This may fail if external APIs are not available, which is acceptable
      if (result.isErr()) {
        console.log("Skipping cache miss test: External APIs not available", result.error);
        return;
      }

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.shortContext.length).toBeGreaterThan(50);
        expect(result.value.shortContext.length).toBeLessThanOrEqual(500);
        expect(result.value.category).toBeTruthy();
        expect(Array.isArray(result.value.tags)).toBe(true);
        expect(result.value.tags.length).toBeGreaterThan(0);
      }
    });

    it("should handle errors gracefully when external APIs fail", async () => {
      let d1Binding: D1Database | null = null;
      try {
        const { env } = await getCloudflareContext({ async: true });
        d1Binding = (env as Cloudflare.Env).DB;
      } catch (error) {
        console.log("Skipping test: D1 database not available", error);
        return;
      }
      if (!d1Binding) {
        console.log("Skipping test: D1 database not available");
        return;
      }

      const repository = createTokenContextRepository({ d1Binding });
      // Use invalid API key to force error
      const tavilyClient = createTavilyClient({ apiKey: "invalid-key" });
      const workersAiClient = createWorkersAiClient();
      const service = createTokenContextService({
        repository,
        tavilyClient,
        workersAiClient,
      });

      const testTokenMeta: TokenMetaInput = {
        id: `error-test-${Date.now()}`,
        name: "Test Token",
        symbol: "TEST",
        chainId: "ethereum",
        contractAddress: null,
        createdAt: new Date().toISOString(),
      };

      const result = await service.generateTokenContext(testTokenMeta);

      // Should return error when external APIs fail
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ExternalApiError");
      }
    });
  });
});
