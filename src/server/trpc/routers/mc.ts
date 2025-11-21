import { router, publicProcedure } from "../trpc";
import { get, set } from "@/lib/cache";
import type { Logger } from "@/utils/logger";

const buildZeroMap = () => ({});

const CACHE_TTL_SECONDS = 60;

type MarketCapResponse = {
  tokens: Record<string, number>;
  generatedAt: string;
};

/**
 * Get cached market cap data or return placeholder
 * @deprecated This is a legacy API endpoint for backward compatibility.
 * The legacy 8-token system has been removed.
 */
async function getMarketCapData(cacheKey: string, source: string, logger: Logger): Promise<MarketCapResponse> {
  const cached = await get<{ tokens: Record<string, number> }>(cacheKey, { logger });

  if (cached !== null) {
    return {
      ...cached,
      generatedAt: new Date().toISOString(),
    };
  }

  const value = {
    tokens: buildZeroMap(),
    generatedAt: new Date().toISOString(),
  };

  logger.info("mc.placeholder-response", {
    reason: "legacy-market-cap-service-removed",
    source,
  });

  await set(
    cacheKey,
    { tokens: value.tokens },
    {
      ttlSeconds: CACHE_TTL_SECONDS,
      logger,
    },
  );

  return value;
}

/**
 * Legacy market cap router
 * @deprecated This router is for backward compatibility only.
 * The legacy 8-token system has been removed.
 */
export const mcRouter = router({
  getMarketCaps: publicProcedure.query(async ({ ctx }) => {
    return getMarketCapData("mc:getMarketCaps", "placeholder", ctx.logger);
  }),

  getRoundedMcMap: publicProcedure.query(async ({ ctx }) => {
    return getMarketCapData("mc:getRoundedMcMap", "placeholder-rounded", ctx.logger);
  }),
});
