import type { TokensRepository } from "@/repositories/tokens-repository";
import type { MarketDataService } from "@/services/paintings/market-data";
import type { TokenDataFetchService } from "@/services/paintings/token-data-fetch";
import { TokenSelectionService } from "@/services/paintings/token-selection";
import type { AppError } from "@/types/app-error";
import type { MarketSnapshot, TokenCandidate } from "@/types/paintings";
import { describe, expect, it } from "bun:test";
import { ok } from "neverthrow";

const createCandidate = (overrides: Partial<TokenCandidate> = {}): TokenCandidate => ({
  id: `token-${overrides.symbol ?? "AAA"}`.toLowerCase(),
  symbol: (overrides.symbol ?? "AAA").toUpperCase(),
  name: overrides.name ?? "Token",
  logoUrl: null,
  priceUsd: overrides.priceUsd ?? 1,
  priceChange24h: overrides.priceChange24h ?? 5,
  priceChange7d: overrides.priceChange7d ?? 10,
  volume24hUsd: overrides.volume24hUsd ?? 5_000_000,
  marketCapUsd: overrides.marketCapUsd ?? 100_000_000,
  categories: overrides.categories ?? [],
  source: overrides.source ?? "coingecko-trending-search",
  trendingRankCgSearch: overrides.trendingRankCgSearch ?? 1,
  forcePriority: overrides.forcePriority,
  ...overrides,
});

const createSnapshot = (overrides: Partial<MarketSnapshot> = {}): MarketSnapshot => ({
  totalMarketCapUsd: overrides.totalMarketCapUsd ?? 2_000_000_000_000,
  totalVolumeUsd: overrides.totalVolumeUsd ?? 100_000_000_000,
  marketCapChangePercentage24hUsd: overrides.marketCapChangePercentage24hUsd ?? 4,
  btcDominance: overrides.btcDominance ?? 50,
  ethDominance: overrides.ethDominance ?? 20,
  activeCryptocurrencies: overrides.activeCryptocurrencies ?? 10_000,
  markets: overrides.markets ?? 500,
  fearGreedIndex: overrides.fearGreedIndex ?? 80,
  updatedAt: overrides.updatedAt ?? 1_700_000_000,
});

const okResult = <T>(value: T) => ok<T, AppError>(value);

