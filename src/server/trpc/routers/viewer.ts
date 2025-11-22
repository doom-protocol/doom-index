import { router, publicProcedure } from "../trpc";
import { createViewerService } from "@/services/viewer";
import { isBotUserAgent } from "@/utils/user-agent";
import { TRPCError } from "@trpc/server";
import { viewerRegisterSchema, viewerRemoveSchema } from "../schemas";

export const viewerRouter = router({
  register: publicProcedure.input(viewerRegisterSchema).mutation(async ({ input, ctx }) => {
    // Check user agent from request headers
    const requestUserAgent = ctx.headers.get("user-agent");
    if (isBotUserAgent(requestUserAgent)) {
      ctx.logger.debug("trpc.viewer.register.bot-ignored", {
        userAgent: requestUserAgent,
      });

      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Bot requests are ignored",
      });
    }

    // Also check user agent from input (sent by worker)
    if (input.userAgent && isBotUserAgent(input.userAgent)) {
      ctx.logger.debug("trpc.viewer.register.bot-ignored", {
        userAgent: input.userAgent,
        sessionId: input.sessionId,
      });

      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Bot requests are ignored",
      });
    }

    if (!ctx.kvNamespace) {
      ctx.logger.error("trpc.viewer.register.error", {
        message: "VIEWER_KV binding is not configured",
      });

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "KV not configured",
      });
    }

    const viewerService = createViewerService({
      kvNamespace: ctx.kvNamespace,
    });

    const result = await viewerService.registerViewer(input.sessionId);

    if (result.isErr()) {
      ctx.logger.error("trpc.viewer.register.error", {
        error: result.error,
        sessionId: input.sessionId,
      });

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to register viewer",
        cause: result.error,
      });
    }

    ctx.logger.debug("trpc.viewer.register.success", {
      sessionId: input.sessionId,
    });

    return { success: true };
  }),

  remove: publicProcedure.input(viewerRemoveSchema).mutation(async ({ input, ctx }) => {
    if (!ctx.kvNamespace) {
      ctx.logger.error("trpc.viewer.remove.error", {
        message: "VIEWER_KV binding is not configured",
      });

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "KV not configured",
      });
    }

    const viewerService = createViewerService({
      kvNamespace: ctx.kvNamespace,
    });

    const result = await viewerService.removeViewer(input.sessionId);

    if (result.isErr()) {
      ctx.logger.error("trpc.viewer.remove.error", {
        error: result.error,
        sessionId: input.sessionId,
      });

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to remove viewer",
        cause: result.error,
      });
    }

    ctx.logger.info("trpc.viewer.remove.success", {
      sessionId: input.sessionId,
    });

    return { success: true };
  }),

  activeCount: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.kvNamespace) {
      ctx.logger.error("trpc.viewer.activeCount.error", {
        message: "VIEWER_KV binding is not configured",
      });

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "KV not configured",
      });
    }

    const viewerService = createViewerService({
      kvNamespace: ctx.kvNamespace,
    });

    const result = await viewerService.countActiveViewers();

    if (result.isErr()) {
      ctx.logger.error("trpc.viewer.activeCount.error", {
        error: result.error,
      });

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to count active viewers",
        cause: result.error,
      });
    }

    ctx.logger.debug("trpc.viewer.activeCount.success", {
      count: result.value,
    });

    return {
      count: result.value,
      ttlSeconds: 60, // VIEWER_TTL_SECONDS from service
    };
  }),

  onCountUpdate: publicProcedure.subscription(async function* (opts) {
    const { ctx } = opts;

    if (!ctx.kvNamespace) {
      ctx.logger.error("trpc.viewer.onCountUpdate.error", {
        message: "VIEWER_KV binding is not configured",
      });

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "KV not configured",
      });
    }

    const viewerService = createViewerService({
      kvNamespace: ctx.kvNamespace,
    });

    // Send initial count
    const initialResult = await viewerService.countActiveViewers();
    if (initialResult.isOk()) {
      yield { count: initialResult.value, timestamp: Date.now() };
    }

    // Send updates every 30 seconds using a loop
    while (!opts.signal?.aborted) {
      await new Promise(resolve => setTimeout(resolve, 30000));

      if (opts.signal?.aborted) break;

      try {
        const result = await viewerService.countActiveViewers();
        if (result.isOk()) {
          yield { count: result.value, timestamp: Date.now() };
        }
      } catch (error) {
        ctx.logger.error("trpc.viewer.onCountUpdate.loop.error", {
          error,
        });
      }
    }

    ctx.logger.debug("trpc.viewer.onCountUpdate.disconnected");
  }),
});
