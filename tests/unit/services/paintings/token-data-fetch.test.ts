import { describe, expect, it } from "bun:test";
import { ok, err } from "neverthrow";
import { TokenDataFetchService } from "@/services/paintings/token-data-fetch";
import type {
  CoinGeckoClient,
  CoinsMarketsOptions,
  CoinsMarketsResponse,
  TrendingSearchResponse,
} from "@/lib/coingecko-client";
import type { CoinsListResponse } from "@/lib/coingecko-client";

type CoinGeckoClientStub = Pick<CoinGeckoClient, "getCoinsMarkets" | "getTrendingSearch" | "getCoinsList">;

const createClient = (overrides: Partial<CoinGeckoClientStub> = {}): CoinGeckoClientStub => {
  return {
    getCoinsMarkets: overrides.getCoinsMarkets ?? (async () => ok<CoinsMarketsResponse, never>([])),
    getTrendingSearch: overrides.getTrendingSearch ?? (async () => ok<TrendingSearchResponse, never>({ coins: [] })),
    getCoinsList: overrides.getCoinsList ?? (async () => ok<CoinsListResponse, never>([])),
  };
};

describe("TokenDataFetchService", () => {
  it("fetchTokenDetails returns normalized candidates", async () => {
    const coinsMarkets = ok<CoinsMarketsResponse, never>([
      {
        id: "bitcoin",
        symbol: "btc",
        name: "Bitcoin",
        image: "https://cdn.example/btc.png",
        current_price: 50000,
        price_change_percentage_24h: 2,
        market_cap: 1_000_000_000,
        total_volume: 50_000_000,
        market_cap_rank: 1,
        price_change_24h: 1000,
        market_cap_change_24h: 10_000_000,
        market_cap_change_percentage_24h: 1,
        circulating_supply: 19_000_000,
        total_supply: 21_000_000,
        max_supply: null,
        high_24h: 52000,
        low_24h: 48000,
        ath: 69000,
        ath_change_percentage: -15,
        ath_date: new Date("2021-11-10T00:00:00Z"),
        atl: 67,
        atl_change_percentage: 70000,
        atl_date: new Date("2013-07-06T00:00:00Z"),
        last_updated: new Date("2025-11-21T00:00:00Z"),
      },
    ]);

    const client = createClient({
      getCoinsMarkets: async (ids: string[], options?: CoinsMarketsOptions) => {
        expect(ids).toEqual(["bitcoin"]);
        expect(options?.vs_currency).toBe("usd");
        return coinsMarkets;
      },
    });

    const service = new TokenDataFetchService(client as CoinGeckoClient);
    const result = await service.fetchTokenDetails(["bitcoin"], "force-override", { forcePriority: 0 });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toMatchObject({
        id: "bitcoin",
        symbol: "BTC",
        name: "Bitcoin",
        logoUrl: "https://cdn.example/btc.png",
        priceUsd: 50000,
        priceChange24h: 2,
        volume24hUsd: 50_000_000,
        marketCapUsd: 1_000_000_000,
        source: "force-override",
        forcePriority: 0,
      });
    }
  });

  it("fetchTokenDetails propagates CoinGecko errors", async () => {
    const client = createClient({
      getCoinsMarkets: async () =>
        err({
          type: "ExternalApiError" as const,
          provider: "coingecko",
          message: "rate limit",
        }),
    });

    const service = new TokenDataFetchService(client as CoinGeckoClient);
    const result = await service.fetchTokenDetails(["bitcoin"]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("ExternalApiError");
    }
  });

  it("fetchTrendingTokens enriches candidates with trending rank", async () => {
    const trending = ok<TrendingSearchResponse, never>({
      coins: [{ item: { id: "bitcoin", symbol: "btc", name: "Bitcoin", market_cap_rank: 1 } }],
    });

    const markets = ok<CoinsMarketsResponse, never>([
      {
        id: "bitcoin",
        symbol: "btc",
        name: "Bitcoin",
        image: "https://cdn.example/btc.png",
        current_price: 50000,
        price_change_percentage_24h: 2,
        market_cap: 1_000_000_000,
        total_volume: 50_000_000,
        market_cap_rank: 1,
        price_change_24h: 1000,
        market_cap_change_24h: 10_000_000,
        market_cap_change_percentage_24h: 1,
        circulating_supply: 19_000_000,
        total_supply: 21_000_000,
        max_supply: null,
        high_24h: 52000,
        low_24h: 48000,
        ath: 69000,
        ath_change_percentage: -15,
        ath_date: new Date("2021-11-10T00:00:00Z"),
        atl: 67,
        atl_change_percentage: 70000,
        atl_date: new Date("2013-07-06T00:00:00Z"),
        last_updated: new Date("2025-11-21T00:00:00Z"),
      },
    ]);

    const client = createClient({
      getTrendingSearch: async () => trending,
      getCoinsMarkets: async () => markets,
    });

    const service = new TokenDataFetchService(client as CoinGeckoClient);
    const result = await service.fetchTrendingTokens();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value[0].trendingRankCgSearch).toBe(1);
      expect(result.value[0].source).toBe("coingecko-trending-search");
    }
  });

  it("resolveTickersToIds uses CoinGecko mapping with fallback", async () => {
    const coinsList = ok<CoinsListResponse, never>([{ id: "bitcoin", symbol: "btc", name: "Bitcoin" }]);

    const client = createClient({
      getCoinsList: async () => coinsList,
    });

    const service = new TokenDataFetchService(client as CoinGeckoClient);
    const result = await service.resolveTickersToIds(["BTC", "UNKNOWN"]);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([
        { ticker: "BTC", id: "bitcoin" },
        { ticker: "UNKNOWN", id: "unknown" },
      ]);
    }
  });
});
