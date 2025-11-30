import { get, set } from "@/lib/cache";
import { createPaintingsService } from "@/services/paintings";
import { CACHE_TTL_SECONDS } from "@/constants";
import * as v from "valibot";
import { resolveR2BucketOrThrow, resultOrThrow } from "../helpers";
import { paintingsListSchema } from "../schemas";
import { publicProcedure, router } from "../trpc";

export const paintingsRouter = router({
  list: publicProcedure
    .input(val => v.parse(paintingsListSchema, val))
    .query(async ({ input, ctx }) => {
      const { limit, cursor, from, to } = input;

      const cacheKey = `archive:list:v2:${JSON.stringify({ limit, cursor, from, to })}`;
      const cached = await get<{ items: unknown[]; cursor?: string; hasMore: boolean }>(cacheKey, {
        logger: ctx.logger,
      });

      if (cached !== null) {
        ctx.logger.debug("trpc.archive.list.cache-hit", {
          cacheKey,
          itemsCount: cached.items.length,
        });
        return cached;
      }

      // Resolve R2 bucket and create archive service with D1 binding
      const bucket = resolveR2BucketOrThrow(ctx);
      const d1Binding = ctx.env?.DB;
      const archiveService = createPaintingsService({
        r2Bucket: bucket,
        d1Binding,
      });

      // List images
      const listResult = await archiveService.listImages({
        limit,
        cursor,
        from,
        to,
      });

      const result = resultOrThrow(listResult, ctx);

      await set(cacheKey, result, { ttlSeconds: CACHE_TTL_SECONDS.ONE_MINUTE, logger: ctx.logger });

      return result;
    }),
});
