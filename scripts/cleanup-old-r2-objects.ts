#!/usr/bin/env bun

/**
 * Cleanup Old R2 Objects Script
 *
 * This script removes R2 objects that don't match the new archive structure:
 * - Old structure: DOOM_*.webp (at root) or images/DOOM_*.webp (directly under images/)
 * - New structure: images/{YYYY}/{MM}/{DD}/DOOM_{YYYYMMDDHHmm}_{paramsHash}_{seed}.webp
 *
 * Usage:
 *   # Using npm scripts (recommended):
 *   bun run cleanup-r2:dry-run  # Preview what will be deleted
 *   bun run cleanup-r2          # Actually delete objects
 *
 *   # Or directly:
 *   bun --env-file=.dev.vars scripts/cleanup-old-r2-objects.ts --dry-run  # Preview
 *   bun --env-file=.dev.vars scripts/cleanup-old-r2-objects.ts            # Delete
 *
 * Environment Variables (REQUIRED for remote R2 access):
 *   These can be set in .dev.vars or .example.vars file:
 *   - R2_ACCESS_KEY_ID: R2 API Token Access Key ID
 *   - R2_SECRET_ACCESS_KEY: R2 API Token Secret Access Key
 *   - CF_ACCOUNT_ID: Cloudflare Account ID
 *   - R2_BUCKET_NAME: R2 Bucket Name (optional, defaults to "doom-index-storage")
 *
 * NOTE: This script only works with remote R2 buckets. Local R2 buckets are not affected.
 */

// Note: resolveR2BucketAsync and listR2Objects are not used anymore
// as this script only works with remote R2 buckets via S3 API
import { isValidArchiveFilename } from "@/lib/pure/archive";
import { logger } from "@/utils/logger";
import { err, ok, Result } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

type Args = {
  dryRun: boolean;
  prefix?: string;
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

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run" || arg === "-d") {
      parsed.dryRun = true;
    } else if (arg === "--prefix" && i + 1 < args.length) {
      parsed.prefix = args[i + 1];
      i++;
    }
  }

  return parsed as Args;
};

/**
 * Check if a key matches the new archive structure
 * New structure: images/{YYYY}/{MM}/{DD}/DOOM_{YYYYMMDDHHmm}_{paramsHash}_{seed}.webp
 *
 * Returns true only for files in the date-based folder structure under images/
 */
function isNewArchiveStructure(key: string): boolean {
  // Must start with images/
  if (!key.startsWith("images/")) {
    return false;
  }

  // Check if it matches the date prefix pattern: images/{YYYY}/{MM}/{DD}/
  const datePrefixPattern = /^images\/\d{4}\/\d{2}\/\d{2}\//;
  if (!datePrefixPattern.test(key)) {
    return false;
  }

  // Extract filename
  const filename = key.split("/").pop() || "";

  // For .webp files, check if filename matches the new pattern
  if (filename.endsWith(".webp")) {
    return isValidArchiveFilename(filename);
  }

  // For .json files, check if corresponding .webp would match
  if (filename.endsWith(".json")) {
    const webpFilename = filename.replace(/\.json$/, ".webp");
    return isValidArchiveFilename(webpFilename);
  }

  return false;
}

/**
 * Check if a key is an old archive file that should be deleted
 * Old structures:
 * - DOOM_*.webp at root level
 * - images/DOOM_*.webp (not in date-based folders)
 */
function isOldArchiveFile(key: string): boolean {
  // Skip non-DOOM files
  if (!key.includes("DOOM_")) {
    return false;
  }

  // Skip if it matches the new structure
  if (isNewArchiveStructure(key)) {
    return false;
  }

  // Check if it's a DOOM file at root level
  if (key.match(/^DOOM_.*\.(webp|json)$/)) {
    return true;
  }

  // Check if it's a DOOM file directly under images/ (old structure)
  if (key.match(/^images\/DOOM_.*\.(webp|json)$/)) {
    return true;
  }

  return false;
}

/**
 * Collect all objects to delete
 */
