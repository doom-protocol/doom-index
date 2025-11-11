/**
 * Cloudflare KV Storage Client
 *
 * Provides unified interface for KV storage operations.
 * - put: Store value with optional TTL
 * - delete: Remove value by key
 * - list: List keys by prefix
 */

import { err, ok, Result } from "neverthrow";
import type { AppError } from "@/types/app-error";

export type KvPutOptions = {
  expirationTtl?: number;
  expiration?: number;
};

/**
 * Put a value into KV namespace
 */
export async function putKv(
  kvNamespace: KVNamespace,
  key: string,
  value: string,
  options?: KvPutOptions,
): Promise<Result<void, AppError>> {
  try {
    await kvNamespace.put(key, value, options);
    return ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      type: "StorageError",
      op: "put",
      key,
      message: `KV put failed: ${message}`,
    });
  }
}

/**
 * Delete a value from KV namespace
 */
export async function deleteKv(kvNamespace: KVNamespace, key: string): Promise<Result<void, AppError>> {
  try {
    await kvNamespace.delete(key);
    return ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      type: "StorageError",
      op: "delete",
      key,
      message: `KV delete failed: ${message}`,
    });
  }
}

/**
 * List keys from KV namespace by prefix
 */
export async function listKv(
  kvNamespace: KVNamespace,
  prefix: string,
  limit?: number,
): Promise<Result<KVNamespaceListResult<unknown, string>, AppError>> {
  try {
    return ok(
      await kvNamespace.list({
        prefix,
        limit,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      type: "StorageError",
      op: "list",
      key: prefix,
      message: `KV list failed: ${message}`,
    });
  }
}
