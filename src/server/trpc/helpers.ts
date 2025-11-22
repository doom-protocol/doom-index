/**
 * tRPC Router Helper Functions
 *
 * Common patterns for error handling, R2 bucket resolution, and Result type conversion
 */

import { TRPCError } from "@trpc/server";
import type { Result } from "neverthrow";
import { resolveR2Bucket } from "@/lib/r2";
import type { AppError } from "@/types/app-error";
import type { Context } from "./context";

/**
 * Resolve R2 bucket and throw TRPCError on failure
 *
 * @param ctx - tRPC context for logging
 * @param errorContext - Additional context for error logging
 * @returns R2Bucket instance
 * @throws TRPCError if bucket resolution fails
 */
export function resolveR2BucketOrThrow(ctx: Context, errorContext?: Record<string, unknown>): R2Bucket {
  const bucketResult = resolveR2Bucket();

  if (bucketResult.isErr()) {
    ctx.logger.error("trpc.resolve-bucket.error", {
      ...errorContext,
      error: bucketResult.error,
    });

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: bucketResult.error.message,
      cause: bucketResult.error,
    });
  }

  return bucketResult.value;
}

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
