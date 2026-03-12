/**
 * tRPC Router Helper Functions
 *
 * Common patterns for error handling and Result type conversion
 */

import type { AppError } from "@/types/app-error";
import { TRPCError } from "@trpc/server";
import type { Result } from "neverthrow";
import type { Context } from "./context";

/**
 * Handle Result<T, AppError> with custom error handling
 *
 * @param result - Result to handle
 * @param ctx - tRPC context for logging
 * @param onError - Custom error handler (optional)
 * @param errorContext - Additional context for error logging
 * @returns Value from Result or result of onError
 */
function handleResult<T, R = T>(
  result: Result<T, AppError>,
  ctx: Context,
  onError?: (error: AppError) => R,
  errorContext?: Record<string, unknown>,
): T | R {
  if (result.isErr()) {
    ctx.logger.error("trpc.result.error", {
      ...errorContext,
      error: result.error,
    });

    if (onError) {
      return onError(result.error);
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: result.error.message,
      cause: result.error,
    });
  }

  return result.value;
}

/**
 * Convert Result<T, AppError> to value or throw TRPCError
 *
 * @param result - Result to convert
 * @param ctx - tRPC context for logging
 * @param errorContext - Additional context for error logging
 * @returns Value from Result
 * @throws TRPCError if result is error
 */
export function resultOrThrow<T>(result: Result<T, AppError>, ctx: Context, errorContext?: Record<string, unknown>): T {
  return handleResult(result, ctx, undefined, errorContext);
}
