import { router, publicProcedure } from "../trpc";
import { resolveR2Bucket, getJsonR2 } from "@/lib/r2";
import { tokenGetStateSchema } from "../schemas";
import type { TokenState } from "@/types/domain";
import { TRPCError } from "@trpc/server";
import { get, set } from "@/lib/cache";

export const tokenRouter = router({
  getState: publicProcedure.input(tokenGetStateSchema).query(async ({ input, ctx }) => {
    const cacheKey = `token:getState:${input.ticker}`;
    const cached = await get<TokenState>(cacheKey, { logger: ctx.logger });

    if (cached !== null) {
      return cached;
    }

    const bucketResult = resolveR2Bucket();

    if (bucketResult.isErr()) {
      ctx.logger.error("trpc.token.getState.resolve-bucket.error", {
        ticker: input.ticker,
        error: bucketResult.error,
      });

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: bucketResult.error.message,
        cause: bucketResult.error,
      });
    }

    const bucket = bucketResult.value;
    const result = await getJsonR2<TokenState>(bucket, `state/${input.ticker}.json`);

    if (result.isErr()) {
      ctx.logger.error("trpc.token.getState.error", {
        ticker: input.ticker,
        error: result.error,
      });

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: result.error.message,
        cause: result.error,
      });
    }

    const value = result.value;

    if (!value) {
      return null;
    }

    await set(cacheKey, value, { ttlSeconds: 60, logger: ctx.logger });

    return value;
  }),
});
