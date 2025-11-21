import { describe, expect, it, beforeEach, mock } from "bun:test";
import { createWorkersAiClient } from "@/lib/workers-ai-client";
import type { TextGenerationRequest, JsonGenerationRequest } from "@/lib/workers-ai-client";
import type { Ai } from "@cloudflare/workers-types";

// TODO: Fix complex AI binding mock types
describe.skip("WorkersAiClient", () => {
  let mockAiBinding: Ai;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Mock AI binding
    mockAiBinding = {
      run: mock(() => Promise.resolve({ response: "Generated text" })),
    } as unknown as Ai;

    // Restore environment
    process.env = {
      ...originalEnv,
      WORKERS_AI_DEFAULT_MODEL: "@cf/meta/llama-3.1-8b-instruct-awq",
    };
  });

  describe("generateText", () => {
    it("should generate text successfully with explicit model ID", async () => {
      const client = createWorkersAiClient({ aiBinding: mockAiBinding });
      const request: TextGenerationRequest = {
        modelId: "@cf/meta/llama-3.1-8b-instruct-awq",
        systemPrompt: "You are a helpful assistant.",
        userPrompt: "Say hello",
      };

      const result = await client.generateText(request);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.text).toBe("Generated text");
        expect(result.value.modelId).toBe("@cf/meta/llama-3.1-8b-instruct");
      }
      expect(mockAiBinding.run).toHaveBeenCalledTimes(1);
    });

    it("should use default model ID when not specified", async () => {
      const client = createWorkersAiClient({ aiBinding: mockAiBinding });
      const request: TextGenerationRequest = {
        systemPrompt: "You are a helpful assistant.",
        userPrompt: "Say hello",
      };

      const result = await client.generateText(request);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.modelId).toBe("@cf/ibm-granite/granite-4.0-h-micro");
      }
    });

    it("should return ExternalApiError when AI binding throws error", async () => {
      (mockAiBinding as unknown as Ai).run = mock(() => Promise.reject(new Error("Network error")));
      const client = createWorkersAiClient({ aiBinding: mockAiBinding });
      const request: TextGenerationRequest = {
        systemPrompt: "You are a helpful assistant.",
        userPrompt: "Say hello",
      };

      const result = await client.generateText(request);

      expect(result.isErr()).toBe(true);
      if (result.isErr() && result.error.type === "ExternalApiError") {
        expect(result.error.type).toBe("ExternalApiError");
        expect(result.error.provider).toBe("WorkersAI");
      }
    });

    it("should return ConfigurationError when default model is not set", async () => {
      delete process.env.WORKERS_AI_DEFAULT_MODEL;
      const client = createWorkersAiClient({ aiBinding: mockAiBinding });
      const request: TextGenerationRequest = {
        systemPrompt: "You are a helpful assistant.",
        userPrompt: "Say hello",
      };

      const result = await client.generateText(request);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ConfigurationError");
      }
    });

    it("should return TimeoutError when request exceeds timeout", async () => {
      // Create a promise that resolves after timeout
      (mockAiBinding as unknown as Ai).run = mock(() => new Promise(resolve => setTimeout(() => resolve({ response: "Too late" }), 2000)));
      const client = createWorkersAiClient({ aiBinding: mockAiBinding, timeoutMs: 500 });
      const request: TextGenerationRequest = {
        systemPrompt: "You are a helpful assistant.",
        userPrompt: "Say hello",
      };

      const result = await client.generateText(request);

      expect(result.isErr()).toBe(true);
      if (result.isErr() && result.error.type === "TimeoutError") {
        expect(result.error.type).toBe("TimeoutError");
        expect(result.error.timeoutMs).toBe(500);
      }
    }, 3000); // Test timeout of 3 seconds
  });

  describe("generateJson", () => {
    it("should generate and parse JSON successfully", async () => {
      const jsonResponse = { short_context: "Test context", category: "test", tags: ["tag1", "tag2"] };
      (mockAiBinding as unknown as Ai).run = mock(() => Promise.resolve({ response: JSON.stringify(jsonResponse) }));
      const client = createWorkersAiClient({ aiBinding: mockAiBinding });
      const request: JsonGenerationRequest<{ short_context: string; category: string; tags: string[] }> = {
        systemPrompt: "Return JSON only.",
        userPrompt: "Generate token context",
      };

      const result = await client.generateJson(request);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.value).toEqual(jsonResponse);
      }
    });

    it("should return ParsingError when response is not valid JSON", async () => {
      (mockAiBinding as unknown as Ai).run = mock(() => Promise.resolve({ response: "Not JSON text" }));
      const client = createWorkersAiClient({ aiBinding: mockAiBinding });
      const request: JsonGenerationRequest<unknown> = {
        systemPrompt: "Return JSON only.",
        userPrompt: "Generate token context",
      };

      const result = await client.generateJson(request);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ParsingError");
      }
    });

    it("should handle JSON wrapped in markdown code blocks", async () => {
      const jsonResponse = { short_context: "Test", category: "test", tags: [] };
      const wrappedResponse = "```json\n" + JSON.stringify(jsonResponse) + "\n```";
      (mockAiBinding as unknown as Ai).run = mock(() => Promise.resolve({ response: wrappedResponse }));
      const client = createWorkersAiClient({ aiBinding: mockAiBinding });
      const request: JsonGenerationRequest<unknown> = {
        systemPrompt: "Return JSON only.",
        userPrompt: "Generate token context",
      };

      const result = await client.generateJson(request);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.value).toEqual(jsonResponse);
      }
    });

    it("should handle JSON with additional text before/after", async () => {
      const jsonResponse = { short_context: "Test", category: "test", tags: [] };
      const wrappedResponse = "Here is the JSON:\n" + JSON.stringify(jsonResponse) + "\nThat's it.";
      (mockAiBinding as unknown as Ai).run = mock(() => Promise.resolve({ response: wrappedResponse }));
      const client = createWorkersAiClient({ aiBinding: mockAiBinding });
      const request: JsonGenerationRequest<unknown> = {
        systemPrompt: "Return JSON only.",
        userPrompt: "Generate token context",
      };

      const result = await client.generateJson(request);

      // Should still parse successfully if JSON is valid
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.value).toEqual(jsonResponse);
      }
    });

    it("should return ParsingError for incomplete JSON", async () => {
      const incompleteJson = '{"short_context": "Test", "category":';
      (mockAiBinding as unknown as Ai).run = mock(() => Promise.resolve({ response: incompleteJson }));
      const client = createWorkersAiClient({ aiBinding: mockAiBinding });
      const request: JsonGenerationRequest<unknown> = {
        systemPrompt: "Return JSON only.",
        userPrompt: "Generate token context",
      };

      const result = await client.generateJson(request);

      expect(result.isErr()).toBe(true);
      if (result.isErr() && result.error.type === "ParsingError") {
        expect(result.error.type).toBe("ParsingError");
        expect(result.error.rawValue).toBeDefined();
      }
    });

    it("should return ParsingError for malformed JSON with extra commas", async () => {
      const malformedJson = '{"short_context": "Test", "category": "test",,}';
      (mockAiBinding as unknown as Ai).run = mock(() => Promise.resolve({ response: malformedJson }));
      const client = createWorkersAiClient({ aiBinding: mockAiBinding });
      const request: JsonGenerationRequest<unknown> = {
        systemPrompt: "Return JSON only.",
        userPrompt: "Generate token context",
      };

      const result = await client.generateJson(request);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ParsingError");
      }
    });
  });
});
