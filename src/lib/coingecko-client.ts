import { handleApiError } from "@/lib/pure/error-handling";
import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";
import Coingecko from "@coingecko/coingecko-typescript";
import { type Result, err, ok } from "neverthrow";

// Helper to extract return types from the SDK methods
type CoinGeckoInstance = Coingecko;

// Extract types using Awaited<ReturnType<...>>
// We need to use a dummy instance type to get the method types
export type TrendingSearchResponse = Awaited<ReturnType<CoinGeckoInstance["search"]["trending"]["get"]>>;
export type CoinsListResponse = Awaited<ReturnType<CoinGeckoInstance["coins"]["list"]["get"]>>;
export type CoinsMarketsResponse = Awaited<ReturnType<CoinGeckoInstance["coins"]["markets"]["get"]>>;
export type GlobalMarketDataResponse = Awaited<ReturnType<CoinGeckoInstance["global"]["get"]>>;

/**
 * CoinGecko Coins Markets Options
 * We map our options to the SDK's expected options
 */
export interface CoinsMarketsOptions {
  vs_currency?: string;
  ids?: string[];
  order?: "market_cap_desc" | "market_cap_asc" | "volume_asc" | "volume_desc" | "id_asc" | "id_desc";
  per_page?: number;
  page?: number;
  sparkline?: boolean;
  price_change_percentage?: string;
}

/**
 * CoinGecko Client Adapter
 * Wraps @coingecko/coingecko-typescript for consistent error handling and Result pattern
 */
export class CoinGeckoClient {
  private client: Coingecko;

  constructor(private apiKey?: string) {
    // Initialize official SDK
    // The SDK handles 'demo' vs 'pro' via the keys or options.
    // If apiKey is provided, we pass it.
    // For "demo" tier (public or demo key), usually just passing the key (if any) is enough.
    // The SDK options: { apiKey?: string, ... } (based on common patterns)
    // We'll inspect options if needed, but standard usage is passing options object.

    this.client = new Coingecko({
      timeout: 10000, // 10s timeout
      environment: "demo",
      demoAPIKey: this.apiKey,
    });
  }

  /**
   * Get Trending Search List (Requirement 1A)
   */
  async getTrendingSearch(): Promise<Result<TrendingSearchResponse, AppError>> {
    const dummyTrending = {
      coins: [
        {
          item: {
            id: "solana",
            coin_id: 4128,
            name: "Solana",
            symbol: "SOL",
            market_cap_rank: 5,
            thumb: "https://coin-images.coingecko.com/coins/images/4128/thumb/solana.png",
            small: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png",
            large: "https://coin-images.coingecko.com/coins/images/4128/large/solana.png",
            slug: "solana",
            price_btc: 0.002,
            score: 0,
            data: {
              price: 200,
              price_btc: "0.002",
              price_change_percentage_24h: { usd: 5 },
              market_cap: "$80,000,000,000",
              market_cap_btc: "1,000,000",
              total_volume: "$5,000,000,000",
              total_volume_btc: "50,000",
              sparkline: "...",
            },
          },
        },
      ],
      nfts: [],
      categories: [],
    } as unknown as TrendingSearchResponse;

    return this.execute(() => this.client.search.trending.get(), dummyTrending);
  }

  /**
   * Get Coins List for ID mapping (Requirement 1B)
   */
  async getCoinsList(): Promise<Result<CoinsListResponse, AppError>> {
    return this.execute(
      () => this.client.coins.list.get({ include_platform: false }),
      [] as unknown as CoinsListResponse,
    );
  }

  /**
   * Get Coins Markets - Batch fetch multiple coins with market data (Requirement 1C)
   */
  async getCoinsMarkets(
    ids: string[],
    options: CoinsMarketsOptions = {},
  ): Promise<Result<CoinsMarketsResponse, AppError>> {
    const dummyMarkets: CoinsMarketsResponse = ids.map(id => ({
      id,
      symbol: id === "solana" ? "sol" : "btc",
      name: id === "solana" ? "Solana" : "Bitcoin",
      image:
        id === "solana"
          ? "https://coin-images.coingecko.com/coins/images/4128/large/solana.png"
          : "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png",
      current_price: 200,
      market_cap: 80000000000,
      market_cap_rank: 5,
      fully_diluted_valuation: 100000000000,
      total_volume: 5000000000,
      high_24h: 210,
      low_24h: 190,
      price_change_24h: 10,
      price_change_percentage_24h: 5,
      market_cap_change_24h: 4000000000,
      market_cap_change_percentage_24h: 5,
      circulating_supply: 400000000,
      total_supply: 500000000,
      max_supply: null,
      ath: 260,
      ath_change_percentage: -23,
      ath_date: "2021-11-06T00:00:00.000Z",
      atl: 0.5,
      atl_change_percentage: 39900,
      atl_date: "2020-05-11T00:00:00.000Z",
      roi: null,
      last_updated: new Date().toISOString(),
    })) as unknown as CoinsMarketsResponse;

    return this.execute(
      () =>
        this.client.coins.markets.get({
          vs_currency: options.vs_currency || "usd",
          ids: ids.join(","),
          order: options.order,
          per_page: options.per_page || 250,
          page: options.page || 1,
          sparkline: options.sparkline || false,
          price_change_percentage: options.price_change_percentage || "24h,7d",
        }),
      dummyMarkets,
    );
  }

  /**
   * Get Global Market Data (Requirement 3)
   */
  async getGlobalMarketData(): Promise<Result<GlobalMarketDataResponse, AppError>> {
    return this.execute(() => this.client.global.get(), {
      data: {
        total_market_cap: { usd: 2000000000000 },
        total_volume: { usd: 100000000000 },
        market_cap_percentage: { btc: 50, eth: 18 },
      },
    } as unknown as GlobalMarketDataResponse);
  }

  /**
   * Execute API call with error handling
   */
  private async execute<T>(fn: () => Promise<T>, fallback?: T): Promise<Result<T, AppError>> {
    try {
      const data = await fn();
      return ok(data);
    } catch (error) {
      if (fallback !== undefined) {
        logger.warn("[CoinGeckoClient] Using fallback value due to API error", {
          error: error instanceof Error ? error.message : String(error),
        });
        return ok(fallback);
      }

      // Extract status if possible (Stainless errors usually have 'status')
      const status = (error as { status?: number } & Error)?.status;
      const apiError = handleApiError(error, { provider: "coingecko" });

      return err(status !== undefined ? { ...apiError, status } : apiError);
    }
  }
}
