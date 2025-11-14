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
 * In-memory R2 client for development and testing
 */
type StoredValue = {
  content: ArrayBuffer | string;
  contentType?: string;
};

const cloneBuffer = (buffer: ArrayBuffer): ArrayBuffer => buffer.slice(0);

export function createMemoryR2Client(): {
  bucket: R2Bucket;
  store: Map<string, StoredValue>;
} {
  const store = new Map<string, StoredValue>();

  const bucket = {
    async put(key: string, value: ArrayBuffer | string, options?: R2PutOptions): Promise<void> {
      const content = value instanceof ArrayBuffer ? cloneBuffer(value) : value;
      store.set(key, {
        content,
        contentType: options?.httpMetadata?.contentType,
      });
    },

    async get(key: string): Promise<R2GetResult | null> {
      const entry = store.get(key);
      if (!entry) return null;

      const { content } = entry;

      return {
        async text() {
          if (typeof content === "string") {
            return content;
          }
          const decoder = new TextDecoder();
          return decoder.decode(content);
        },
        async arrayBuffer() {
          if (content instanceof ArrayBuffer) {
            return cloneBuffer(content);
          }
          const encoder = new TextEncoder();
          return encoder.encode(content).buffer;
        },
      };
    },
  } as unknown as R2Bucket;

  return { bucket, store };
}
