import { router, publicProcedure } from "../trpc";
import { resolveR2Bucket } from "@/lib/r2";
import { archiveListSchema } from "../schemas";
import { TRPCError } from "@trpc/server";
import { createArchiveListService } from "@/services/archive-list";
import { get, set } from "@/lib/cache";

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

    // Resolve R2 bucket
    const bucketResult = resolveR2Bucket();
    if (bucketResult.isErr()) {
      ctx.logger.error("trpc.archive.list.resolve-bucket.error", {
        error: bucketResult.error,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: bucketResult.error.message,
        cause: bucketResult.error,
      });
    }

    // Create archive list service
    const archiveService = createArchiveListService({ r2Bucket: bucketResult.value });

    // List images
    const listResult = await archiveService.listImages({
      limit,
      cursor,
      startDate,
      endDate,
    });

    if (listResult.isErr()) {
      ctx.logger.error("trpc.archive.list.error", {
        error: listResult.error,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: listResult.error.message,
        cause: listResult.error,
      });
    }

    const result = listResult.value;

    await set(cacheKey, result, { ttlSeconds: 60, logger: ctx.logger });

    return result;
  }),
});
