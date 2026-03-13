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
const DEFAULT_VISUAL_PARAMS: VisualParams = {
  bioluminescence: 0,
  blueBalance: 0,
  debrisIntensity: 0,
  fogDensity: 0,
  fractalDensity: 0,
  lightIntensity: 0,
  mechanicalPattern: 0,
  metallicRatio: 0,
  organicPattern: 0,
  radiationGlow: 0,
  redHighlight: 0,
  reflectivity: 0,
  shadowDepth: 0,
  skyTint: 0,
  vegetationDensity: 0,
  warmHue: 0,
};

export interface ListImagesOptions {
  limit?: number;
  cursor?: string;
  offset?: number;
  from?: string;
  to?: string;
}

function isVisualParams(value: unknown): value is VisualParams {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const visualParams = value as Record<string, unknown>;
  return Object.keys(DEFAULT_VISUAL_PARAMS).every((key) => typeof visualParams[key] === "number");
}

function parseVisualParams(item: ArchiveIndexRow): VisualParams {
  try {
    const parsed = JSON.parse(item.visualParamsJson) as unknown;
    if (isVisualParams(parsed)) {
      return parsed;
    }

    logger.warn("archive.list.visual-params-invalid", {
      itemId: item.id,
      visualParamsJson: item.visualParamsJson,
    });
  } catch (error) {
    logger.warn("archive.list.visual-params-parse-failed", {
      error: error instanceof Error ? error.message : String(error),
      itemId: item.id,
    });
  }

  return DEFAULT_VISUAL_PARAMS;
}

function toPaintings(items: ArchiveIndexRow[]): Painting[] {
  return items.map((item) => ({
    fileSize: item.fileSize,
    glbUrl: item.glbUrl ?? undefined,
    id: item.id,
    imageUrl: item.imageUrl,
    minuteBucket: item.minuteBucket,
    negative: item.negative,
    paramsHash: item.paramsHash,
    prompt: item.prompt,
    seed: item.seed,
    timestamp: item.timestamp,
    visualParams: parseVisualParams(item),
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
