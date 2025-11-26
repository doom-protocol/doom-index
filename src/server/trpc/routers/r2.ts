import { get, set } from "@/lib/cache";
import { getJsonR2, joinR2Key } from "@/lib/r2";
import { TRPCError } from "@trpc/server";
import { resolveR2BucketOrThrow, resultOrThrow } from "../helpers";
import { r2GetObjectSchema } from "../schemas";
import { publicProcedure, router } from "../trpc";

export const r2Router = router({
  getJson: publicProcedure.input(r2GetObjectSchema).query(async ({ input, ctx }) => {
    const objectKey = joinR2Key(input.key);

    if (!objectKey) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid R2 object key",
      });
    }

    const cacheKey = `r2:getJson:${objectKey}`;
    const cached = await get<unknown>(cacheKey, { logger: ctx.logger });

    if (cached !== null) {
      return cached;
    }

    const bucket = resolveR2BucketOrThrow(ctx, { objectKey });
    const result = await getJsonR2<unknown>(bucket, objectKey);
    const value = resultOrThrow(result, ctx, { objectKey });
    await set(cacheKey, value, { ttlSeconds: 60, logger: ctx.logger });

    return value;
  }),
});
