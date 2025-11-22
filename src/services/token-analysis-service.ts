import { Result, ok, err } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";
import type { TavilyClient } from "@/lib/tavily-client";
import type { WorkersAiClient } from "@/lib/workers-ai-client";
import type { TokensRepository } from "@/repositories/tokens-repository";

/**
 * Token metadata input
 */
export type TokenMetaInput = {
  id: string;
  name: string;
  symbol: string;
  chainId: string;
  contractAddress: string | null;
  createdAt: string;
};

/**
 * Fallback shortContext constant
 * Used when token context generation fails or quality check fails
 */
export const FALLBACK_SHORT_CONTEXT =
  "A speculative crypto token with unclear fundamentals but strong narrative-driven price action. Symbolic themes: crowds, flickering candles, unstable altars, and volatile market winds.";

/**
 * Token analysis service interface
 */
export interface TokenAnalysisService {
  generateAndSaveShortContext(input: TokenMetaInput): Promise<Result<string, AppError>>;
}

type CreateTokenAnalysisServiceDeps = {
  tavilyClient: TavilyClient;
  workersAiClient: WorkersAiClient;
  tokensRepository: TokensRepository;
  log?: typeof logger;
};

/**
 * Create token analysis service
 *
 * @param deps - Dependencies including repository and clients
 * @returns Token analysis service instance
 */
export function createTokenAnalysisService({
  tavilyClient,
  workersAiClient,
  tokensRepository,
  log = logger,
}: CreateTokenAnalysisServiceDeps): TokenAnalysisService {
  // Validate shortContext quality
  const validateShortContext = (shortContext: string): Result<void, AppError> => {
    const length = shortContext.length;

    if (length < 50) {
      return err({
        type: "ValidationError",
        message: `shortContext is too short (${length} characters, minimum 50). Consider using FALLBACK_SHORT_CONTEXT.`,
        details: {
          length,
          minLength: 50,
          recommendation: "Use FALLBACK_SHORT_CONTEXT",
        },
      });
    }

    if (length > 1000) {
      return err({
        type: "ValidationError",
        message: `shortContext is too long (${length} characters, maximum 1000). Consider using FALLBACK_SHORT_CONTEXT.`,
        details: {
          length,
          maxLength: 1000,
          recommendation: "Use FALLBACK_SHORT_CONTEXT",
        },
      });
    }

    return ok(undefined);
  };

  async function generateAndSaveShortContext(input: TokenMetaInput): Promise<Result<string, AppError>> {
    log.debug("token-analysis-service.generate.start", {
      tokenId: input.id,
      symbol: input.symbol,
      chainId: input.chainId,
    });

    // Call Tavily + Workers AI to generate context
    log.debug("token-analysis-service.generate.start", {
      tokenId: input.id,
      symbol: input.symbol,
    });

    // Step 3.1: Call Tavily to search for token information
    const tavilyResult = await tavilyClient.searchToken({
      id: input.id,
      name: input.name,
      symbol: input.symbol,
      chainId: input.chainId,
      contractAddress: input.contractAddress,
    });

    if (tavilyResult.isErr()) {
      log.error("token-analysis-service.generate.tavily-error", {
        tokenId: input.id,
        name: input.name,
        symbol: input.symbol,
        chainId: input.chainId,
        errorType: tavilyResult.error.type,
        message: tavilyResult.error.message,
        ...(tavilyResult.error.type === "ExternalApiError" && tavilyResult.error.provider === "Tavily"
          ? { provider: tavilyResult.error.provider, status: tavilyResult.error.status }
          : {}),
      });
      return err(tavilyResult.error);
    }

    log.debug("token-analysis-service.generate.tavily-success", {
      tokenId: input.id,
      symbol: input.symbol,
      articleCount: tavilyResult.value.articles.length,
    });

    // Step 3.2: Call Workers AI to generate JSON context from Tavily results
    const systemPrompt = `You are a cryptocurrency token analyst. Analyze the provided token information and generate a structured JSON response with the following field:
- short_context: A 2-6 sentence English description of the token's purpose, narrative, and key characteristics (50-1000 characters)

Respond with JSON only. Do not include any additional text, markdown formatting, or explanations outside the JSON structure.`;

    const userPrompt = `Token Information:
Name: ${input.name}
Symbol: ${input.symbol}
Chain: ${input.chainId}
${input.contractAddress ? `Contract Address: ${input.contractAddress}` : ""}

Search Results:
${tavilyResult.value.combinedText}

Generate a concise context JSON for this token.`;

    // Log the prompts sent to LLM (Requirement: Prompt used for short context)
    log.info("token-analysis-service.generate.ai-prompt", {
      systemPrompt,
      userPrompt,
    });

    type TokenContextJson = {
      short_context: string;
    };

    const aiResult = await workersAiClient.generateJson<TokenContextJson>({
      systemPrompt,
      userPrompt,
    });

    if (aiResult.isErr()) {
      log.error("token-analysis-service.generate.ai-error", {
        tokenId: input.id,
        name: input.name,
        symbol: input.symbol,
        chainId: input.chainId,
        errorType: aiResult.error.type,
        message: aiResult.error.message,
        ...(aiResult.error.type === "ExternalApiError" && aiResult.error.provider === "WorkersAI"
          ? { provider: aiResult.error.provider }
          : {}),
      });
      return err(aiResult.error);
    }

    log.debug("token-analysis-service.generate.ai-success", {
      tokenId: input.id,
      symbol: input.symbol,
      modelId: aiResult.value.modelId,
    });

    // Step 3.3: Map AI response to TokenContext and validate quality
    const aiContext = aiResult.value.value;
    let validShortContext: string;

    // Defensively check if short_context exists and is a string
    if (typeof aiContext.short_context !== "string") {
      log.warn("token-analysis-service.generate.invalid-response-format", {
        tokenId: input.id,
        symbol: input.symbol,
        modelId: aiResult.value.modelId,
        receivedValue: aiContext,
        action: "using_fallback_context",
      });
      validShortContext = FALLBACK_SHORT_CONTEXT;
    } else {
      const shortContext = aiContext.short_context;

      // Step 3.4: Validate shortContext quality
      const validationResult = validateShortContext(shortContext);

      if (validationResult.isErr()) {
        log.warn("token-analysis-service.generate.quality-check-failed", {
          tokenId: input.id,
          symbol: input.symbol,
          error: validationResult.error,
          shortContextLength: shortContext.length,
          action: "using_fallback_context",
        });
        // Use fallback context if validation fails
        validShortContext = FALLBACK_SHORT_CONTEXT;
      } else {
        validShortContext = shortContext;
      }
    }

    // Step 3.5: Save shortContext to tokens table
    const saveResult = await tokensRepository.updateShortContext(input.id, validShortContext);
    if (saveResult.isErr()) {
      log.warn("token-analysis-service.generate.save-short-context-failed", {
        tokenId: input.id,
        symbol: input.symbol,
        error: saveResult.error,
      });
      // Return error if save fails, as this function's purpose is to save
      return err(saveResult.error);
    }

    log.info("token-analysis-service.generate.short-context-saved", {
      tokenId: input.id,
      symbol: input.symbol,
      shortContext: validShortContext, // Requirement: Short context output
    });

    return ok(validShortContext);
  }

  return {
    generateAndSaveShortContext,
  };
}
