import { Result, ok, err } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { CoinGeckoClient } from "@/lib/coingecko-client";
import { AlternativeMeClient } from "@/lib/alternative-me-client";
import { MarketSnapshotsRepository } from "@/repositories/market-snapshots-repository";
import type { MarketSnapshot } from "@/types/paintings";
import { logger } from "@/utils/logger";

/**
 * Market Data Service
 * Fetches global market data from CoinGecko and Fear & Greed Index
 * Requirements: 3, 9
 */
export class MarketDataService {
  constructor(
    private readonly coinGeckoClient: CoinGeckoClient,
    private readonly alternativeMeClient: AlternativeMeClient,
    private readonly marketSnapshotsRepository: MarketSnapshotsRepository,
  ) {}

  /**
   * Fetch global market data (Requirement 3)
   */
  async fetchGlobalMarketData(): Promise<Result<MarketSnapshot, AppError>> {
    try {
      logger.debug("[MarketDataService] Fetching global market data");

      // Fetch global market data from CoinGecko
      const globalResult = await this.coinGeckoClient.getGlobalMarketData();

      if (globalResult.isErr()) {
        return err(globalResult.error);
      }

      const globalResponse = globalResult.value;
      const global = globalResponse.data || {};

      // Fetch Fear & Greed Index (optional, continue on failure)
      let fearGreedIndex: number | null = null;
      const fgiResult = await this.alternativeMeClient.getFearGreedIndex();

      if (fgiResult.isOk()) {
        fearGreedIndex = fgiResult.value.value;
        logger.info(`[MarketDataService] Fetched Fear & Greed Index: ${fearGreedIndex}`);
      } else {
        logger.warn("[MarketDataService] Failed to fetch Fear & Greed Index, continuing without it");
      }

      // Use type assertion for properties that might be missing in SDK types but present in API
      const totalMarketCap = global.total_market_cap as Record<string, number> | undefined;
      const totalVolume = global.total_volume as Record<string, number> | undefined;

      const snapshot: MarketSnapshot = {
        totalMarketCapUsd: totalMarketCap?.usd ?? 0,
        totalVolumeUsd: totalVolume?.usd ?? 0,
        marketCapChangePercentage24hUsd: global.market_cap_change_percentage_24h_usd ?? 0,
        btcDominance: global.market_cap_percentage?.btc ?? 0,
        ethDominance: global.market_cap_percentage?.eth ?? 0,
        activeCryptocurrencies: global.active_cryptocurrencies ?? 0,
        markets: global.markets ?? 0,
        fearGreedIndex,
        updatedAt: global.updated_at ?? Math.floor(Date.now() / 1000),
      };

      logger.info("[MarketDataService] Fetched global market data successfully");
      return ok(snapshot);
    } catch (error) {
      logger.error("[MarketDataService] Failed to fetch global market data", { error });
      return err({
        type: "InternalError" as const,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Store market snapshot to D1 (Requirement 9)
   */
  async storeMarketSnapshot(snapshot: MarketSnapshot, hourBucket: string): Promise<Result<void, AppError>> {
    try {
      logger.debug(`[MarketDataService] Storing market snapshot for ${hourBucket}`);

      const now = Math.floor(Date.now() / 1000);

      const result = await this.marketSnapshotsRepository.upsert(hourBucket, {
        totalMarketCapUsd: snapshot.totalMarketCapUsd,
        totalVolumeUsd: snapshot.totalVolumeUsd,
        marketCapChangePercentage24hUsd: snapshot.marketCapChangePercentage24hUsd,
        btcDominance: snapshot.btcDominance,
        ethDominance: snapshot.ethDominance,
        activeCryptocurrencies: snapshot.activeCryptocurrencies,
        markets: snapshot.markets,
        fearGreedIndex: snapshot.fearGreedIndex,
        updatedAt: snapshot.updatedAt,
        createdAt: now,
      });

      if (result.isErr()) {
        return err(result.error);
      }

      logger.info(`[MarketDataService] Stored market snapshot for ${hourBucket}`);
      return ok(undefined);
    } catch (error) {
      logger.error(`[MarketDataService] Failed to store market snapshot for ${hourBucket}`, { error });
      return err({
        type: "StorageError" as const,
        op: "put" as const,
        key: `market_snapshots/${hourBucket}`,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
