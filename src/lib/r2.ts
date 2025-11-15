/**
 * Cloudflare R2 Storage Client
 *
 * Provides unified interface for R2 storage operations.
 * - Workers environment: Uses R2 Binding (R2Bucket)
 * - Next.js environment: Uses public URL via fetch
 */

import { cache } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { err, ok, Result } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { getErrorMessage } from "@/utils/error";

export type R2PutOptions = {
  contentType?: string;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
};

export type R2GetResult = {
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export type R2ListParams = {
  limit?: number;
  cursor?: string;
  prefix?: string;
  delimiter?: string;
  include?: Array<"httpMetadata" | "customMetadata">;
  startAfter?: string;
};

const contextError = (message: string, cause?: unknown): AppError => ({
  type: "InternalError",
  message,
  cause,
});

const resolveContext = cache(() => getCloudflareContext());
const resolveContextAsync = cache(async () => getCloudflareContext({ async: true }));

/**
 * Resolve Cloudflare R2 bucket from worker context (SSR handlers)
 */
export function resolveR2Bucket(): Result<R2Bucket, AppError> {
  try {
    const { env } = resolveContext();
    const bucket = (env as Cloudflare.Env).R2_BUCKET;
    if (!bucket) {
      return err(contextError("R2_BUCKET binding is not configured on Cloudflare environment"));
    }
    return ok(bucket);
  } catch (error) {
    return err(contextError(`Failed to resolve Cloudflare context: ${getErrorMessage(error)}`, error));
  }
}

/**
 * Resolve Cloudflare R2 bucket for static routes (uses async context)
 */
export async function resolveR2BucketAsync(): Promise<Result<R2Bucket, AppError>> {
  try {
    const { env } = await resolveContextAsync();
    const bucket = (env as Cloudflare.Env).R2_BUCKET;
    if (!bucket) {
      return err(contextError("R2_BUCKET binding is not configured on Cloudflare environment"));
    }
    return ok(bucket);
  } catch (error) {
    return err(contextError(`Failed to resolve Cloudflare context asynchronously: ${getErrorMessage(error)}`, error));
  }
}

type ResolveBucketOrThrowParams = {
  r2Bucket?: R2Bucket;
  errorContext?: string;
};

/**
 * Resolve an R2 bucket, preferring a provided instance when available.
 * Throws when automatic resolution fails to keep existing service APIs synchronous.
 */
export function resolveBucketOrThrow({ r2Bucket, errorContext }: ResolveBucketOrThrowParams = {}): R2Bucket {
  if (r2Bucket) {
    return r2Bucket;
  }

  const bucketResult = resolveR2Bucket();
  if (bucketResult.isErr()) {
    const prefix = errorContext ?? "Failed to resolve R2 bucket";
    throw new Error(`${prefix}: ${bucketResult.error.message}`);
  }

  return bucketResult.value;
}

/**
 * For Workers environment: JSON storage using R2 Binding
 */
export async function putJsonR2(bucket: R2Bucket, key: string, data: unknown): Promise<Result<void, AppError>> {
  try {
    await bucket.put(key, JSON.stringify(data), {
      httpMetadata: {
        contentType: "application/json",
      },
    });
    return ok(undefined);
  } catch (error) {
    return err({
      type: "StorageError",
      op: "put",
      key,
      message: `R2 JSON put failed: ${getErrorMessage(error)}`,
    });
  }
}

/**
 * For Workers environment: JSON retrieval using R2 Binding
 */
export async function getJsonR2<T>(bucket: R2Bucket, key: string): Promise<Result<T | null, AppError>> {
  try {
    const obj = await bucket.get(key);
    if (!obj) return ok(null);

    const text = await obj.text();
    return ok(JSON.parse(text) as T);
  } catch (error) {
    return err({
      type: "StorageError",
      op: "get",
      key,
      message: `R2 JSON get failed: ${getErrorMessage(error)}`,
    });
  }
}

/**
 * For Workers environment: Image storage using R2 Binding
 */
export async function putImageR2(
  bucket: R2Bucket,
  key: string,
  buf: ArrayBuffer,
  contentType = "image/webp",
): Promise<Result<void, AppError>> {
  try {
    await bucket.put(key, buf, {
      httpMetadata: {
        contentType,
      },
    });
    return ok(undefined);
  } catch (error) {
    return err({
      type: "StorageError",
      op: "put",
      key,
      message: `R2 image put failed: ${getErrorMessage(error)}`,
    });
  }
}

/**
 * For Workers environment: Image retrieval using R2 Binding
 */
export async function getImageR2(bucket: R2Bucket, key: string): Promise<Result<ArrayBuffer | null, AppError>> {
  try {
    const obj = await bucket.get(key);
    if (!obj) return ok(null);

    const arrayBuffer = await obj.arrayBuffer();
    return ok(arrayBuffer);
  } catch (error) {
    return err({
      type: "StorageError",
      op: "get",
      key,
      message: `R2 image get failed: ${getErrorMessage(error)}`,
    });
  }
}

/**
 * List R2 objects with safe defaults and error handling
 */
export async function listR2Objects(
  bucket: R2Bucket,
  options: R2ListParams = {},
): Promise<Result<R2Objects, AppError>> {
  try {
    const listOptions: R2ListOptions = {};

    if (typeof options.limit === "number") {
      const clamped = Math.max(1, Math.min(1000, Math.floor(options.limit)));
      listOptions.limit = clamped;
    }

    if (options.prefix) {
      listOptions.prefix = options.prefix;
    }

    if (options.cursor) {
      listOptions.cursor = options.cursor;
    }

    if (options.startAfter) {
      listOptions.startAfter = options.startAfter;
    }

    if (options.delimiter) {
      listOptions.delimiter = options.delimiter;
    }

    if (options.include && options.include.length > 0) {
      listOptions.include = options.include;
    }

    const result = await bucket.list(listOptions);
    return ok(result);
  } catch (error) {
    return err({
      type: "StorageError",
      op: "list",
      key: options.prefix ?? "unknown",
      message: `R2 list failed: ${getErrorMessage(error)}`,
    });
  }
}
