import { describe, expect, it, beforeEach, mock } from "bun:test";
import { createWorkersAiClient } from "@/lib/workers-ai-client";
import type { TextGenerationRequest, JsonGenerationRequest } from "@/lib/workers-ai-client";
import type { Ai, AiModels, AiTextGenerationOutput } from "@cloudflare/workers-types";

/**
 * Create a mock AI binding that satisfies the Ai interface
 * Uses type casting through unknown to bypass strict generic typing while maintaining runtime behavior
 */
function createMockAiBinding(
  runMock: (model: string, inputs: unknown) => Promise<AiTextGenerationOutput>,
): Ai<AiModels> {
  return {
    run: runMock as Ai<AiModels>["run"],
    aiGatewayLogId: null,
    gateway: () => {
      throw new Error("gateway not implemented in mock");
    },
    autorag: () => {
      throw new Error("autorag not implemented in mock");
    },
    models: () => {
      throw new Error("models not implemented in mock");
    },
    toMarkdown: () => {
      throw new Error("toMarkdown not implemented in mock");
    },
  } as unknown as Ai<AiModels>;
}

describe("WorkersAiClient", () => {
  let mockAiBinding: Ai<AiModels>;
  let mockRun: ReturnType<typeof mock>;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Create mock run function
    mockRun = mock(() => Promise.resolve({ response: "Generated text" }));

    // Create properly typed mock AI binding
    mockAiBinding = createMockAiBinding(mockRun);

    // Restore environment
    process.env = {
      ...originalEnv,
    };
  });

  describe("generateText", () => {
    it("should generate text successfully with explicit model ID", async () => {
      // @ts-expect-error - Cloudflare Workers types mismatch between test and runtime
      const client = createWorkersAiClient({ aiBinding: mockAiBinding });
      const request: TextGenerationRequest = {
        modelId: "@cf/meta/llama-3-8b-instruct",
        systemPrompt: "You are a helpful assistant.",
        userPrompt: "Say hello",
      };

      const result = await client.generateText(request);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.text).toBe("Generated text");
        expect(result.value.modelId).toBe("@cf/meta/llama-3-8b-instruct");
      }
      expect(mockRun).toHaveBeenCalledTimes(1);
    });

    it("should use default model ID when not specified", async () => {
      // @ts-expect-error - Cloudflare Workers types mismatch between test and runtime
      const client = createWorkersAiClient({ aiBinding: mockAiBinding });
      const request: TextGenerationRequest = {
        systemPrompt: "You are a helpful assistant.",
        userPrompt: "Say hello",
      };

      const result = await client.generateText(request);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.modelId).toBe("@cf/ibm-granite/granite-4.0-h-micro" as keyof AiModels);
      }
    });

    it("should return ExternalApiError when AI binding throws error", async () => {
      const errorMock = mock(() => Promise.reject(new Error("Network error")));
      mockAiBinding = createMockAiBinding(errorMock);
      // @ts-expect-error - Cloudflare Workers types mismatch between test and runtime
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

    it("should use hardcoded default model when environment variable is not set", async () => {
      delete process.env.WORKERS_AI_DEFAULT_MODEL;
      // @ts-expect-error - Cloudflare Workers types mismatch between test and runtime
      const client = createWorkersAiClient({ aiBinding: mockAiBinding });
      const request: TextGenerationRequest = {
        systemPrompt: "You are a helpful assistant.",
        userPrompt: "Say hello",
      };

      const result = await client.generateText(request);

      // Should succeed using hardcoded default model
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.modelId).toBe("@cf/ibm-granite/granite-4.0-h-micro" as keyof AiModels);
      }
    });

    it("should return TimeoutError when request exceeds timeout", async () => {
      // Create a promise that resolves after timeout
      const timeoutMock = mock(
        (): Promise<AiTextGenerationOutput> =>
          new Promise(resolve => setTimeout(() => resolve({ response: "Too late" }), 2000)),
      );
      mockAiBinding = createMockAiBinding(timeoutMock);
      // @ts-expect-error - Cloudflare Workers types mismatch between test and runtime
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
      const jsonMock = mock(() => Promise.resolve({ response: JSON.stringify(jsonResponse) }));
      mockAiBinding = createMockAiBinding(jsonMock);
      // @ts-expect-error - Cloudflare Workers types mismatch between test and runtime
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
      const invalidJsonMock = mock(() => Promise.resolve({ response: "Not JSON text" }));
      mockAiBinding = createMockAiBinding(invalidJsonMock);
      // @ts-expect-error - Cloudflare Workers types mismatch between test and runtime
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
      const markdownMock = mock(() => Promise.resolve({ response: wrappedResponse }));
      mockAiBinding = createMockAiBinding(markdownMock);
      // @ts-expect-error - Cloudflare Workers types mismatch between test and runtime
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
      const textWrappedMock = mock(() => Promise.resolve({ response: wrappedResponse }));
      mockAiBinding = createMockAiBinding(textWrappedMock);
      // @ts-expect-error - Cloudflare Workers types mismatch between test and runtime
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
      const incompleteMock = mock(() => Promise.resolve({ response: incompleteJson }));
      mockAiBinding = createMockAiBinding(incompleteMock);
      // @ts-expect-error - Cloudflare Workers types mismatch between test and runtime
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
      const malformedMock = mock(() => Promise.resolve({ response: malformedJson }));
      mockAiBinding = createMockAiBinding(malformedMock);
      // @ts-expect-error - Cloudflare Workers types mismatch between test and runtime
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
