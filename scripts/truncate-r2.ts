#!/usr/bin/env bun

/**
 * Truncate R2 Bucket Script
 *
 * This script removes ALL objects from the R2 bucket
 * and deletes ALL records from D1 paintings table.
 *
 * Usage:
 *   # Using npm scripts (recommended):
 *   bun run truncate-r2:dry-run  # Preview what will be deleted
 *   bun run truncate-r2          # Actually delete all objects and D1 records
 *
 *   # Or directly:
 *   bun --env-file=.dev.vars scripts/truncate-r2.ts --dry-run  # Preview
 *   bun --env-file=.dev.vars scripts/truncate-r2.ts            # Delete
 *
 * Environment Variables (REQUIRED):
 *   These can be set in .dev.vars or .example.vars file:
 *
 *   For R2 (remote access):
 *   - R2_ACCESS_KEY_ID: R2 API Token Access Key ID
 *   - R2_SECRET_ACCESS_KEY: R2 API Token Secret Access Key
 *   - CF_ACCOUNT_ID: Cloudflare Account ID
 *   - R2_BUCKET_NAME: R2 Bucket Name (optional, defaults to "doom-index-storage")
 *
 *   For D1 (remote access):
 *   - CLOUDFLARE_ACCOUNT_ID: Cloudflare Account ID
 *   - CLOUDFLARE_DATABASE_ID: D1 Database ID
 *   - CLOUDFLARE_D1_TOKEN: Cloudflare API Token with D1 permissions
 *
 * NOTE: This script only works with remote R2 buckets and D1 databases.
 *       Local R2 buckets and D1 databases are not affected.
 */

import { logger } from "@/utils/logger";
import { err, ok, Result } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

type Args = {
  dryRun: boolean;
};

type R2Client = {
  list: (options: { prefix?: string; cursor?: string; limit?: number }) => Promise<Result<R2Objects, AppError>>;
  delete: (keys: string[]) => Promise<Result<void, AppError>>;
};

type R2Object = {
  key: string;
  size: number;
  etag: string;
  uploaded: Date;
};

type R2Objects = {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
};

/**
 * Create S3-compatible R2 client using environment variables
 */
