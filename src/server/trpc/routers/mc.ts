import { router, publicProcedure } from "../trpc";
import { createMarketCapService } from "@/services/market-cap";
import { roundMc } from "@/lib/round";
import { TOKEN_TICKERS } from "@/constants/token";
import { TRPCError } from "@trpc/server";
import { get, set } from "@/lib/cache";

const zeroMap = TOKEN_TICKERS.reduce(
  (acc, ticker) => {
    acc[ticker] = 0;
    return acc;
  },
  {} as Record<(typeof TOKEN_TICKERS)[number], number>,
);

export const mcRouter = router({
  getMarketCaps: publicProcedure.query(async ({ ctx }) => {
    const cacheKey = "mc:getMarketCaps";
    const cached = await get<{ tokens: Record<string, number> }>(cacheKey, { logger: ctx.logger });

    if (cached !== null) {
      return {
        ...cached,
        generatedAt: new Date().toISOString(),
      };
    }

    const marketCapService = createMarketCapService({
      fetch,
      log: ctx.logger,
    });

    const result = await marketCapService.getMcMap();

    if (result.isErr()) {
      ctx.logger.error("trpc.mc.getMarketCaps.error", result.error);
      const value = {
        tokens: zeroMap,
        generatedAt: new Date().toISOString(),
      };
      await set(cacheKey, value, { ttlSeconds: 60, logger: ctx.logger });
      return value;
    }

    const rounded = roundMc(result.value);
    const value = {
      tokens: rounded,
      generatedAt: new Date().toISOString(),
    };
    await set(cacheKey, value, { ttlSeconds: 60, logger: ctx.logger });

    return value;
  }),

  getRoundedMcMap: publicProcedure.query(async ({ ctx }) => {
    const cacheKey = "mc:getRoundedMcMap";
    const cached = await get<{ tokens: Record<string, number> }>(cacheKey, { logger: ctx.logger });

    if (cached !== null) {
      return {
        ...cached,
        generatedAt: new Date().toISOString(),
      };
    }

    const marketCapService = createMarketCapService({
      fetch,
      log: ctx.logger,
    });

    const result = await marketCapService.getRoundedMcMap();

    if (result.isErr()) {
      ctx.logger.error("trpc.mc.getRoundedMcMap.error", result.error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch market caps",
        cause: result.error,
      });
    }

    const value = {
      tokens: result.value,
      generatedAt: new Date().toISOString(),
    };
    await set(cacheKey, value, { ttlSeconds: 60, logger: ctx.logger });

    return value;
  }),
});