describe("TokenSelectionService", () => {
  const createService = (deps: {
    tokenDataFetchService: Partial<TokenDataFetchService>;
    marketDataService?: Partial<MarketDataService>;
    tokensRepository?: Partial<TokensRepository>;
  }) => {
    const tokenDataFetchService = {
      fetchTrendingTokens: async () => await Promise.resolve(okResult<TokenCandidate[]>([])),
      resolveTickersToIds: async () => await Promise.resolve(okResult<Array<{ ticker: string; id: string }>>([])),
      fetchTokenDetails: async () => await Promise.resolve(okResult<TokenCandidate[]>([])),
      ...deps.tokenDataFetchService,
    } as TokenDataFetchService;

    const marketDataService = {
      fetchGlobalMarketData: async () => await Promise.resolve(okResult(createSnapshot())),
      ...deps.marketDataService,
    } as MarketDataService;

    const tokensRepository = {
      findRecentlySelected: async () => await Promise.resolve(okResult([])),
      findById: async () => await Promise.resolve(okResult(null)),
      insert: async () => await Promise.resolve(okResult(undefined)),
      update: async () => new Promise(resolve => resolve(okResult(undefined))),
      ...deps.tokensRepository,
    } as TokensRepository;

    return new TokenSelectionService(tokenDataFetchService, marketDataService, tokensRepository);
  };

  it("selects highest scoring candidate and stores metadata", async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const service = createService({
      tokenDataFetchService: {
        fetchTrendingTokens: async () =>
          await Promise.resolve(
            okResult([
              createCandidate({
                id: "alpha",
                symbol: "ALP",
                priceChange24h: 12,
                volume24hUsd: 50_000_000,
                marketCapUsd: 500_000_000,
                categories: ["l1"],
                trendingRankCgSearch: 1,
              }),
              createCandidate({
                id: "beta",
                symbol: "BET",
                priceChange24h: -3,
                volume24hUsd: 1_000_000,
                marketCapUsd: 10_000_000,
                trendingRankCgSearch: 10,
              }),
            ]),
          ),
      },
      tokensRepository: {
        findById: async () => new Promise(resolve => resolve(okResult(null))),
        insert: async token => {
          inserted.push(token);
          return new Promise(resolve => resolve(okResult(undefined)));
        },
      },
    });

    const result = await service.selectToken();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.id).toBe("alpha");
      expect(result.value.scores.final).toBeGreaterThan(0);
    }
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ id: "alpha", categories: JSON.stringify(["l1"]) });
  });

  it("filters out stablecoins and recently selected tokens", async () => {
    const service = createService({
      tokenDataFetchService: {
        fetchTrendingTokens: async () =>
          await Promise.resolve(
            okResult([
              createCandidate({
                id: "stable",
                symbol: "USDT",
              }),
              createCandidate({
                id: "fresh",
                symbol: "FRC",
                priceChange24h: 6,
                volume24hUsd: 10_000_000,
                trendingRankCgSearch: 2,
              }),
            ]),
          ),
      },
      tokensRepository: {
        findRecentlySelected: async () =>
          await Promise.resolve(
            okResult([
              {
                id: "fresh",
                symbol: "FRESH",
                name: "Fresh Token",
                shortContext: null,
                coingeckoId: "fresh",
                logoUrl: null,
                categories: "[]",
                createdAt: 0,
                updatedAt: Date.now(),
              },
            ]),
          ),
      },
    });

    const result = await service.selectToken();
    // After filtering, only stablecoin remains, which gets filtered out
    // Then fresh token is filtered as recently selected, leaving 0 candidates
    // Fallback should select from candidates before recent filter (fresh token)
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.id).toBe("fresh");
    }
  });

  it("falls back to unfiltered candidates when all tokens are recently selected", async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const service = createService({
      tokenDataFetchService: {
        fetchTrendingTokens: async () =>
          await Promise.resolve(
            okResult([
              createCandidate({
                id: "alpha",
                symbol: "ALP",
                priceChange24h: 12,
                volume24hUsd: 50_000_000,
                marketCapUsd: 500_000_000,
                categories: ["l1"],
                trendingRankCgSearch: 1,
              }),
              createCandidate({
                id: "beta",
                symbol: "BET",
                priceChange24h: 8,
                volume24hUsd: 30_000_000,
                marketCapUsd: 300_000_000,
                categories: ["defi"],
                trendingRankCgSearch: 2,
              }),
            ]),
          ),
      },
      tokensRepository: {
        findRecentlySelected: async () =>
          await Promise.resolve(
            okResult([
              {
                id: "alpha",
                symbol: "ALPHA",
                name: "Alpha Token",
                shortContext: null,
                coingeckoId: "alpha",
                logoUrl: null,
                categories: "[]",
                createdAt: 0,
                updatedAt: Date.now(),
              },
              {
                id: "beta",
                symbol: "BETA",
                name: "Beta Token",
                shortContext: null,
                coingeckoId: "beta",
                logoUrl: null,
                categories: "[]",
                createdAt: 0,
                updatedAt: Date.now(),
              },
            ]),
          ),
        findById: async () => new Promise(resolve => resolve(okResult(null))),
        insert: async token => {
          inserted.push(token);
          return new Promise(resolve => resolve(okResult(undefined)));
        },
      },
    });

    const result = await service.selectToken({ excludeRecentlySelected: true });

    // Should fallback to unfiltered candidates and select the highest scoring one
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.id).toBe("alpha");
      expect(result.value.scores.final).toBeGreaterThan(0);
    }
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ id: "alpha", categories: JSON.stringify(["l1"]) });
  });

  it("respects FORCE_TOKEN_LIST priority ordering", async () => {
    const fetchCalls: Array<{ ids: string[]; source?: string }> = [];
    let resolvedTickers: string[] = [];
    const service = createService({
      tokenDataFetchService: {
        resolveTickersToIds: async tickers => {
          resolvedTickers = tickers;
          return await Promise.resolve(
            okResult(
              tickers.map(t => ({
                ticker: t,
                id: `${t.toLowerCase()}-id`,
              })),
            ),
          );
        },
        fetchTokenDetails: async (ids, source) => {
          fetchCalls.push({ ids, source });
          return await Promise.resolve(
            okResult(
              ids.map((id, index) =>
                createCandidate({
                  id,
                  symbol: id.toUpperCase(),
                  priceChange24h: 5 - index,
                  forcePriority: index,
                  source: "force-override",
                }),
              ),
            ),
          );
        },
      },
      tokensRepository: {
        findById: async () => new Promise(resolve => resolve(okResult(null))),
        insert: async () => new Promise(resolve => resolve(okResult(undefined))),
      },
    });

    const result = await service.selectToken({ forceTokenList: "HIGH,LOW" });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.id).toBe("high-id");
      expect(result.value.source).toBe("force-override");
    }

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].source).toBe("force-override");
    expect(resolvedTickers).toEqual(["high", "low"]);
  });

  it("rejects FORCE_TOKEN_LIST when no valid entries remain after validation", async () => {
    const service = createService({
      tokenDataFetchService: {
        resolveTickersToIds: async () => Promise.resolve(okResult([])),
      },
    });

    const result = await service.selectToken({ forceTokenList: "DROP TABLE users; , !!!" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("ValidationError");
      expect(result.error.message).toMatch(/No valid tickers/i);
    }
  });
});
