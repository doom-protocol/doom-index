import { ok, Result } from "neverthrow";
import { logger } from "@/utils/logger";
import { TOKENS, type McMap, type TokenConfig, type TokenTicker } from "@/constants/token";
import type { AppError, ExternalApiError } from "@/types/app-error";
import { roundMc4 } from "@/lib/round";

type DexPair = {
  liquidity?: { usd?: number };
  priceUsd?: string;
};

type DexResponse = { pairs?: DexPair[] };

const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex/tokens";

const toExternalApiError = (overrides: Partial<ExternalApiError>): ExternalApiError => ({
  type: "ExternalApiError",
  provider: "DexScreener",
  message: overrides.message ?? "DexScreener error",
  ...overrides,
});

const selectHighestLiquidityPrice = (payload: DexResponse, ticker: TokenTicker, log: typeof logger): number | null => {
  const pairs = payload?.pairs ?? [];

  if (pairs.length === 0) {
    log.warn("market-cap.price.no-pairs", {
      ticker,
      reason: "DexScreener returned no pairs for this token",
    });
    return null;
  }

  let bestPrice: number | null = null;
  let highestLiquidity = -1;
  let pairsWithoutLiquidity = 0;
  let pairsWithInvalidPrice = 0;

  for (const pair of pairs) {
    const liquidityUsd = pair?.liquidity?.usd;
    if (typeof liquidityUsd !== "number") {
      pairsWithoutLiquidity++;
      continue;
    }
    if (liquidityUsd <= highestLiquidity) continue;

    const price = Number(pair.priceUsd);
    if (!Number.isFinite(price)) {
      pairsWithInvalidPrice++;
      continue;
    }

    highestLiquidity = liquidityUsd;
    bestPrice = price;
  }

  if (bestPrice === null) {
    log.warn("market-cap.price.no-valid-pair", {
      ticker,
      reason: "No pairs with valid liquidity and price found",
    });
    log.debug("market-cap.price.pair-details", {
      ticker,
      totalPairs: pairs.length,
      pairsWithoutLiquidity,
      pairsWithInvalidPrice,
    });
  }

  return bestPrice;
};

export type MarketCapService = {
  getMcMap(): Promise<Result<McMap, AppError>>;
  getRoundedMcMap(): Promise<Result<McMap, AppError>>;
};

type CreateMarketCapServiceDeps = {
  fetch?: typeof fetch;
  log?: typeof logger;
  tokens?: TokenConfig[];
};

export function createMarketCapService({
  fetch: fetchFn = fetch,
  log = logger,
  tokens = TOKENS,
}: CreateMarketCapServiceDeps = {}): MarketCapService {
  async function fetchTokenPrice(token: TokenConfig): Promise<number> {
    const url = `${DEXSCREENER_BASE}/${token.address}`;

    try {
      const response = await fetchFn(url);

      if (!response.ok) {
        log.error("market-cap.fetch.error", {
          ...toExternalApiError({ status: response.status, ticker: token.ticker }),
          statusText: response.statusText,
        });
        log.debug("market-cap.fetch.error-details", {
          ticker: token.ticker,
          url,
          status: response.status,
        });
        return 0;
      }

      const json = (await response.json()) as DexResponse;
      const price = selectHighestLiquidityPrice(json, token.ticker, log);

      if (!price || !Number.isFinite(price)) {
        return 0;
      }

      if (!token.supply || token.supply <= 0) {
        log.warn("market-cap.supply.missing", {
          ticker: token.ticker,
          reason: "Token supply is missing or invalid",
        });
        log.debug("market-cap.supply.details", {
          ticker: token.ticker,
          supply: token.supply,
        });
        return 0;
      }

      return price * token.supply;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      const stack = error instanceof Error ? error.stack : undefined;

      log.error("market-cap.fetch.exception", {
        ...toExternalApiError({ message, ticker: token.ticker }),
      });
      log.debug("market-cap.fetch.exception-details", {
        ticker: token.ticker,
        url,
        stack,
      });
      return 0;
    }
  }

  async function getMcMap(): Promise<Result<McMap, AppError>> {
    const entries: [TokenTicker, number][] = [];
    for (const token of tokens) {
      const mc = await fetchTokenPrice(token);
      entries.push([token.ticker, mc]);
    }
    return ok(Object.fromEntries(entries) as McMap);
  }

  async function getRoundedMcMap(): Promise<Result<McMap, AppError>> {
    const result = await getMcMap();
    return result.map(mc => roundMc4(mc));
  }

  return {
    getMcMap,
    getRoundedMcMap,
  };
}
