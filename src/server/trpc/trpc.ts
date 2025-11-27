import { initTRPC } from "@trpc/server";
import * as v from "valibot";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        valibotError: v.isValiError(error.cause) ? v.flatten(error.cause.issues) : null,
      },
    };
  },
});

// Logging middleware
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

// Basic procedure (with logging)
export const publicProcedure = t.procedure.use(loggingMiddleware);

// Router creation helper
export const router = t.router;
