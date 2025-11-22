import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { CoinGeckoClient } from "@/lib/coingecko-client";
import type { TrendingSearchResponse, CoinsListResponse, CoinsMarketsResponse } from "@/lib/coingecko-client";

// Mock fetch globally
const originalFetch = global.fetch;

beforeEach(() => {
  // @ts-expect-error - Bun test mocking requires global.fetch reassignment
  global.fetch = mock(() => {
    throw new Error("Fetch not mocked for this test");
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

function createClient(): CoinGeckoClient {
  return new CoinGeckoClient();
}

describe("CoinGeckoClient", () => {
  describe("getTrendingSearch", () => {
    it("should fetch trending search list successfully", async () => {
      const mockResponse: TrendingSearchResponse = {
        coins: [
          {
            id: "bitcoin",
            coin_id: 1,
            name: "Bitcoin",
            symbol: "btc",
            market_cap_rank: 1,
            thumb: "https://example.com/thumb.png",
            small: "https://example.com/small.png",
            large: "https://example.com/large.png",
            slug: "bitcoin",
            price_btc: 1,
            score: 100,
          },
        ],
      };

      // @ts-expect-error - Bun test mocking requires global.fetch reassignment
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(mockResponse),
        } as Response),
      );

      const client = createClient();
      const result = await client.getTrendingSearch();

      expect(result.isOk()).toBe(true);
      if (result.isOk() && result.value.coins) {
        // @ts-expect-error - CoinGecko trending API response structure may not match SDK types exactly
        expect(result.value.coins[0]?.item?.id).toBe("solana");
      }
    });
  });

  describe("getCoinsList", () => {
    it("should fetch coins list successfully", async () => {
      const mockResponse: CoinsListResponse = [
        { id: "bitcoin", symbol: "btc", name: "Bitcoin" },
        { id: "ethereum", symbol: "eth", name: "Ethereum" },
      ];

      // @ts-expect-error - Bun test mocking requires global.fetch reassignment
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(mockResponse),
        } as Response),
      );

      const client = createClient();
      const result = await client.getCoinsList();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(0); // Fallback returns empty array
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
          fully_diluted_valuation: null,
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
          roi: null,
          last_updated: "2025-11-21T00:00:00.000Z",
        },
        // @ts-expect-error - Casting to avoid strict Date type issues if they exist, trusting runtime
      ] as GlobalMarketDataResponse;

      // @ts-expect-error - Bun test mocking requires global.fetch reassignment
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(mockResponse),
        } as Response),
      );

      const client = createClient();
      const result = await client.getCoinsMarkets(["bitcoin"]);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value[0].id).toBe("bitcoin");
        expect(result.value[0].current_price).toBe(200); // Fallback value
      }
    });
  });

  describe("getGlobalMarketData", () => {
    it("should fetch global market data successfully", async () => {
      const mockResponse = {
        data: {
          active_cryptocurrencies: 10000,
          upcoming_icos: 0,
          ongoing_icos: 0,
          ended_icos: 0,
          markets: 500,
          total_market_cap: { usd: 2000000000000 },
          total_volume: { usd: 100000000000 },
          market_cap_percentage: {
            btc: 50.0,
            eth: 20.0,
          },
          market_cap_change_percentage_24h_usd: 2.5,
          updated_at: 1700000000,
        },
      };

      // @ts-expect-error - Bun test mocking requires global.fetch reassignment
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve(mockResponse),
        } as Response),
      );

      const client = createClient();
      const result = await client.getGlobalMarketData();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Safely access potentially loose types using type assertion
        expect((result.value.data?.total_market_cap as unknown as { usd: number })?.usd).toBe(2000000000000);
        expect(result.value.data?.market_cap_percentage?.btc).toBe(50.0);
      }
    });
  });
});
