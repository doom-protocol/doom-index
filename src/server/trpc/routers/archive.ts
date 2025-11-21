import { router, publicProcedure } from "../trpc";
import { archiveListSchema } from "../schemas";
import { createArchiveService } from "@/services/archive";
import { get, set } from "@/lib/cache";
import { resolveR2BucketOrThrow, resultOrThrow } from "../helpers";

export const archiveRouter = router({
  list: publicProcedure.input(archiveListSchema).query(async ({ input, ctx }) => {
    const { limit, cursor, startDate, endDate } = input;

    const cacheKey = `archive:list:v2:${JSON.stringify({ limit, cursor, startDate, endDate })}`;
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
    const archiveService = createArchiveService({
      r2Bucket: bucket,
      d1Binding,
    });

    // List images
    const listResult = await archiveService.listImages({
      limit,
      cursor,
      startDate,
      endDate,
    });

    const result = resultOrThrow(listResult, ctx);

    await set(cacheKey, result, { ttlSeconds: 60, logger: ctx.logger });

    return result;
  }),
});