async function collectObjectsToDelete(
  client: R2Client,
  prefix: string,
): Promise<{ toDelete: string[]; stats: { webp: number; json: number; other: number } }> {
  const toDelete: string[] = [];
  const stats = { webp: 0, json: 0, other: 0 };
  let cursor: string | undefined;

  logger.info("cleanup.scanning", { prefix });

  // First pass: collect all objects
  const allObjects: R2Object[] = [];
  do {
    const listResult = await client.list({
      prefix,
      cursor,
      limit: 1000,
    });

    if (listResult.isErr()) {
      logger.error("cleanup.list.failed", {
        error: listResult.error.message,
        prefix,
      });
      throw new Error(`Failed to list objects: ${listResult.error.message}`);
    }

    allObjects.push(...listResult.value.objects);
    cursor = listResult.value.truncated ? listResult.value.cursor : undefined;

    logger.debug("cleanup.scanning.progress", {
      collected: allObjects.length,
      hasMore: Boolean(cursor),
    });
  } while (cursor);

  logger.info("cleanup.scanning.complete", {
    totalObjects: allObjects.length,
  });

  // Build a set of all .webp files for quick lookup
  const webpFiles = new Set<string>();
  for (const obj of allObjects) {
    if (obj.key.endsWith(".webp")) {
      webpFiles.add(obj.key);
    }
  }

  // Second pass: identify objects to delete
  for (const obj of allObjects) {
    const key = obj.key;

    // Skip if it matches the new structure
    if (isNewArchiveStructure(key)) {
      continue;
    }

    // Skip system files (state/ only - revenue/ should be deleted)
    if (key.startsWith("state/")) {
      continue;
    }

    // Delete all files in revenue/ folder
    if (key.startsWith("revenue/")) {
      if (key.endsWith(".json")) {
        stats.json++;
      } else {
        stats.other++;
      }
      toDelete.push(key);
      logger.debug("cleanup.marked.revenue", { key });
      continue;
    }

    // Check if it's an old archive file (DOOM_* at root or images/)
    if (isOldArchiveFile(key)) {
      if (key.endsWith(".webp")) {
        stats.webp++;
        toDelete.push(key);
        logger.debug("cleanup.marked.webp.old-structure", { key });

        // Check if corresponding .json exists
        const metadataKey = key.replace(/\.webp$/, ".json");
        const hasMetadata = allObjects.some(o => o.key === metadataKey);
        if (hasMetadata) {
          toDelete.push(metadataKey);
          logger.debug("cleanup.marked.json.paired-with-old-webp", { key: metadataKey });
        }
      } else if (key.endsWith(".json")) {
        stats.json++;
        // Check if corresponding .webp exists
        const webpKey = key.replace(/\.json$/, ".webp");
        const hasWebp = webpFiles.has(webpKey);
        if (hasWebp && isOldArchiveFile(webpKey)) {
          // Paired with old webp - mark both
          if (!toDelete.includes(webpKey)) {
            toDelete.push(webpKey);
          }
          toDelete.push(key);
          logger.debug("cleanup.marked.json.paired-with-old-webp", { key, webpKey });
        } else {
          // Orphaned metadata file
          toDelete.push(key);
          logger.debug("cleanup.marked.json.orphaned", { key });
        }
      }
      continue;
    }

    // Handle other old structure files in images/ (not DOOM_*)
    if (key.startsWith("images/") && !key.match(/^images\/\d{4}\/\d{2}\/\d{2}\//)) {
      if (key.endsWith(".webp")) {
        stats.webp++;
        toDelete.push(key);
        logger.debug("cleanup.marked.webp.old-images-structure", { key });

        // Check if corresponding .json exists
        const metadataKey = key.replace(/\.webp$/, ".json");
        const hasMetadata = allObjects.some(o => o.key === metadataKey);
        if (hasMetadata) {
          toDelete.push(metadataKey);
        }
      } else if (key.endsWith(".json")) {
        stats.json++;
        const webpKey = key.replace(/\.json$/, ".webp");
        const hasWebp = webpFiles.has(webpKey);
        if (!hasWebp || !isNewArchiveStructure(webpKey)) {
          toDelete.push(key);
          logger.debug("cleanup.marked.json.old-images-structure", { key });
        }
      } else {
        stats.other++;
        toDelete.push(key);
        logger.debug("cleanup.marked.other.old-images-structure", { key });
      }
    }
  }

  // Remove duplicates
  const uniqueToDelete = Array.from(new Set(toDelete));

  return {
    toDelete: uniqueToDelete,
    stats,
  };
}

async function main() {
  const args = parseArgs();
  // Default to empty prefix to scan all objects (including root level)
  // User can specify --prefix to limit scope
  const prefix = args.prefix ?? "";

  logger.info("cleanup.starting", {
    dryRun: args.dryRun,
    prefix,
  });

  // Only use remote R2 client (local R2 buckets are not affected)
  const envClientResult = createR2ClientFromEnv();
  if (envClientResult.isErr()) {
    logger.error("cleanup.client.creation.failed", {
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
  logger.info("cleanup.client.created.from-env");

  try {
    // Collect objects to delete
    const { toDelete, stats } = await collectObjectsToDelete(client, prefix);

    logger.info("cleanup.analysis.complete", {
      totalToDelete: toDelete.length,
      stats,
    });

    if (toDelete.length === 0) {
      console.log("✅ No old objects found. All objects match the new archive structure.");
      return;
    }

    // Group by type for reporting
    const webpToDelete = toDelete.filter(k => k.endsWith(".webp"));
    const jsonToDelete = toDelete.filter(k => k.endsWith(".json"));
    const otherToDelete = toDelete.filter(k => !k.endsWith(".webp") && !k.endsWith(".json"));

    console.log("\n📊 Objects to delete:");
    console.log(`  - ${webpToDelete.length} .webp files`);
    console.log(`  - ${jsonToDelete.length} .json files`);
    console.log(`  - ${otherToDelete.length} other files`);
    console.log(`  Total: ${toDelete.length} objects\n`);

    if (args.dryRun) {
      console.log("🔍 DRY RUN MODE - No objects will be deleted\n");
      console.log("Sample objects to delete (first 10):");
      toDelete.slice(0, 10).forEach(key => {
        console.log(`  - ${key}`);
      });
      if (toDelete.length > 10) {
        console.log(`  ... and ${toDelete.length - 10} more`);
      }
      console.log("\n💡 Run without --dry-run to actually delete these objects.");
      return;
    }

    // Confirm deletion
    console.log("⚠️  WARNING: This will permanently delete the objects listed above.");
    console.log("Press Ctrl+C to cancel, or wait 5 seconds to proceed...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete objects using client
    const deleteResult = await client.delete(toDelete);
    if (deleteResult.isErr()) {
      logger.error("cleanup.delete.failed", {
        error: deleteResult.error.message,
      });
      console.error("❌ Failed to delete objects:", deleteResult.error.message);
      process.exit(1);
    }

    const deletedCount = toDelete.length;
    logger.info("cleanup.delete.complete", {
      deletedCount,
    });

    console.log("\n📊 Cleanup Summary:");
    console.log(`  ✅ Successfully deleted: ${deletedCount} objects`);
    console.log(`  📦 Total processed: ${toDelete.length} objects\n`);

    console.log("✅ Cleanup completed successfully!");
  } catch (error) {
    logger.error("cleanup.failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    console.error("❌ Cleanup failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch(error => {
  logger.error("cleanup.unhandled", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
