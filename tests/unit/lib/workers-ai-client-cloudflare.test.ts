import type { TextGenerationRequest } from "@/lib/workers-ai-client";
import { describe, expect, it, mock } from "bun:test";

void mock.module("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async (_options?: { async?: boolean }) =>
    Promise.resolve({
      env: {},
    }),
}));

describe("WorkersAiClient Cloudflare binding resolution", () => {
  it("returns ConfigurationError when the AI binding is missing from Cloudflare context", async () => {
    const { createWorkersAiClient } = await import("@/lib/workers-ai-client");
    const client = createWorkersAiClient();
    const request: TextGenerationRequest = {
      systemPrompt: "You are a helpful assistant.",
      userPrompt: "Say hello",
    };

    const result = await client.generateText(request);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("ConfigurationError");
      expect(result.error.message).toBe("Cloudflare AI binding not found");
    }
  });
});
