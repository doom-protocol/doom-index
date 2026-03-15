import { resolveCloudflareEnv } from "@/lib/cloudflare-context";
import type { AppError, ConfigurationError, TimeoutError } from "@/types/app-error";
import { logger } from "@/utils/logger";
import { parseJsonFromText } from "@/utils/text";
import { createTimeoutPromise } from "@/utils/time";
import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";

/**
 * Default Workers AI model ID
 */
const DEFAULT_WORKERS_AI_MODEL = "@cf/ibm-granite/granite-4.0-h-micro" as keyof AiModels;

/**
 * Request for text generation
 */
export interface TextGenerationRequest {
  model?: keyof AiModels;
  modelId?: keyof AiModels; // Alias for model (for backward compatibility with tests)
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Text generation result
 */
interface TextGenerationResult {
  text: string;
  modelId: keyof AiModels;
}

/**
 * Request for JSON generation (extends TextGenerationRequest)
 */
export type JsonGenerationRequest<_T> = TextGenerationRequest & {
  // JSON schema can be inferred from T, but we keep it flexible
};

/**
 * JSON generation result wrapper
 */
interface JsonGenerationResult<T> {
  value: T;
  modelId?: keyof AiModels;
}

/**
 * Workers AI client interface
 */
export interface WorkersAiClient {
  generateText: (input: TextGenerationRequest) => Promise<Result<TextGenerationResult, AppError>>;
  generateJson: <T>(input: JsonGenerationRequest<T>) => Promise<Result<JsonGenerationResult<T>, AppError>>;
}

interface CreateWorkersAiClientDeps {
  aiBinding?: Ai;
  defaultModel?: keyof AiModels;
  timeoutMs?: number; // Default: 30 seconds for Workers AI
  log?: typeof logger;
}

interface WorkersAiBindings {
  AI?: Ai;
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null;
}

function getOpenAiMessageContent(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const { choices } = value;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }

  const firstChoice: unknown = choices[0];
  if (!isRecord(firstChoice)) {
    return null;
  }

  const { message } = firstChoice;
  if (!isRecord(message)) {
    return null;
  }

  return typeof message.content === "string" ? message.content : null;
}

function isTimeoutError(value: AiTextGenerationOutput | TimeoutError): value is TimeoutError {
  return "type" in value;
}

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

    try {
      const env = await resolveCloudflareEnv();
      if (!env) {
        throw new Error("Cloudflare context not available");
      }
      const binding = (env as WorkersAiBindings).AI;
      if (!binding) {
        return err({
          type: "ConfigurationError",
          message: "Cloudflare AI binding not found",
          missingVar: "AI",
        });
      }
      return ok(binding);
    } catch {
      return err({
        type: "ConfigurationError",
        message: "Cloudflare AI binding not found",
        missingVar: "AI",
      });
    }
  };

  /**
   * Type guard to check if a value is AiTextGenerationOutput or OpenAI Chat Completion format
   */
  function isTextGenerationOutput(value: AiTextGenerationOutput | TimeoutError): value is AiTextGenerationOutput {
    // Check traditional Workers AI format
    if ("response" in value && typeof value.response === "string") {
      return true;
    }

    // Check OpenAI Chat Completion format
    return getOpenAiMessageContent(value) !== null;
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

    if (aiResult.isErr()) {
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

      const timeoutPromise = createTimeoutPromise(
        timeoutMs,
        `Workers AI request timed out after ${String(timeoutMs)}ms`,
      );

      const result = await Promise.race<AiTextGenerationOutput | TimeoutError>([requestPromise, timeoutPromise]);

      if (isTimeoutError(result)) {
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

      // Extract text from either Workers AI format or OpenAI Chat Completion format
      let text = "";
      if ("response" in result && typeof result.response === "string") {
        // Traditional Workers AI format
        text = result.response;
      } else {
        // OpenAI Chat Completion format
        text = getOpenAiMessageContent(result) ?? "";
      }

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
      modelId: textResult.value.modelId,
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
