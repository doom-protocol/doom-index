import { Result, err, ok } from "neverthrow";
import { tavily } from "@tavily/core";
import type { AppError, TimeoutError } from "@/types/app-error";
import { logger } from "@/utils/logger";
import { env } from "@/env";

/**
 * Input for Tavily search query
 */
export type TavilyQueryInput = {
  id: string;
  name: string;
  symbol: string;
  chainId: string;
  contractAddress: string | null;
  maxResults?: number;
};

/**
 * Tavily article structure
 */
export type TavilyArticle = {
  title: string;
  content: string;
  url: string;
};

/**
 * Tavily search result
 */
export type TavilySearchResult = {
  articles: TavilyArticle[];
  combinedText: string;
};

/**
 * Tavily client interface
 * Anti-corruption layer wrapping @tavily/core SDK
 */
export interface TavilyClient {
  searchToken(input: TavilyQueryInput): Promise<Result<TavilySearchResult, AppError>>;
}

type CreateTavilyClientDeps = {
  apiKey?: string;
  timeoutMs?: number; // Default: 5 seconds for Tavily
  log?: typeof logger;
  tavilyClient?: ReturnType<typeof tavily>;
};

/**
 * Create Tavily client
 * Anti-corruption layer that wraps @tavily/core SDK with neverthrow Result types
 *
 * @param deps - Dependencies including API key and configuration
 * @returns Tavily client instance
 */
export function createTavilyClient({
  apiKey,
  timeoutMs = 5_000,
  log = logger,
  tavilyClient,
}: CreateTavilyClientDeps = {}): TavilyClient {
  // Build search query from token metadata
  const buildQuery = (input: TavilyQueryInput): string => {
    const parts = [input.name, input.symbol, input.chainId, "token"];
    if (input.contractAddress) {
      parts.push(input.contractAddress);
    }
    return parts.filter(Boolean).join(" ");
  };

  // Extract articles from Tavily SDK response
  const extractArticles = (results: unknown[]): TavilyArticle[] => {
    return results
      .map((item: unknown) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const article = item as Record<string, unknown>;
        const title = typeof article.title === "string" ? article.title : "";
        const content =
          typeof article.content === "string"
            ? article.content
            : typeof article.snippet === "string"
              ? article.snippet
              : "";
        const url = typeof article.url === "string" ? article.url : "";

        if (!title && !content && !url) {
          return null;
        }

        return {
          title,
          content,
          url,
        };
      })
      .filter((article): article is TavilyArticle => article !== null);
  };

  // Combine articles into text
  const combineArticles = (articles: TavilyArticle[], maxLength: number = 6000): string => {
    const blocks = articles.map(article => {
      const parts = [article.title, article.content, article.url].filter(Boolean);
      return parts.join("\n");
    });

    const combined = blocks.join("\n\n");
    if (combined.length <= maxLength) {
      return combined;
    }

    // Truncate to maxLength, trying to preserve complete articles
    let truncated = "";
    for (const block of blocks) {
      if (truncated.length + block.length + 2 > maxLength) {
        break;
      }
      if (truncated) {
        truncated += "\n\n";
      }
      truncated += block;
    }

    return truncated;
  };

  // Create timeout promise
  const createTimeout = (ms: number): Promise<TimeoutError> => {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          type: "TimeoutError",
          message: `Tavily request timed out after ${ms}ms`,
          timeoutMs: ms,
        });
      }, ms);
    });
  };

  async function searchToken(input: TavilyQueryInput): Promise<Result<TavilySearchResult, AppError>> {
    const key = apiKey ?? env.TAVILY_API_KEY;
    if (!key) {
      return err({
        type: "ConfigurationError",
        message: "Tavily API key not provided. Pass apiKey parameter or ensure env.TAVILY_API_KEY is available.",
        missingVar: "TAVILY_API_KEY",
      });
    }

    const query = buildQuery(input);

    log.debug("tavily.search.start", {
      tokenId: input.id,
      symbol: input.symbol,
      chainId: input.chainId,
      query,
    });

    try {
      // Initialize Tavily SDK client (or use provided mock for testing)
      const client = tavilyClient ?? tavily({ apiKey: key });

      // Create search promise with timeout
      const searchPromise = client.search(query, {
        maxResults: input.maxResults ?? 5,
        searchDepth: "basic",
      });

      const timeoutPromise = createTimeout(timeoutMs);

      const result = await Promise.race([searchPromise, timeoutPromise]);

      // Check for timeout
      if ("type" in result && result.type === "TimeoutError") {
        log.error("tavily.search.timeout", {
          tokenId: input.id,
          symbol: input.symbol,
          timeoutMs,
        });
        return err(result);
      }

      // Extract results from SDK response
      const sdkResponse = result as { results?: unknown[] };
      const results = Array.isArray(sdkResponse.results) ? sdkResponse.results : [];

      const articles = extractArticles(results);

      log.info("tavily.search.success", {
        tokenId: input.id,
        name: input.name,
        symbol: input.symbol,
        chainId: input.chainId,
        articleCount: articles.length,
      });

      const combinedText = combineArticles(articles);

      return ok({
        articles,
        combinedText,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const stack = error instanceof Error ? error.stack : undefined;

      log.error("tavily.search.error", {
        tokenId: input.id,
        name: input.name,
        symbol: input.symbol,
        chainId: input.chainId,
        errorType: "ExternalApiError",
        provider: "Tavily",
        message,
        stack,
      });

      // Check for specific error types from SDK
      if (error instanceof Error) {
        // Check for rate limit errors (429)
        if (message.includes("429") || message.toLowerCase().includes("rate limit")) {
          return err({
            type: "ExternalApiError",
            provider: "Tavily",
            status: 429,
            message: `Rate limit exceeded: ${message}`,
          });
        }

        // Check for network errors
        if (message.includes("fetch") || message.includes("network") || message.includes("ECONNREFUSED")) {
          return err({
            type: "ExternalApiError",
            provider: "Tavily",
            message: `Network error: ${message}`,
          });
        }

        // Check for authentication errors (401)
        if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
          return err({
            type: "ExternalApiError",
            provider: "Tavily",
            status: 401,
            message: `Authentication failed: ${message}`,
          });
        }
      }

      // Generic external API error
      return err({
        type: "ExternalApiError",
        provider: "Tavily",
        message,
      });
    }
  }

  return {
    searchToken,
  };
}
