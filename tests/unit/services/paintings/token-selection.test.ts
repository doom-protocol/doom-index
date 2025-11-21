import { describe, it, expect } from "bun:test";
import { ok } from "neverthrow";
import { TokenSelectionService } from "@/services/paintings/token-selection";
import type { TokenCandidate, MarketSnapshot } from "@/types/paintings";
import type { AppError } from "@/types/app-error";
import type { SelectedToken } from "@/types/paintings";
import type { TokenDataFetchService } from "@/services/paintings/token-data-fetch";
import type { MarketDataService } from "@/services/paintings/market-data";
import type { TokensRepository } from "@/repositories/tokens-repository";

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
      fetchTrendingTokens: async () => okResult<TokenCandidate[]>([]),
      resolveTickersToIds: async () => okResult<Array<{ ticker: string; id: string }>>([]),
      fetchTokenDetails: async () => okResult<TokenCandidate[]>([]),
      ...deps.tokenDataFetchService,
    } as TokenDataFetchService;

    const marketDataService = {
      fetchGlobalMarketData: async () => okResult(createSnapshot()),
      ...deps.marketDataService,
    } as MarketDataService;

    const tokensRepository = {
      findRecentlySelected: async () => okResult([]),
      findById: async () => okResult(null),
      insert: async () => okResult(undefined),
      update: async () => okResult(undefined),
      ...deps.tokensRepository,
    } as TokensRepository;

    return new TokenSelectionService(tokenDataFetchService, marketDataService, tokensRepository);
  };

  it("selects highest scoring candidate and stores metadata", async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const service = createService({
      tokenDataFetchService: {
        fetchTrendingTokens: async () =>
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
      },
      tokensRepository: {
        findById: async () => okResult(null),
        insert: async token => {
          inserted.push(token);
          return okResult(undefined);
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
      },
      tokensRepository: {
        findRecentlySelected: async () => okResult([{ id: "fresh" } as SelectedToken]),
      },
    });

    const result = await service.selectToken();
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toMatch(/No token candidates available after filtering/);
    }
  });

  it("respects FORCE_TOKEN_LIST priority ordering", async () => {
    const fetchCalls: Array<{ ids: string[]; source?: string }> = [];
    let resolvedTickers: string[] = [];
    const service = createService({
      tokenDataFetchService: {
        resolveTickersToIds: async tickers => {
          resolvedTickers = tickers;
          return okResult(
            tickers.map(t => ({
              ticker: t,
              id: `${t.toLowerCase()}-id`,
            })),
          );
        },
        fetchTokenDetails: async (ids, source) => {
          fetchCalls.push({ ids, source });
          return okResult(
            ids.map((id, index) =>
              createCandidate({
                id,
                symbol: id.toUpperCase(),
                priceChange24h: 5 - index,
                forcePriority: index,
                source: "force-override",
              }),
            ),
          );
        },
      },
      tokensRepository: {
        findById: async () => okResult(null),
        insert: async () => okResult(undefined),
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
        resolveTickersToIds: async () => okResult([]),
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
