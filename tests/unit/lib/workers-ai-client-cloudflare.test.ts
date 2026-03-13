import type { TextGenerationRequest } from "@/lib/workers-ai-client";
import { describe, expect, it, mock } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

type WorkersAiClientModule = typeof import("@/lib/workers-ai-client");

async function importWorkersAiClient(): Promise<WorkersAiClientModule> {
  mock.restore();
  void mock.module("@opennextjs/cloudflare", () => ({
    getCloudflareContext: async () =>
      Promise.resolve({
        env: {},
      }),
  }));
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/lib/workers-ai-client.ts"));
  moduleUrl.searchParams.set("test", `${String(Date.now())}-${String(Math.random())}`);
  return (await import(moduleUrl.href)) as WorkersAiClientModule;
}

describe("WorkersAiClient Cloudflare binding resolution", () => {
  it("returns ConfigurationError when the AI binding is missing from Cloudflare context", async () => {
    const { createWorkersAiClient } = await importWorkersAiClient();
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
