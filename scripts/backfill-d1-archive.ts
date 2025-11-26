import { isPaintingMetadata } from "@/lib/pure/painting-metadata";
import { getJsonR2, listR2Objects, resolveBucketOrThrow } from "@/lib/r2";
import { createPaintingsService } from "@/services/paintings";
import type { PaintingMetadata } from "@/types/paintings";
import { logger } from "@/utils/logger";
import { isValidPaintingFilename } from "@/utils/paintings";

/**
 * Backfill script to migrate existing R2 archive metadata to D1
 *
 * Usage:
 *   bun --env-file=.dev.vars scripts/backfill-d1-archive.ts
 *
 * This script:
 * 1. Lists all .webp files in R2 (images/)
 * 2. Loads corresponding .json metadata files
 * 3. Inserts metadata into D1 (idempotent with onConflictDoNothing)
 */

async function backfillArchive() {
  logger.info("backfill.start", { message: "Starting D1 archive backfill from R2" });

  const bucket = resolveBucketOrThrow({});
  const archiveService = createPaintingsService({});

  let totalProcessed = 0;
  let totalInserted = 0;
  const totalSkipped = 0;
  let totalErrors = 0;

  let cursor: string | undefined;
  const batchSize = 100;

  while (true) {
    logger.info("backfill.batch", { cursor: cursor || "start", batchSize });

    const listResult = await listR2Objects(bucket, {
      prefix: "images/",
      limit: batchSize,
      cursor,
    });

    if (listResult.isErr()) {
      logger.error("backfill.list.error", { error: listResult.error });
      break;
    }

    const result = listResult.value;
    const { objects, truncated } = result;

    const webpObjects = objects.filter(obj => {
      const filename = obj.key.split("/").pop() || "";
      return filename.endsWith(".webp") && isValidPaintingFilename(filename);
    });

    logger.info("backfill.batch.filtered", {
      totalObjects: objects.length,
      webpObjects: webpObjects.length,
    });

    for (const obj of webpObjects) {
      totalProcessed++;
      const metadataKey = obj.key.replace(/\.webp$/, ".json");

      const metadataResult = await getJsonR2<PaintingMetadata>(bucket, metadataKey);

      if (metadataResult.isErr()) {
        logger.warn("backfill.metadata.load.failed", {
          imageKey: obj.key,
          metadataKey,
          error: metadataResult.error.message,
        });
        totalErrors++;
        continue;
      }

      const metadata = metadataResult.value;
      if (!metadata || !isPaintingMetadata(metadata)) {
        logger.warn("backfill.metadata.invalid", {
          imageKey: obj.key,
          metadataKey,
        });
        totalErrors++;
        continue;
      }

      const insertResult = await archiveService.insertPainting(metadata, obj.key);

      if (insertResult.isErr()) {
        logger.error("backfill.insert.error", {
          id: metadata.id,
          error: insertResult.error,
        });
        totalErrors++;
      } else {
        totalInserted++;
        if (totalInserted % 10 === 0) {
          logger.info("backfill.progress", {
            processed: totalProcessed,
            inserted: totalInserted,
            skipped: totalSkipped,
            errors: totalErrors,
          });
        }
      }
    }

    if (!truncated) {
      break;
    }

    cursor = result.cursor;
  }

  logger.info("backfill.complete", {
    totalProcessed,
    totalInserted,
    totalSkipped,
    totalErrors,
  });

  console.log("\n=== Backfill Complete ===");
  console.log(`Total Processed: ${totalProcessed}`);
  console.log(`Total Inserted: ${totalInserted}`);
  console.log(`Total Skipped: ${totalSkipped}`);
  console.log(`Total Errors: ${totalErrors}`);
}

backfillArchive().catch(error => {
  logger.error("backfill.fatal", { error });
  console.error("Fatal error during backfill:", error);
  process.exit(1);
});
