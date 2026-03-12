import type { ArchiveIndexRow, PaintingsRepository } from "@/server/repositories/paintings-repository";
import { createPaintingsRepository } from "@/server/repositories/paintings-repository";
import type { VisualParams } from "@/lib/pure/mapping";
import type { AppError } from "@/types/app-error";
import type { ArchiveListResponse } from "@/types/archive-list-response";
import type { Painting } from "@/types/paintings";
import { logger } from "@/utils/logger";
import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface ListImagesOptions {
  limit?: number;
  cursor?: string;
  offset?: number;
  from?: string;
  to?: string;
}

function toPaintings(items: ArchiveIndexRow[]): Painting[] {
  return items.map((item) => ({
    fileSize: item.fileSize,
    glbUrl: item.glbUrl,
    id: item.id,
    imageUrl: item.imageUrl,
    minuteBucket: item.minuteBucket,
    negative: item.negative,
    paramsHash: item.paramsHash,
    prompt: item.prompt,
    seed: item.seed,
    timestamp: item.timestamp,
    visualParams: JSON.parse(item.visualParamsJson) as VisualParams,
  }));
}

export async function listImages(
  d1Binding: D1Database | undefined,
  options: ListImagesOptions,
  archiveRepository?: PaintingsRepository,
): Promise<Result<ArchiveListResponse, AppError>> {
  try {
    const repo = archiveRepository ?? createPaintingsRepository({ d1Binding });
    const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const d1Result = await repo.list({
      limit,
      cursor: options.cursor,
      offset: options.offset,
      from: options.from,
      to: options.to,
    });

    if (d1Result.isErr()) {
      return err(d1Result.error);
    }

    return ok({
      items: toPaintings(d1Result.value.items),
      cursor: d1Result.value.cursor,
      hasMore: d1Result.value.hasMore,
    });
  } catch (error) {
    logger.error("archive.list.error", { error });
    return err({
      type: "StorageError",
      op: "list",
      key: "paintings",
      message: `Failed to list archive paintings: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
