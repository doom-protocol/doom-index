import { router, publicProcedure } from "../trpc";
import { getJsonR2 } from "@/lib/r2";
import { tokenGetStateSchema } from "../schemas";
import type { TokenState } from "@/types/domain";
import { get, set } from "@/lib/cache";
import { resolveR2BucketOrThrow, resultOrThrow } from "../helpers";

export const tokenRouter = router({
  getState: publicProcedure.input(tokenGetStateSchema).query(async ({ input, ctx }) => {
    const cacheKey = `token:getState:${input.ticker}`;
    const cached = await get<TokenState>(cacheKey, { logger: ctx.logger });

    if (cached !== null) {
      return cached;
    }

    const bucket = resolveR2BucketOrThrow(ctx, { ticker: input.ticker });
    const result = await getJsonR2<TokenState>(bucket, `state/${input.ticker}.json`);
    const value = resultOrThrow(result, ctx, { ticker: input.ticker });

    if (!value) {
      return null;
    }

    await set(cacheKey, value, { ttlSeconds: 60, logger: ctx.logger });

    return value;
  }),
});
