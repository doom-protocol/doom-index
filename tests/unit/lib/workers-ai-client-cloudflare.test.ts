import type { AiModels } from "@cloudflare/workers-types";
import { describe, expect, it, mock } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

interface TextGenerationRequest {
  model?: keyof AiModels;
  systemPrompt: string;
  userPrompt: string;
}

interface WorkersAiError {
  message: string;
  missingVar?: string;
  provider?: string;
  rawValue?: string;
  timeoutMs?: number;
  type: "ConfigurationError" | "ExternalApiError" | "ParsingError" | "TimeoutError";
}

interface TestOkResult<T> {
  error?: never;
  isErr: () => this is TestErrResult;
  isOk: () => this is TestOkResult<T>;
  value: T;
}

interface TestErrResult {
  error: WorkersAiError;
  isErr: () => this is TestErrResult;
  isOk: () => this is TestOkResult<never>;
  value?: never;
}

type TestResult<T> = TestOkResult<T> | TestErrResult;

interface WorkersAiClientModule {
  createWorkersAiClient: () => {
    generateText: (input: TextGenerationRequest) => Promise<TestResult<{ modelId: keyof AiModels; text: string }>>;
  };
}

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
