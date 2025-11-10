/**
 * Cloudflare R2 Storage Client
 *
 * Provides unified interface for R2 storage operations.
 * - Workers environment: Uses R2 Binding (R2Bucket)
 * - Next.js environment: Uses public URL via fetch
 */

import { err, ok, Result } from "neverthrow";
import type { AppError } from "@/types/app-error";

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
    const message = error instanceof Error ? error.message : String(error);
    return err({
      type: "StorageError",
      op: "put",
      key,
      message: `R2 JSON put failed: ${message}`,
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
    const message = error instanceof Error ? error.message : String(error);
    return err({
      type: "StorageError",
      op: "get",
      key,
      message: `R2 JSON get failed: ${message}`,
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
  r2PublicDomain: string,
): Promise<Result<string, AppError>> {
  try {
    await bucket.put(key, buf, {
      httpMetadata: {
        contentType,
      },
    });

    // Construct R2 public URL (custom domain or r2.dev)
    const url = `${r2PublicDomain}/${key}`;
    return ok(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      type: "StorageError",
      op: "put",
      key,
      message: `R2 image put failed: ${message}`,
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
    const message = error instanceof Error ? error.message : String(error);
    return err({
      type: "StorageError",
      op: "get",
      key,
      message: `R2 image get failed: ${message}`,
    });
  }
}

/**
 * For Next.js environment: JSON retrieval via public URL
 */
export async function getJsonFromPublicUrl<T>(url: string): Promise<Result<T | null, AppError>> {
  try {
    const res = await fetch(url, { cache: "no-store" });

    if (res.status === 404) {
      return ok(null);
    }

    if (!res.ok) {
      return err({
        type: "StorageError",
        op: "get",
        key: url,
        message: `HTTP ${res.status}: ${res.statusText}`,
      });
    }

    const data = (await res.json()) as T;
    return ok(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      type: "StorageError",
      op: "get",
      key: url,
      message: `Fetch JSON failed: ${message}`,
    });
  }
}

/**
 * For Next.js environment: Image retrieval via public URL
 */
export async function getImageFromPublicUrl(url: string): Promise<Result<ArrayBuffer | null, AppError>> {
  try {
    const res = await fetch(url, { cache: "no-store" });

    if (res.status === 404) {
      return ok(null);
    }

    if (!res.ok) {
      return err({
        type: "StorageError",
        op: "get",
        key: url,
        message: `HTTP ${res.status}: ${res.statusText}`,
      });
    }

    const arrayBuffer = await res.arrayBuffer();
    return ok(arrayBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      type: "StorageError",
      op: "get",
      key: url,
      message: `Fetch image failed: ${message}`,
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

export function createMemoryR2Client(r2PublicDomain = "https://r2.local"): {
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
