import { describe, it, expect } from "bun:test";
import { CoinGeckoClient } from "@/lib/coingecko-client";
import type { CoinGeckoClient as CoinGeckoSDK } from "coingecko-api-v3";
import type {
  TrendingSearchResponse,
  CoinsListResponse,
  CoinsMarketsResponse,
  GlobalMarketDataResponse,
} from "@/lib/coingecko-client";

type CoinGeckoSdkMock = {
  trending?: () => Promise<TrendingSearchResponse>;
  coinList?: () => Promise<CoinsListResponse>;
  coinMarket?: () => Promise<CoinsMarketsResponse>;
  global?: () => Promise<GlobalMarketDataResponse>;
};

function createClient(mock: CoinGeckoSdkMock): CoinGeckoClient {
  const sdk = {
    trending:
      mock.trending ??
      (async () => {
        throw new Error("Not implemented");
      }),
    coinList:
      mock.coinList ??
      (async () => {
        throw new Error("Not implemented");
      }),
    coinMarket:
      mock.coinMarket ??
      (async () => {
        throw new Error("Not implemented");
      }),
    global:
      mock.global ??
      (async () => {
        throw new Error("Not implemented");
      }),
  } as CoinGeckoSDK;

  return new CoinGeckoClient(undefined, sdk);
}

describe("CoinGeckoClient", () => {
  describe("getTrendingSearch", () => {
    it("should fetch trending search list successfully", async () => {
      const mockResponse: TrendingSearchResponse = {
        coins: [
          {
            item: {
              id: "bitcoin",
              symbol: "btc",
              name: "Bitcoin",
              market_cap_rank: 1,
            },
          },
        ],
      };

      const client = createClient({
        trending: async () => mockResponse,
      });

      const result = await client.getTrendingSearch();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.coins[0].item.id).toBe("bitcoin");
      }
    });
  });

  describe("getCoinsList", () => {
    it("should fetch coins list successfully", async () => {
      const mockResponse: CoinsListResponse = [
        { id: "bitcoin", symbol: "btc", name: "Bitcoin" },
        { id: "ethereum", symbol: "eth", name: "Ethereum" },
      ];

      const client = createClient({
        coinList: async () => mockResponse,
      });

      const result = await client.getCoinsList();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].id).toBe("bitcoin");
      }
    });
  });

  describe("getCoinsMarkets", () => {
    it("should fetch coins markets successfully", async () => {
      const mockResponse: CoinsMarketsResponse = [
        {
          id: "bitcoin",
          symbol: "btc",
          name: "Bitcoin",
          image: "https://example.com/bitcoin.png",
          current_price: 50000,
          market_cap: 1000000000000,
          market_cap_rank: 1,
          total_volume: 50000000000,
          high_24h: 51000,
          low_24h: 49000,
          price_change_24h: 1000,
          price_change_percentage_24h: 2.0,
          market_cap_change_24h: 20000000000,
          market_cap_change_percentage_24h: 2.0,
          circulating_supply: 19000000,
          total_supply: 21000000,
          max_supply: 21000000,
          ath: 69000,
          ath_change_percentage: -27.5,
          ath_date: "2021-11-10T14:24:11.849Z",
          atl: 67.81,
          atl_change_percentage: 73600.0,
          atl_date: "2013-07-06T00:00:00.000Z",
          last_updated: "2025-11-21T00:00:00.000Z",
        },
      ];

      const client = createClient({
        coinMarket: async () => mockResponse,
      });

      const result = await client.getCoinsMarkets(["bitcoin"]);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value[0].id).toBe("bitcoin");
        expect(result.value[0].current_price).toBe(50000);
      }
    });
  });

  describe("getGlobalMarketData", () => {
    it("should fetch global market data successfully", async () => {
      const mockResponse: GlobalMarketDataResponse = {
        data: {
          total_market_cap: { usd: 2000000000000 },
          total_volume: { usd: 100000000000 },
          market_cap_change_percentage_24h_usd: 2.5,
          market_cap_percentage: {
            btc: 50.0,
            eth: 20.0,
          },
          active_cryptocurrencies: 10000,
          markets: 500,
          updated_at: 1700000000,
        },
      };

      const client = createClient({
        global: async () => mockResponse,
      });

      const result = await client.getGlobalMarketData();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.data.total_market_cap.usd).toBe(2000000000000);
        expect(result.value.data.market_cap_percentage.btc).toBe(50.0);
      }
    });
  });
});