function createR2ClientFromEnv(): Result<R2Client, AppError> {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const accountId = process.env.CF_ACCOUNT_ID;
  const bucketName = process.env.R2_BUCKET_NAME || "doom-index-storage";

  if (!accessKeyId || !secretAccessKey || !accountId) {
    return err({
      type: "InternalError",
      message:
        "Missing R2 credentials. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and CF_ACCOUNT_ID environment variables.",
    });
  }

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const s3Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });

  return ok({
    async list(options: { prefix?: string; cursor?: string; limit?: number }): Promise<Result<R2Objects, AppError>> {
      try {
        const command = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: options.prefix,
          ContinuationToken: options.cursor,
          MaxKeys: options.limit ? Math.min(options.limit, 1000) : undefined,
        });

        const response = await s3Client.send(command);

        const objects: R2Object[] =
          response.Contents?.map(obj => ({
            key: obj.Key || "",
            size: obj.Size || 0,
            etag: obj.ETag?.replace(/"/g, "") || "",
            uploaded: obj.LastModified || new Date(),
          })) || [];

        return ok({
          objects,
          truncated: response.IsTruncated || false,
          cursor: response.NextContinuationToken,
        });
      } catch (error) {
        return err({
          type: "StorageError",
          op: "list",
          key: options.prefix ?? "unknown",
          message: `R2 list failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },

    async delete(keys: string[]): Promise<Result<void, AppError>> {
      try {
        // R2 S3 API supports delete up to 1000 keys per request
        const batches: string[][] = [];
        for (let i = 0; i < keys.length; i += 1000) {
          batches.push(keys.slice(i, i + 1000));
        }

        for (const batch of batches) {
          const command = new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: {
              Objects: batch.map(key => ({ Key: key })),
            },
          });

          await s3Client.send(command);
        }

        return ok(undefined);
      } catch (error) {
        return err({
          type: "StorageError",
          op: "delete",
          key: keys[0] ?? "unknown",
          message: `R2 delete failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

const parseArgs = (): Args => {
  const args = Bun.argv.slice(2);
  const parsed: Partial<Args> = {
    dryRun: false,
  };

  for (const arg of args) {
    if (arg === "--dry-run" || arg === "-d") {
      parsed.dryRun = true;
    }
  }

  return parsed as Args;
};

/**
 * Execute SQL query on D1 database using D1 HTTP API
 */
async function executeD1Query(sql: string, params: unknown[] = []): Promise<Result<unknown[], AppError>> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_DATABASE_ID;
  const token = process.env.CLOUDFLARE_D1_TOKEN;

  if (!accountId || !databaseId || !token) {
    return err({
      type: "InternalError",
      message:
        "Missing D1 credentials. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, and CLOUDFLARE_D1_TOKEN environment variables.",
    });
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql,
        params,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return err({
        type: "StorageError",
        op: "list",
        key: "d1",
        message: `D1 query failed: ${response.status} ${response.statusText} - ${errorText}`,
      });
    }

    const result = (await response.json()) as {
      success: boolean;
      results?: unknown[];
      result?: unknown[];
      errors?: unknown[];
    };
    if (!result.success) {
      return err({
        type: "StorageError",
        op: "list",
        key: "d1",
        message: `D1 query failed: ${JSON.stringify(result.errors || result)}`,
      });
    }

    // D1 HTTP API returns results in different formats
    const results = result.results || result.result || [];
    return ok(results);
  } catch (error) {
    return err({
      type: "StorageError",
      op: "list",
      key: "d1",
      message: `D1 query failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * Delete all records from D1 paintings table
 */
async function deleteD1Records(dryRun: boolean): Promise<Result<number, AppError>> {
  try {
    if (dryRun) {
      // Count records that would be deleted
      const countResult = await executeD1Query(`SELECT COUNT(*) as count FROM paintings`, []);

      if (countResult.isErr()) {
        return err(countResult.error);
      }

      // Handle different response formats
      const results = countResult.value;
      let count = 0;

      if (Array.isArray(results) && results.length > 0) {
        const firstResult = results[0];
        if (Array.isArray(firstResult) && firstResult.length > 0) {
          count =
            typeof firstResult[0] === "number" ? firstResult[0] : (firstResult[0] as { count: number })?.count || 0;
        } else if (typeof firstResult === "object" && firstResult !== null) {
          count = (firstResult as { count: number })?.count || 0;
        }
      }

      logger.info("truncate.d1.dry-run", {
        recordsToDelete: count,
      });

      return ok(count);
    }

    // Actually delete records
    const countResult = await executeD1Query(`SELECT COUNT(*) as count FROM paintings`, []);

    if (countResult.isErr()) {
      return err(countResult.error);
    }

    // Handle different response formats
    const results = countResult.value;
    let countBefore = 0;

    if (Array.isArray(results) && results.length > 0) {
      const firstResult = results[0];
      if (Array.isArray(firstResult) && firstResult.length > 0) {
        countBefore =
          typeof firstResult[0] === "number" ? firstResult[0] : (firstResult[0] as { count: number })?.count || 0;
      } else if (typeof firstResult === "object" && firstResult !== null) {
        countBefore = (firstResult as { count: number })?.count || 0;
      }
    }

    // Delete all records
    const deleteResult = await executeD1Query(`DELETE FROM paintings`, []);

    if (deleteResult.isErr()) {
      return err(deleteResult.error);
    }

    logger.info("truncate.d1.delete.complete", {
      deletedCount: countBefore,
    });

    return ok(countBefore);
  } catch (error) {
    return err({
      type: "StorageError",
      op: "delete",
      key: "paintings",
      message: `D1 delete failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * Collect all objects to delete
 */
async function collectObjectsToDelete(
  client: R2Client,
): Promise<{ toDelete: string[]; stats: { webp: number; json: number; other: number } }> {
  const toDelete: string[] = [];
  const stats = { webp: 0, json: 0, other: 0 };
  let cursor: string | undefined;

  logger.info("truncate.scanning");

  // Collect all objects
  do {
    const listResult = await client.list({
      cursor,
      limit: 1000,
    });

    if (listResult.isErr()) {
      logger.error("truncate.list.failed", {
        error: listResult.error.message,
      });
      throw new Error(`Failed to list objects: ${listResult.error.message}`);
    }

    for (const obj of listResult.value.objects) {
      // Delete all objects
      if (obj.key.endsWith(".webp")) {
        stats.webp++;
      } else if (obj.key.endsWith(".json")) {
        stats.json++;
      } else {
        stats.other++;
      }
      toDelete.push(obj.key);
      logger.debug("truncate.marked", { key: obj.key });
    }

    cursor = listResult.value.truncated ? listResult.value.cursor : undefined;

    logger.debug("truncate.scanning.progress", {
      collected: toDelete.length,
      hasMore: Boolean(cursor),
    });
  } while (cursor);

  logger.info("truncate.scanning.complete", {
    totalObjects: toDelete.length,
    stats,
  });

  return {
    toDelete,
    stats,
  };
}

async function main() {
  const args = parseArgs();

  logger.info("truncate.starting", {
    dryRun: args.dryRun,
  });

  // Only use remote R2 client (local R2 buckets are not affected)
  const envClientResult = createR2ClientFromEnv();
  if (envClientResult.isErr()) {
    logger.error("truncate.client.creation.failed", {
      error: envClientResult.error.message,
    });
    console.error("❌ Failed to create R2 client:", envClientResult.error.message);
    console.error("\n💡 This script only works with remote R2 buckets.");
    console.error("   Set these environment variables to access remote R2:");
    console.error("   - R2_ACCESS_KEY_ID");
    console.error("   - R2_SECRET_ACCESS_KEY");
    console.error("   - CF_ACCOUNT_ID");
    console.error("   - R2_BUCKET_NAME (optional, defaults to 'doom-index-storage')");
    console.error("\n⚠️  Local R2 buckets are NOT affected by this script.");
    process.exit(1);
  }

  const client = envClientResult.value;
  logger.info("truncate.client.created.from-env");

  // Verify D1 credentials are available
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_DATABASE_ID;
  const token = process.env.CLOUDFLARE_D1_TOKEN;
  const hasD1Credentials = Boolean(accountId && databaseId && token);

  if (!hasD1Credentials) {
    logger.warn("truncate.d1.credentials.missing", {
      message: "D1 credentials not found. R2 objects will be deleted but D1 records will not be updated.",
    });
    console.warn("⚠️  D1 credentials not found.");
    console.warn("   R2 objects will be deleted, but D1 records will NOT be updated.");
    console.warn("   To also delete D1 records, set these environment variables:");
    console.warn("   - CLOUDFLARE_ACCOUNT_ID");
    console.warn("   - CLOUDFLARE_DATABASE_ID");
    console.warn("   - CLOUDFLARE_D1_TOKEN");
  } else {
    logger.info("truncate.d1.credentials.verified");
  }

  try {
    // Collect all objects to delete from R2
    const { toDelete, stats } = await collectObjectsToDelete(client);

    // Check D1 records to delete
    let d1RecordsToDelete = 0;
    if (hasD1Credentials) {
      const d1DeleteResult = await deleteD1Records(args.dryRun);
      if (d1DeleteResult.isErr()) {
        logger.error("truncate.d1.check.failed", {
          error: d1DeleteResult.error.message,
        });
        console.error("❌ Failed to check D1 records:", d1DeleteResult.error.message);
        console.error("⚠️  Continuing with R2 deletion only...");
      } else {
        d1RecordsToDelete = d1DeleteResult.value;
      }
    }

    logger.info("truncate.analysis.complete", {
      totalToDelete: toDelete.length,
      stats,
      d1RecordsToDelete,
    });

    if (toDelete.length === 0 && d1RecordsToDelete === 0) {
      console.log("✅ No objects found. R2 bucket and D1 database are already empty.");
      return;
    }

    // Group by type for reporting
    const webpToDelete = toDelete.filter(k => k.endsWith(".webp"));
    const jsonToDelete = toDelete.filter(k => k.endsWith(".json"));
    const otherToDelete = toDelete.filter(k => !k.endsWith(".webp") && !k.endsWith(".json"));

    console.log("\n📊 Objects to delete:");
    console.log(`  R2 Objects:`);
    console.log(`    - ${webpToDelete.length} .webp files`);
    console.log(`    - ${jsonToDelete.length} .json files`);
    console.log(`    - ${otherToDelete.length} other files`);
    console.log(`    Total: ${toDelete.length} objects`);
    if (d1RecordsToDelete > 0) {
      console.log(`  D1 Records:`);
      console.log(`    - ${d1RecordsToDelete} paintings records`);
    }
    console.log(`  Total: ${toDelete.length + d1RecordsToDelete} items\n`);

    if (args.dryRun) {
      console.log("🔍 DRY RUN MODE - No objects or records will be deleted\n");
      console.log("Sample objects to delete (first 10):");
      toDelete.slice(0, 10).forEach(key => {
        console.log(`  - ${key}`);
      });
      if (toDelete.length > 10) {
        console.log(`  ... and ${toDelete.length - 10} more`);
      }
      console.log("\n💡 Run without --dry-run to actually delete these objects and records.");
      return;
    }

    // Confirm deletion
    console.log("⚠️  WARNING: This will permanently delete:");
    console.log(`   - ${toDelete.length} R2 objects (ALL objects in bucket)`);
    if (d1RecordsToDelete > 0) {
      console.log(`   - ${d1RecordsToDelete} D1 records (ALL records in paintings)`);
    }
    console.log("Press Ctrl+C to cancel, or wait 5 seconds to proceed...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete objects using client
    const deleteResult = await client.delete(toDelete);
    if (deleteResult.isErr()) {
      logger.error("truncate.delete.failed", {
        error: deleteResult.error.message,
      });
      console.error("❌ Failed to delete objects:", deleteResult.error.message);
      process.exit(1);
    }

    const deletedCount = toDelete.length;
    logger.info("truncate.r2.delete.complete", {
      deletedCount,
    });
    console.log(`✅ Successfully deleted ${deletedCount} R2 objects`);

    // Delete D1 records
    if (hasD1Credentials && d1RecordsToDelete > 0) {
      const d1DeleteResult = await deleteD1Records(false);
      if (d1DeleteResult.isErr()) {
        logger.error("truncate.d1.delete.failed", {
          error: d1DeleteResult.error.message,
        });
        console.error("❌ Failed to delete D1 records:", d1DeleteResult.error.message);
        console.error("⚠️  R2 objects were deleted but D1 records remain. Manual cleanup may be required.");
      } else {
        logger.info("truncate.d1.delete.complete", {
          deletedCount: d1DeleteResult.value,
        });
        console.log(`✅ Successfully deleted ${d1DeleteResult.value} D1 records`);
      }
    }

    console.log("\n📊 Truncate Summary:");
    console.log(`  ✅ R2: Deleted ${deletedCount} objects`);
    console.log(`  ✅ D1: Deleted ${d1RecordsToDelete} records`);
    console.log(`  📦 Total processed: ${deletedCount + d1RecordsToDelete} items\n`);

    console.log("✅ Truncate completed successfully!");
  } catch (error) {
    logger.error("truncate.failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    console.error("❌ Truncate failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch(error => {
  logger.error("truncate.unhandled", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
