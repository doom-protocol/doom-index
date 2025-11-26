import type { AlternativeMeClient } from "@/lib/alternative-me-client";
import type { CoinGeckoClient, GlobalMarketDataResponse } from "@/lib/coingecko-client";
import type { MarketSnapshotsRepository } from "@/repositories/market-snapshots-repository";
import { MarketDataService } from "@/services/paintings/market-data";
import type { AppError } from "@/types/app-error";
import { describe, expect, it } from "bun:test";
import { err, ok } from "neverthrow";

type CoinGeckoClientStub = Pick<CoinGeckoClient, "getGlobalMarketData">;
type AlternativeMeClientStub = Pick<AlternativeMeClient, "getFearGreedIndex">;
type MarketSnapshotsRepositoryStub = Pick<MarketSnapshotsRepository, "upsert">;

const createGlobalResponse = (overrides: Partial<GlobalMarketDataResponse["data"]> = {}): GlobalMarketDataResponse => ({
  data: {
    active_cryptocurrencies: overrides.active_cryptocurrencies ?? 10_000,
    upcoming_icos: overrides.upcoming_icos ?? 0,
    ongoing_icos: overrides.ongoing_icos ?? 0,
    ended_icos: overrides.ended_icos ?? 0,
    markets: overrides.markets ?? 500,
    // @ts-expect-error - Spreading test overrides with CoinGecko API types
    total_market_cap: { usd: 2_000_000_000_000, ...overrides.total_market_cap },
    // @ts-expect-error - Spreading test overrides with CoinGecko API types
    total_volume: { usd: 100_000_000_000, ...overrides.total_volume },
    market_cap_percentage: {
      btc: 50,
      eth: 20,
      ...overrides.market_cap_percentage,
    },
    market_cap_change_percentage_24h_usd: overrides.market_cap_change_percentage_24h_usd ?? 2.5,
    updated_at: overrides.updated_at ?? 1_700_000_000,
  },
});

describe("MarketDataService", () => {
  it("fetchGlobalMarketData returns snapshot with Fear & Greed Index", async () => {
    const coinGeckoClient: CoinGeckoClientStub = {
      getGlobalMarketData: async () => ok(createGlobalResponse()),
    };

    const alternativeMeClient: AlternativeMeClientStub = {
      getFearGreedIndex: async () => ok({ value: 65, valueClassification: "Greed", timestamp: 1_700_000_000 }),
    };

    const repository: MarketSnapshotsRepositoryStub = {
      upsert: async () => ok(undefined),
    };

    const service = new MarketDataService(
      coinGeckoClient as CoinGeckoClient,
      alternativeMeClient as AlternativeMeClient,
      repository as MarketSnapshotsRepository,
    );

    const result = await service.fetchGlobalMarketData();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toMatchObject({
        totalMarketCapUsd: 2_000_000_000_000,
        totalVolumeUsd: 100_000_000_000,
        marketCapChangePercentage24hUsd: 2.5,
        btcDominance: 50,
        ethDominance: 20,
        fearGreedIndex: 65,
      });
    }
  });

  it("fetchGlobalMarketData continues when Fear & Greed Index fails", async () => {
    const coinGeckoClient: CoinGeckoClientStub = {
      getGlobalMarketData: async () => ok(createGlobalResponse()),
    };

    const alternativeMeClient: AlternativeMeClientStub = {
      getFearGreedIndex: async () =>
        err({
          type: "ExternalApiError",
          provider: "alternative.me",
          message: "timeout",
        } as AppError),
    };

    const repository: MarketSnapshotsRepositoryStub = {
      upsert: async () => ok(undefined),
    };

    const service = new MarketDataService(
      coinGeckoClient as CoinGeckoClient,
      alternativeMeClient as AlternativeMeClient,
      repository as MarketSnapshotsRepository,
    );

    const result = await service.fetchGlobalMarketData();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.fearGreedIndex).toBeNull();
    }
  });

  it("storeMarketSnapshot persists via repository", async () => {
    const coinGeckoClient: CoinGeckoClientStub = {
      getGlobalMarketData: async () => ok(createGlobalResponse()),
    };

    const alternativeMeClient: AlternativeMeClientStub = {
      getFearGreedIndex: async () => ok({ value: 50, valueClassification: "Neutral", timestamp: 1_700_000_000 }),
    };

    const upsertCalls: Array<{ hourBucket: string; payload: Record<string, unknown> }> = [];
    const repository: MarketSnapshotsRepositoryStub = {
      upsert: async (hourBucket, payload) => {
        upsertCalls.push({ hourBucket, payload });
        return ok(undefined);
      },
    };

    const service = new MarketDataService(
      coinGeckoClient as CoinGeckoClient,
      alternativeMeClient as AlternativeMeClient,
      repository as MarketSnapshotsRepository,
    );

    const snapshotResult = await service.fetchGlobalMarketData();
    expect(snapshotResult.isOk()).toBe(true);
    if (snapshotResult.isOk()) {
      const storeResult = await service.storeMarketSnapshot(snapshotResult.value, "2025-11-21T18");
      expect(storeResult.isOk()).toBe(true);
      expect(upsertCalls).toHaveLength(1);
      expect(upsertCalls[0].hourBucket).toBe("2025-11-21T18");
      expect(upsertCalls[0].payload.totalMarketCapUsd).toBe(2_000_000_000_000);
    }
  });
});
