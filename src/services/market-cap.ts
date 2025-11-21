import { ok, Result } from "neverthrow";
import { logger } from "@/utils/logger";
import { TOKENS, type McMap, type TokenConfig, type TokenTicker } from "@/constants/token";
import type { AppError, ExternalApiError } from "@/types/app-error";
import { roundMc } from "@/utils/round";

type DexPair = {
  liquidity?: { usd?: number };
  priceUsd?: string;
  marketCap?: number;
  volume?: { h24?: number };
};

type DexResponse = { pairs?: DexPair[] };

const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex/tokens";

const toExternalApiError = (overrides: Partial<ExternalApiError>): ExternalApiError => ({
  type: "ExternalApiError",
  provider: "DexScreener",
  message: overrides.message ?? "DexScreener error",
  ...overrides,
});

const selectBestMarketCap = (
  payload: DexResponse,
  ticker: TokenTicker,
  supply: number,
  log: typeof logger,
): number | null => {
  const pairs = payload?.pairs ?? [];

  if (pairs.length === 0) {
    log.warn("market-cap.price.no-pairs", {
      ticker,
      reason: "DexScreener returned no pairs for this token",
    });
    return null;
  }

  // Priority order: 1. marketCap field, 2. priceUsd * supply, 3. price * supply selected by liquidity
  let bestMc: number | null = null;
  let bestVolume = -1;
  let pairsWithInvalidMc = 0;
  let pairsWithoutPrice = 0;

  for (const pair of pairs) {
    // Use marketCap field if directly provided
    if (typeof pair.marketCap === "number" && Number.isFinite(pair.marketCap) && pair.marketCap > 0) {
      const volume = pair.volume?.h24 || 0;
      if (volume > bestVolume) {
        bestVolume = volume;
        bestMc = pair.marketCap;
      }
      continue;
    }

    // Calculate from priceUsd if marketCap is not available
    const price = pair.priceUsd ? Number(pair.priceUsd) : null;
    if (!price || !Number.isFinite(price)) {
      pairsWithoutPrice++;
      continue;
    }

    const calculatedMc = price * supply;
    if (!Number.isFinite(calculatedMc) || calculatedMc <= 0) {
      pairsWithInvalidMc++;
      continue;
    }

    // Determine priority by volume or liquidity
    const volume = pair.volume?.h24 || pair.liquidity?.usd || 0;
    if (volume > bestVolume || bestMc === null) {
      bestVolume = volume;
      bestMc = calculatedMc;
    }
  }

  if (bestMc === null) {
    log.warn("market-cap.price.no-valid-pair", {
      ticker,
      reason: "No pairs with valid marketCap or price found",
    });
    log.debug("market-cap.price.pair-details", {
      ticker,
      totalPairs: pairs.length,
      pairsWithInvalidMc,
      pairsWithoutPrice,
    });
  }

  return bestMc;
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
  async function fetchTokenMarketCap(token: TokenConfig): Promise<number> {
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

      const json = (await response.json()) as DexResponse;
      const marketCap = selectBestMarketCap(json, token.ticker, token.supply, log);

      if (!marketCap || !Number.isFinite(marketCap)) {
        return 0;
      }

      return marketCap;
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
    const entries = await Promise.all(
      tokens.map(async token => {
        const mc = await fetchTokenMarketCap(token);
        return [token.ticker, mc] as [TokenTicker, number];
      }),
    );
    return ok(Object.fromEntries(entries) as McMap);
  }

  async function getRoundedMcMap(): Promise<Result<McMap, AppError>> {
    const result = await getMcMap();
    return result.map(mc => roundMc(mc));
  }

  return {
    getMcMap,
    getRoundedMcMap,
  };
}
