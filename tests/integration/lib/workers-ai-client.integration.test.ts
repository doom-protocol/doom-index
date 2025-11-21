/**
 * Workers AI Client Integration Tests
 *
 * Tests actual Cloudflare Workers AI API calls.
 * These tests require ENABLE_EXTERNAL_API_TESTS=true and AI binding.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { createWorkersAiClient } from "@/lib/workers-ai-client";
import type { TextGenerationRequest, JsonGenerationRequest } from "@/lib/workers-ai-client";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const ENABLE_EXTERNAL_API_TESTS = process.env.ENABLE_EXTERNAL_API_TESTS === "true";

// Helper to check if AI binding is available
async function isAiBindingAvailable(): Promise<boolean> {
  if (!ENABLE_EXTERNAL_API_TESTS) {
    return false;
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const binding = (env as Cloudflare.Env).AI;
    return !!binding;
  } catch {
    return false;
  }
}

describe("WorkersAiClient Integration (External API)", () => {
  beforeEach(() => {
    // Rate limit: Wait 1 second between tests to avoid hitting rate limits
    return new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe("generateText", () => {
    it.skipIf(!ENABLE_EXTERNAL_API_TESTS)(
      "should generate text successfully with fixed prompts",
      async () => {
        const aiAvailable = await isAiBindingAvailable();
        if (!aiAvailable) {
          console.log("Skipping test: AI binding not available");
          return;
        }

        const client = createWorkersAiClient();
        const request: TextGenerationRequest = {
          systemPrompt: "You are a helpful assistant. Respond concisely.",
          userPrompt: "What is the capital of France? Answer in one word.",
        };

        const startTime = Date.now();
        const result = await client.generateText(request);
        const elapsedMs = Date.now() - startTime;

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          // Response should not be empty
          expect(result.value.text.length).toBeGreaterThan(0);
          // Should complete within timeout (10 seconds)
          expect(elapsedMs).toBeLessThan(10000);
          // Model ID should be set
          expect(result.value.modelId).toBeTruthy();
          // Response should contain relevant information
          expect(result.value.text.toLowerCase()).toMatch(/paris|france/);
        }
      },
    );

    it.skipIf(!ENABLE_EXTERNAL_API_TESTS)(
      "should handle timeout correctly",
      async () => {
        const aiAvailable = await isAiBindingAvailable();
        if (!aiAvailable) {
          console.log("Skipping test: AI binding not available");
          return;
        }

        // Use a very short timeout to test timeout handling
        const client = createWorkersAiClient({ timeoutMs: 1 });
        const request: TextGenerationRequest = {
          systemPrompt: "You are a helpful assistant.",
          userPrompt: "Say hello",
        };

        const result = await client.generateText(request);

        // Should return timeout error
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.type).toBe("TimeoutError");
        }
      },
    );
  });

  describe("generateJson", () => {
    it.skipIf(!ENABLE_EXTERNAL_API_TESTS)(
      "should generate valid JSON with short_context, category, and tags",
      async () => {
        const aiAvailable = await isAiBindingAvailable();
        if (!aiAvailable) {
          console.log("Skipping test: AI binding not available");
          return;
        }

        const client = createWorkersAiClient();
        const request: JsonGenerationRequest<{
          short_context: string;
          category: string;
          tags: string[];
        }> = {
          systemPrompt:
            "You are a cryptocurrency token analyst. Generate a JSON response with short_context (2-4 sentences), category (single word), and tags (array of 2-5 strings).",
          userPrompt: "Analyze Bitcoin (BTC). Generate token context JSON.",
        };

        const startTime = Date.now();
        const result = await client.generateJson(request);
        const elapsedMs = Date.now() - startTime;

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          // Should complete within timeout (10 seconds)
          expect(elapsedMs).toBeLessThan(10000);
          // Verify JSON structure
          expect(result.value.value).toHaveProperty("short_context");
          expect(result.value.value).toHaveProperty("category");
          expect(result.value.value).toHaveProperty("tags");
          // Verify types with type assertion
          const value = result.value.value as { short_context: string; category: string; tags: string[] };
          expect(typeof value.short_context).toBe("string");
          expect(typeof value.category).toBe("string");
          expect(Array.isArray(value.tags)).toBe(true);
          // Verify content quality
          expect(value.short_context.length).toBeGreaterThan(50);
          expect(value.short_context.length).toBeLessThanOrEqual(500);
          expect(value.category.length).toBeGreaterThan(0);
          expect(value.tags.length).toBeGreaterThan(0);
          expect(value.tags.length).toBeLessThanOrEqual(5);
          // Verify all tags are strings
          value.tags.forEach(tag => {
            expect(typeof tag).toBe("string");
          });
          // Model ID should be set
          expect(result.value.modelId).toBeTruthy();
        }
      },
    );

    it.skipIf(!ENABLE_EXTERNAL_API_TESTS)(
      "should handle JSON parsing errors gracefully",
      async () => {
        const aiAvailable = await isAiBindingAvailable();
        if (!aiAvailable) {
          console.log("Skipping test: AI binding not available");
          return;
        }

        const client = createWorkersAiClient();
        // Request that might return invalid JSON
        const request: JsonGenerationRequest<unknown> = {
          systemPrompt: "You are a helpful assistant. Respond with plain text, not JSON.",
          userPrompt: "Say hello",
        };

        const result = await client.generateJson(request);

        // Should return parsing error
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.type).toBe("ParsingError");
        }
      },
    );
  });
});
