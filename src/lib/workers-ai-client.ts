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
export type TextGenerationResult = {
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
export type JsonGenerationResult<T> = {
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
  timeoutMs?: number; // Default: 10 seconds for Workers AI
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
  timeoutMs = 10_000, // 10 seconds default timeout for Workers AI
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
      const { env } = await getCloudflareContext({ async: true });
      const binding = (env as Cloudflare.Env).AI;
      if (!binding) {
        return err(contextError("AI binding is not configured on Cloudflare environment"));
      }
      return ok(binding);
    } catch (error) {
      return err(contextError(`Failed to resolve Cloudflare context: ${getErrorMessage(error)}`));
    }
  };

  /**
   * Type guard to check if a value is AiTextGenerationOutput
   */
  function isTextGenerationOutput(value: AiTextGenerationOutput | TimeoutError): value is AiTextGenerationOutput {
    return "response" in value && typeof value.response === "string";
  }

  async function generateText(input: TextGenerationRequest): Promise<Result<TextGenerationResult, AppError>> {
    const aiResult = await resolveAiBinding();
    if (aiResult.isErr()) return err(aiResult.error);

    const ai = aiResult.value;
    const model = input.model ?? input.modelId ?? defaultModel;

    log.debug("workers-ai.generate-text.start", {
      modelId: model,
      systemPromptLength: input.systemPrompt.length,
      userPromptLength: input.userPrompt.length,
    });

    try {
      const inputOptions: AiTextGenerationInput = {
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt },
        ],
      };

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

      log.info("workers-ai.generate-text.success", {
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

    log.info("workers-ai.generate-json.success", {
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
