import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Result, err, ok } from "neverthrow";
import type { AppError, ConfigurationError, TimeoutError } from "@/types/app-error";
import { logger } from "@/utils/logger";
import { parseJsonFromText } from "@/utils/text";
import { createTimeoutPromise } from "@/utils/time";
import { getErrorMessage } from "@/utils/error";

/**
 * Default Workers AI model ID
 */
const DEFAULT_WORKERS_AI_MODEL = "@cf/meta/llama-3-8b-instruct" as keyof AiModels;

/**
 * Request for text generation
 */
export type TextGenerationRequest = {
  model?: keyof AiModels;
  modelId?: keyof AiModels; // Alias for model (for backward compatibility with tests)
  systemPrompt: string;
  userPrompt: string;
};

/**
 * Text generation result
 */
type TextGenerationResult = {
  text: string;
  modelId: keyof AiModels;
};

/**
 * Request for JSON generation (extends TextGenerationRequest)
 */
export type JsonGenerationRequest<_T> = TextGenerationRequest & {
  // JSON schema can be inferred from T, but we keep it flexible
};

/**
 * JSON generation result wrapper
 */
type JsonGenerationResult<T> = {
  value: T;
  modelId?: keyof AiModels;
};

/**
 * Workers AI client interface
 */
export interface WorkersAiClient {
  generateText(input: TextGenerationRequest): Promise<Result<TextGenerationResult, AppError>>;
  generateJson<T>(input: JsonGenerationRequest<T>): Promise<Result<JsonGenerationResult<T>, AppError>>;
}

type CreateWorkersAiClientDeps = {
  aiBinding?: Ai;
  defaultModel?: keyof AiModels;
  timeoutMs?: number; // Default: 30 seconds for Workers AI
  log?: typeof logger;
};

/**
 * Create Workers AI client
 *
 * @param deps - Dependencies including AI binding and configuration
 * @returns Workers AI client instance
 */
