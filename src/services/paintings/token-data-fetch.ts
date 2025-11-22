import { Result, ok, err } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { CoinGeckoClient } from "@/lib/coingecko-client";
import type { TokenCandidate } from "@/types/paintings";
import { logger } from "@/utils/logger";

/**
 * Token Data Fetch Service
 * Fetches token details from CoinGecko API
 * Requirements: 1A, 1B, 1C
 */
export class TokenDataFetchService {
  constructor(private readonly coinGeckoClient: CoinGeckoClient) {}

  /**
   * Fetch token details for a list of CoinGecko IDs (Requirement 1C)
   * Uses /coins/markets endpoint to fetch multiple tokens in a single request
   */
  async fetchTokenDetails(
    ids: string[],
    source: "coingecko-trending-search" | "force-override" = "coingecko-trending-search",
    metadata?: { trendingRankCgSearch?: number; forcePriority?: number },
  ): Promise<Result<TokenCandidate[], AppError>> {
    try {
      if (ids.length === 0) {
        return ok([]);
      }

      logger.debug(`[TokenDataFetchService] Fetching details for ${ids.length} tokens`);

      // Fetch market data for all tokens in a single request
      const marketsResult = await this.coinGeckoClient.getCoinsMarkets(ids, {
        vs_currency: "usd",
        order: "market_cap_desc",
        per_page: 250,
        price_change_percentage: "24h,7d",
      });

      if (marketsResult.isErr()) {
        return err(marketsResult.error);
      }

      const markets = marketsResult.value;

      // Convert to TokenCandidate array
      const candidates: TokenCandidate[] = markets.map(market => {
        // Find categories from market data if available
        // Note: CoinGecko markets API doesn't return categories, so we'll use empty array
        // Categories will be fetched separately if needed
        const categories: string[] = [];

        return {
          id: market.id ?? "unknown",
          symbol: (market.symbol ?? "unknown").toUpperCase(),
          name: market.name ?? "unknown",
          logoUrl: market.image || null,
          priceUsd: market.current_price ?? 0,
          priceChange24h: market.price_change_percentage_24h ?? 0,
          priceChange7d: 0,
          volume24hUsd: market.total_volume ?? 0,
          marketCapUsd: market.market_cap ?? 0,
          categories,
          source,
          trendingRankCgSearch: source === "coingecko-trending-search" ? metadata?.trendingRankCgSearch : undefined,
          forcePriority: source === "force-override" ? metadata?.forcePriority : undefined,
        };
      });

      logger.debug(`[TokenDataFetchService] Fetched details for ${candidates.length} tokens`);
      return ok(candidates);
    } catch (error) {
      logger.error("[TokenDataFetchService] Failed to fetch token details", { error });
      return err({
        type: "InternalError" as const,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Fetch token details from CoinGecko Trending Search (Requirement 1A)
   */
  async fetchTrendingTokens(): Promise<Result<TokenCandidate[], AppError>> {
    try {
      logger.debug("[TokenDataFetchService] Fetching trending tokens");

      const trendingResult = await this.coinGeckoClient.getTrendingSearch();

      if (trendingResult.isErr()) {
        return err(trendingResult.error);
      }

      const trending = trendingResult.value;

      // Log simplified trending data for better visibility
      const trendingSummary = {
        coins: (trending.coins ?? []).slice(0, 15).map((coin, index) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const item = (coin as any).item;
          return {
            rank: index + 1,
            id: item?.id,
            symbol: item?.symbol,
            name: item?.name,
          };
        }),
      };
      logger.debug("[TokenDataFetchService] Trending search summary", { trending: trendingSummary });

      // Extract CoinGecko IDs from trending search (max 15)
      const ids = (trending.coins ?? []).slice(0, 15).map((coin, index) => {
        // Handle nested item structure if present (API behavior vs SDK types)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const id = (coin as any).item?.id ?? (coin as any).id ?? "";
        return {
          id,
          rank: index + 1,
        };
      });

      const validIds = ids.filter(item => item.id.length > 0);
      if (validIds.length === 0) {
        logger.warn("[TokenDataFetchService] No valid trending token IDs found");
        return ok([]);
      }

      // Log trending tokens list (Requirement: All trending token list)
      // Format as structured object for better readability in logs
      const trendingTokensList = trendingSummary.coins.map(c => ({
        rank: c.rank,
        symbol: c.symbol,
        name: c.name,
      }));
      logger.info(`[TokenDataFetchService] Trending Tokens:`, { tokens: trendingTokensList });

      // Fetch details for trending tokens
      const candidatesResult = await this.fetchTokenDetails(
        validIds.map(item => item.id),
        "coingecko-trending-search",
        undefined,
      );

      if (candidatesResult.isErr()) {
        return err(candidatesResult.error);
      }

      // Add trending rank to candidates
      const candidates = candidatesResult.value.map(candidate => {
        const idData = validIds.find(item => item.id === candidate.id);
        return {
          ...candidate,
          trendingRankCgSearch: idData?.rank,
        };
      });

      return ok(candidates);
    } catch (error) {
      logger.error("[TokenDataFetchService] Failed to fetch trending tokens", { error });
      return err({
        type: "InternalError" as const,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Resolve ticker symbols to CoinGecko IDs (Requirement 1B)
   */
  async resolveTickersToIds(tickers: string[]): Promise<Result<Array<{ ticker: string; id: string }>, AppError>> {
    try {
      logger.debug(`[TokenDataFetchService] Resolving ${tickers.length} tickers to CoinGecko IDs`);

      const coinsListResult = await this.coinGeckoClient.getCoinsList();

      if (coinsListResult.isErr()) {
        return err(coinsListResult.error);
      }

      const coinsList = coinsListResult.value;
      const resolved: Array<{ ticker: string; id: string }> = [];

      for (const ticker of tickers) {
        const normalizedTicker = ticker.trim().toLowerCase();

        // Try to find by symbol first
        const coin = coinsList.find(c => {
          const symbol = c.symbol?.toLowerCase();
          const coinId = c.id?.toLowerCase();
          return symbol === normalizedTicker || coinId === normalizedTicker;
        });

        if (!coin) {
          // If not found, assume ticker is already a CoinGecko ID
          logger.warn(`[TokenDataFetchService] Ticker ${ticker} not found in coins list, using as CoinGecko ID`);
          resolved.push({ ticker, id: normalizedTicker });
        } else {
          resolved.push({ ticker, id: coin.id ?? normalizedTicker });
        }
      }

      logger.info(`[TokenDataFetchService] Resolved ${resolved.length} tickers to CoinGecko IDs`);
      return ok(resolved);
    } catch (error) {
      logger.error("[TokenDataFetchService] Failed to resolve tickers", { error });
      return err({
        type: "InternalError" as const,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
