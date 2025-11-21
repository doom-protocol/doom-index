import { CoinGeckoClient as CoinGeckoSDK } from "coingecko-api-v3";
import type {
  TrendingResponse,
  CoinListResponseItem,
  CoinMarket,
  GlobalResponse,
} from "coingecko-api-v3/dist/Interface";
import { Result, ok, err } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";

/**
 * CoinGecko Trending Search Response
 */
export type TrendingSearchResponse = TrendingResponse;

/**
 * CoinGecko Coins List Response
 */
export type CoinsListResponse = CoinListResponseItem[];

/**
 * CoinGecko Coins Markets Options
 */
export type CoinsMarketsOptions = {
  vs_currency?: string;
  order?:
    | "market_cap_desc"
    | "gecko_desc"
    | "gecko_asc"
    | "market_cap_asc"
    | "volume_asc"
    | "volume_desc"
    | "id_asc"
    | "id_desc";
  per_page?: number;
  page?: number;
  sparkline?: boolean;
  price_change_percentage?: string;
};

/**
 * CoinGecko Coins Markets Response
 */
export type CoinsMarketsResponse = CoinMarket[];

/**
 * CoinGecko Global Market Data Response
 */
export type GlobalMarketDataResponse = GlobalResponse;

/**
 * CoinGecko Client Anti-Corruption Layer
 * Wraps CoinGecko TypeScript SDK and protects internal domain from external API changes
 */
export class CoinGeckoClient {
  private client: CoinGeckoSDK;
  private maxRetries = 3;
  private baseDelay = 1000; // 1 second

  constructor(apiKey?: string, client?: CoinGeckoSDK) {
    if (client) {
      this.client = client;
    } else if (apiKey) {
      this.client = new CoinGeckoSDK({}, apiKey);
    } else {
      this.client = new CoinGeckoSDK();
    }
  }

  /**
   * Get Trending Search List (Requirement 1A)
   */
  async getTrendingSearch(): Promise<Result<TrendingSearchResponse, AppError>> {
    return this.retryWithBackoff(async () => {
      try {
        logger.debug("[CoinGeckoClient] Fetching trending search list");
        const response = await this.client.trending();

        if (!response || !response.coins) {
          return err({
            type: "ExternalApiError" as const,
            provider: "coingecko",
            message: "Invalid response from CoinGecko trending search API",
          });
        }

        logger.info(`[CoinGeckoClient] Fetched ${response.coins.length} trending coins`);
        return ok(response as TrendingSearchResponse);
      } catch (error) {
        logger.error("[CoinGeckoClient] Failed to fetch trending search", { error });
        return err({
          type: "ExternalApiError" as const,
          provider: "coingecko",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  }

  /**
   * Get Coins List for ID mapping (Requirement 1B)
   */
  async getCoinsList(): Promise<Result<CoinsListResponse, AppError>> {
    return this.retryWithBackoff(async () => {
      try {
        logger.debug("[CoinGeckoClient] Fetching coins list");
        const response = await this.client.coinList({ include_platform: false });

        if (!Array.isArray(response)) {
          return err({
            type: "ExternalApiError" as const,
            provider: "coingecko",
            message: "Invalid response from CoinGecko coins list API",
          });
        }

        logger.info(`[CoinGeckoClient] Fetched ${response.length} coins`);
        return ok(response as CoinsListResponse);
      } catch (error) {
        logger.error("[CoinGeckoClient] Failed to fetch coins list", { error });
        return err({
          type: "ExternalApiError" as const,
          provider: "coingecko",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  }

  /**
   * Get Coins Markets - Batch fetch multiple coins with market data (Requirement 1C)
   */
  async getCoinsMarkets(
    ids: string[],
    options: CoinsMarketsOptions = {},
  ): Promise<Result<CoinsMarketsResponse, AppError>> {
    return this.retryWithBackoff(async () => {
      try {
        logger.debug(`[CoinGeckoClient] Fetching coins markets for ${ids.length} coins`);

        const params = {
          vs_currency: options.vs_currency || "usd",
          ids: ids.join(","),
          order: options.order || "market_cap_desc",
          per_page: options.per_page || 250,
          page: options.page || 1,
          sparkline: options.sparkline || false,
          price_change_percentage: options.price_change_percentage || "24h,7d",
        };

        const response = await this.client.coinMarket(params);

        if (!Array.isArray(response)) {
          return err({
            type: "ExternalApiError" as const,
            provider: "coingecko",
            message: "Invalid response from CoinGecko coins markets API",
          });
        }

        logger.info(`[CoinGeckoClient] Fetched market data for ${response.length} coins`);
        return ok(response as CoinsMarketsResponse);
      } catch (error) {
        logger.error("[CoinGeckoClient] Failed to fetch coins markets", { error });
        return err({
          type: "ExternalApiError" as const,
          provider: "coingecko",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  }

  /**
   * Get Global Market Data (Requirement 3)
   */
  async getGlobalMarketData(): Promise<Result<GlobalMarketDataResponse, AppError>> {
    return this.retryWithBackoff(async () => {
      try {
        logger.debug("[CoinGeckoClient] Fetching global market data");
        const response = await this.client.global();

        if (!response || !response.data) {
          return err({
            type: "ExternalApiError" as const,
            provider: "coingecko",
            message: "Invalid response from CoinGecko global API",
          });
        }

        logger.info("[CoinGeckoClient] Fetched global market data");
        return ok(response as GlobalMarketDataResponse);
      } catch (error) {
        logger.error("[CoinGeckoClient] Failed to fetch global market data", { error });
        return err({
          type: "ExternalApiError" as const,
          provider: "coingecko",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  }

  /**
   * Retry with exponential backoff
   */
  private async retryWithBackoff<T>(fn: () => Promise<Result<T, AppError>>): Promise<Result<T, AppError>> {
    let lastError: AppError | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const result = await fn();

      if (result.isOk()) {
        return result;
      }

      lastError = result.error;

      // Check if error is retryable (rate limit or network error)
      if (this.isRetryableError(result.error)) {
        const delay = this.baseDelay * Math.pow(2, attempt);
        logger.warn(`[CoinGeckoClient] Retrying after ${delay}ms (attempt ${attempt + 1}/${this.maxRetries})`);
        await this.sleep(delay);
      } else {
        // Non-retryable error, return immediately
        return result;
      }
    }

    // All retries exhausted
    return err(lastError!);
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: AppError): boolean {
    if (error.type !== "ExternalApiError") {
      return false;
    }

    // Rate limit errors (429) and network errors are retryable
    return error.status === 429 || error.message.includes("network") || error.message.includes("timeout");
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