export function createWorkersAiClient({
  aiBinding,
  defaultModel = DEFAULT_WORKERS_AI_MODEL,
  timeoutMs = 30_000, // 30 seconds default timeout for Workers AI
  log = logger,
}: CreateWorkersAiClientDeps = {}): WorkersAiClient {
  // Resolve AI binding from Cloudflare context
  const resolveAiBinding = async (): Promise<Result<Ai, ConfigurationError>> => {
    if (aiBinding) {
      return ok(aiBinding);
    }

    const contextError = (message: string): ConfigurationError => ({
      type: "ConfigurationError",
      message,
      missingVar: "AI",
    });

    try {
      // Try to get binding from Cloudflare context
      const ctx = await getCloudflareContext({ async: true });
      const binding = (ctx.env as Cloudflare.Env).AI;
      if (binding) {
        return ok(binding);
      }
    } catch {
      // Ignore context resolution errors, will try fallback
    }

    // If binding is not found, check for REST API credentials
    if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
      return err(
        contextError(
          "AI binding is not configured and Cloudflare REST API credentials are missing (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN)",
        ),
      );
    }

    // Return null to indicate REST API usage
    // The caller should handle this case
    return err(contextError("AI binding not found, falling back to REST API"));
  };

  const runRestApi = async (
    model: string,
    input: AiTextGenerationInput,
    requestTimeoutMs: number = timeoutMs,
  ): Promise<Result<AiTextGenerationOutput, AppError>> => {
    if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
      return err({
        type: "ConfigurationError",
        message: "Cloudflare REST API credentials are missing",
        missingVar: "CLOUDFLARE_API_TOKEN",
      });
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        return err({
          type: "ExternalApiError",
          provider: "WorkersAI",
          message: `REST API error: ${response.status} ${response.statusText} - ${errorText}`,
        });
      }

      const data = (await response.json()) as { result: { response: string }; success: boolean; errors: unknown[] };

      if (!data.success || !data.result) {
        return err({
          type: "ExternalApiError",
          provider: "WorkersAI",
          message: `REST API returned unsuccessful response: ${JSON.stringify(data.errors)}`,
        });
      }

      return ok({
        response: data.result.response,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return err({
          type: "TimeoutError",
          message: `REST API request timed out after ${requestTimeoutMs}ms`,
          timeoutMs: requestTimeoutMs,
        });
      }
      return err({
        type: "ExternalApiError",
        provider: "WorkersAI",
        message: getErrorMessage(error),
      });
    }
  };

  /**
   * Type guard to check if a value is AiTextGenerationOutput
   */
  function isTextGenerationOutput(value: AiTextGenerationOutput | TimeoutError): value is AiTextGenerationOutput {
    return "response" in value && typeof value.response === "string";
  }

  async function generateText(input: TextGenerationRequest): Promise<Result<TextGenerationResult, AppError>> {
    const model = input.model ?? input.modelId ?? defaultModel;
    const inputOptions: AiTextGenerationInput = {
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
    };

    const aiResult = await resolveAiBinding();

    // If AI binding resolution failed, check if we can use REST API
    if (aiResult.isErr()) {
      if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
        log.debug("workers-ai.generate-text.fallback-rest", { modelId: model });
        const restResult = await runRestApi(model, inputOptions);
        if (restResult.isErr()) return err(restResult.error);

        return ok({
          text: restResult.value.response ?? "",
          modelId: model,
        });
      }
      return err(aiResult.error);
    }

    const ai = aiResult.value;

    log.debug("workers-ai.generate-text.start", {
      modelId: model,
      systemPromptLength: input.systemPrompt.length,
      userPromptLength: input.userPrompt.length,
    });

    try {
      const requestPromise = ai.run(model, inputOptions) as Promise<AiTextGenerationOutput>;

      const timeoutPromise = createTimeoutPromise(timeoutMs, `Workers AI request timed out after ${timeoutMs}ms`);

      const result = await Promise.race<AiTextGenerationOutput | TimeoutError>([requestPromise, timeoutPromise]);

      if ("type" in result && result.type === "TimeoutError") {
        log.error("workers-ai.generate-text.timeout", {
          modelId: model,
          timeoutMs,
        });
        return err(result);
      }

      if (!isTextGenerationOutput(result)) {
        log.error("workers-ai.generate-text.invalid-response", {
          modelId: model,
          errorType: "ExternalApiError",
          provider: "WorkersAI",
          message: "Invalid response format",
          response: JSON.stringify(result).substring(0, 200),
        });
        return err({
          type: "ExternalApiError",
          provider: "WorkersAI",
          message: "Invalid response format",
        });
      }

      const text = result.response ?? "";

      log.debug("workers-ai.generate-text.success", {
        modelId: model,
        textLength: text.length,
      });

      return ok({
        text,
        modelId: model,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const stack = error instanceof Error ? error.stack : undefined;

      log.error("workers-ai.generate-text.error", {
        modelId: model,
        errorType: "ExternalApiError",
        provider: "WorkersAI",
        message,
        stack,
      });
      return err({
        type: "ExternalApiError",
        provider: "WorkersAI",
        message,
      });
    }
  }

  async function generateJson<T>(input: JsonGenerationRequest<T>): Promise<Result<JsonGenerationResult<T>, AppError>> {
    // Enhance system prompt to enforce JSON-only response
    const enhancedSystemPrompt = `${input.systemPrompt}\n\nIMPORTANT: You must respond with JSON only. Do not include any additional text, markdown formatting, or explanations outside the JSON structure.`;

    const textResult = await generateText({
      ...input,
      systemPrompt: enhancedSystemPrompt,
    });

    if (textResult.isErr()) {
      return err(textResult.error);
    }

    const text = textResult.value.text;
    if (!text) {
      log.error("workers-ai.generate-json.no-text", {
        errorType: "ExternalApiError",
        provider: "WorkersAI",
        message: "Response did not contain text field",
        response: JSON.stringify(textResult.value).substring(0, 200),
      });
      return err({
        type: "ExternalApiError",
        provider: "WorkersAI",
        message: "Response did not contain text field",
      });
    }

    const parseResult = parseJsonFromText<T>(text);
    if (parseResult.isErr()) {
      log.error("workers-ai.generate-json.parse-error", {
        errorType: parseResult.error.type,
        message: parseResult.error.message,
        rawValue: parseResult.error.rawValue,
      });
      return err(parseResult.error);
    }

    log.debug("workers-ai.generate-json.success", {
      modelId: textResult.value.modelId ?? "unknown",
    });

    return ok({
      value: parseResult.value,
      modelId: textResult.value.modelId,
    });
  }

  return {
    generateText,
    generateJson,
  };
}
