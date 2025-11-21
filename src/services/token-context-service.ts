import { Result, ok, err } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";
import type { TokenContextRepository, TokenContextRecord } from "@/repositories/token-context-repository";
import type { TavilyClient } from "@/lib/tavily-client";
import type { WorkersAiClient } from "@/lib/workers-ai-client";

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
 * Token context output
 */
export type TokenContext = {
  shortContext: string;
  category: string;
  tags: string[];
};

/**
 * Fallback token context constant
 * Used when token context generation fails or quality check fails
 */
export const FALLBACK_TOKEN_CONTEXT: TokenContext = {
  shortContext:
    "A speculative crypto token with unclear fundamentals but strong narrative-driven price action. Symbolic themes: crowds, flickering candles, unstable altars, and volatile market winds.",
  category: "speculative",
  tags: ["speculative", "narrative-driven", "volatile"],
};

/**
 * Token context service interface
 */
export interface TokenContextService {
  generateTokenContext(input: TokenMetaInput): Promise<Result<TokenContext, AppError>>;
}

type CreateTokenContextServiceDeps = {
  repository: TokenContextRepository;
  tavilyClient: TavilyClient;
  workersAiClient: WorkersAiClient;
  log?: typeof logger;
};

/**
 * Create token context service
 *
 * @param deps - Dependencies including repository and clients
 * @returns Token context service instance
 */
export function createTokenContextService({
  repository,
  tavilyClient,
  workersAiClient,
  log = logger,
}: CreateTokenContextServiceDeps): TokenContextService {
  // Map TokenContextRecord to TokenContext
  const mapRecordToContext = (record: TokenContextRecord): TokenContext => {
    return {
      shortContext: record.shortContext,
      category: record.category ?? "",
      tags: record.tags ?? [],
    };
  };

  // Validate shortContext quality
  const validateShortContext = (shortContext: string): Result<void, AppError> => {
    const length = shortContext.length;

    if (length < 50) {
      return err({
        type: "ValidationError",
        message: `shortContext is too short (${length} characters, minimum 50). Consider using FALLBACK_TOKEN_CONTEXT.`,
        details: {
          length,
          minLength: 50,
          recommendation: "Use FALLBACK_TOKEN_CONTEXT",
        },
      });
    }

    if (length > 500) {
      return err({
        type: "ValidationError",
        message: `shortContext is too long (${length} characters, maximum 500). Consider using FALLBACK_TOKEN_CONTEXT.`,
        details: {
          length,
          maxLength: 500,
          recommendation: "Use FALLBACK_TOKEN_CONTEXT",
        },
      });
    }

    return ok(undefined);
  };

  async function generateTokenContext(input: TokenMetaInput): Promise<Result<TokenContext, AppError>> {
    log.debug("token-context-service.generate.start", {
      tokenId: input.id,
      symbol: input.symbol,
      chainId: input.chainId,
    });

    // Step 1: Try to find existing context in D1
    const d1Result = await repository.findById(input.id);

    if (d1Result.isErr()) {
      log.error("token-context-service.generate.d1-error", {
        tokenId: input.id,
        name: input.name,
        symbol: input.symbol,
        chainId: input.chainId,
        errorType: d1Result.error.type,
        message: d1Result.error.message,
      });
      return err(d1Result.error);
    }

    // Step 2: If D1 hit, return the cached context
    if (d1Result.value !== null) {
      log.info("token-context-service.generate.d1-hit", {
        tokenId: input.id,
        symbol: input.symbol,
      });

      const context = mapRecordToContext(d1Result.value);
      return ok(context);
    }

    // Step 3: D1 miss - call Tavily + Workers AI to generate context
    log.info("token-context-service.generate.d1-miss", {
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
      log.error("token-context-service.generate.tavily-error", {
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

    log.info("token-context-service.generate.tavily-success", {
      tokenId: input.id,
      symbol: input.symbol,
      articleCount: tavilyResult.value.articles.length,
    });

    // Step 3.2: Call Workers AI to generate JSON context from Tavily results
    const systemPrompt = `You are a cryptocurrency token analyst. Analyze the provided token information and generate a structured JSON response with the following fields:
- short_context: A 2-4 sentence English description of the token's purpose, narrative, and key characteristics (50-500 characters)
- category: A single word category (e.g., "meme", "defi", "nft", "governance", "utility")
- tags: An array of 2-5 relevant tags as strings (e.g., ["meme", "viral", "community-driven"])

Respond with JSON only. Do not include any additional text, markdown formatting, or explanations outside the JSON structure.`;

    const userPrompt = `Token Information:
Name: ${input.name}
Symbol: ${input.symbol}
Chain: ${input.chainId}
${input.contractAddress ? `Contract Address: ${input.contractAddress}` : ""}

Search Results:
${tavilyResult.value.combinedText}

Generate a concise context JSON for this token.`;

    type TokenContextJson = {
      short_context: string;
      category: string;
      tags: string[];
    };

    const aiResult = await workersAiClient.generateJson<TokenContextJson>({
      systemPrompt,
      userPrompt,
    });

    if (aiResult.isErr()) {
      log.error("token-context-service.generate.ai-error", {
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

    log.info("token-context-service.generate.ai-success", {
      tokenId: input.id,
      symbol: input.symbol,
      modelId: aiResult.value.modelId,
    });

    // Step 3.3: Map AI response to TokenContext and validate quality
    const aiContext = aiResult.value.value;
    const context: TokenContext = {
      shortContext: aiContext.short_context,
      category: aiContext.category,
      tags: aiContext.tags,
    };

    // Step 3.4: Validate shortContext quality
    const validationResult = validateShortContext(context.shortContext);
    if (validationResult.isErr()) {
      log.warn("token-context-service.generate.quality-check-failed", {
        tokenId: input.id,
        symbol: input.symbol,
        error: validationResult.error,
        shortContextLength: context.shortContext.length,
      });
      return err(validationResult.error);
    }

    return ok(context);
  }

  return {
    generateTokenContext,
  };
}
