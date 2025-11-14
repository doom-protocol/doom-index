import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// ロギングミドルウェア
const loggingMiddleware = t.middleware(async ({ path, type, next, ctx }) => {
  const start = Date.now();
  const result = await next();
  const duration = Date.now() - start;

  ctx.logger.info("trpc.procedure.executed", {
    path,
    type,
    duration,
    success: result.ok,
  });

  return result;
});

// 基本プロシージャ（ロギング付き）
export const publicProcedure = t.procedure.use(loggingMiddleware);

// ルーター作成ヘルパー
export const router = t.router;

// ミドルウェア作成ヘルパー
export const middleware = t.middleware;

// TRPCErrorをエクスポート
export { TRPCError };
