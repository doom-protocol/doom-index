import { preparePaintingMintMetadata } from "@/server/services/paintings/mint-preparation";
import { createPaintingsRepository } from "@/server/repositories/paintings-repository";
import { get, set } from "@/lib/cache";
import { CACHE_TTL_SECONDS } from "@/constants";
import { listImages } from "@/server/services/paintings/list";
import type { PaintingMetadata } from "@/types/paintings";
import { TRPCError } from "@trpc/server";
import * as v from "valibot";
import { resultOrThrow } from "../helpers";
import { paintingGetByIdSchema, paintingsListSchema, prepareMintMetadataSchema } from "../schemas";
import { publicProcedure, router } from "../trpc";

export const paintingsRouter = router({
  getById: publicProcedure
    .input((val) => v.parse(paintingGetByIdSchema, val))
    .query(async ({ input, ctx }) => {
      const cacheKey = `archive:painting:${input.id}`;
      const cached = await get<PaintingMetadata>(cacheKey, {
        logger: ctx.logger,
      });

      if (cached !== null) {
        ctx.logger.debug("trpc.paintings.getById.cache-hit", { id: input.id });
        return cached;
      }

      const repo = createPaintingsRepository({ d1Binding: ctx.env?.DB });
      const result = resultOrThrow(await repo.findById(input.id), ctx, {
        paintingId: input.id,
      });

      if (result === null) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Painting not found: ${input.id}`,
        });
      }

      await set(cacheKey, result, {
        ttlSeconds: CACHE_TTL_SECONDS.ONE_HOUR,
        logger: ctx.logger,
      });

      return result;
    }),
  list: publicProcedure
    .input((val) => v.parse(paintingsListSchema, val))
    .query(async ({ input, ctx }) => {
      const { limit, cursor, from, to } = input;

      const cacheKey = `archive:list:v2:${JSON.stringify({ limit, cursor, from, to })}`;
      const cached = await get<{
        items: unknown[];
        cursor?: string;
        hasMore: boolean;
      }>(cacheKey, {
        logger: ctx.logger,
      });

      if (cached !== null) {
        ctx.logger.debug("trpc.archive.list.cache-hit", {
          cacheKey,
          itemsCount: cached.items.length,
        });
        return cached;
      }

      const listResult = await listImages(ctx.env?.DB, {
        limit,
        cursor,
        from,
        to,
      });

      const result = resultOrThrow(listResult, ctx);

      await set(cacheKey, result, {
        ttlSeconds: CACHE_TTL_SECONDS.ONE_MINUTE,
        logger: ctx.logger,
      });

      return result;
    }),
  prepareMintMetadata: publicProcedure
    .input((val) => v.parse(prepareMintMetadataSchema, val))
    .mutation(async ({ ctx, input }) => {
      const result = await preparePaintingMintMetadata({
        d1Binding: ctx.env?.DB,
        paintingId: input.paintingId,
        tokenId: input.tokenId,
      });

      return resultOrThrow(result, ctx, {
        paintingId: input.paintingId,
        tokenId: input.tokenId,
      });
    }),
});
