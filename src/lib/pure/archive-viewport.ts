import type { GridConfig } from "./archive-grid";

export interface VisibleRange {
  start: number;
  end: number;
}

/**
 * Calculate visible range based on camera Z position
 * Includes buffer zone (±3 rows) for smooth scrolling
 */
export function calculateVisibleRange(
  cameraZ: number,
  totalItems: number,
  gridConfig: GridConfig,
  initialZ: number,
  bufferRows: number = 3,
): VisibleRange {
  const zSpacing = gridConfig.spacing;
  const itemsPerRow = gridConfig.columns;

  // Calculate current row index from camera Z position
  const currentRow = Math.floor((cameraZ - initialZ) / zSpacing);

  // Calculate visible range with buffer
  const startRow = Math.max(0, currentRow - bufferRows);
  const endRow = Math.min(
    Math.ceil(totalItems / itemsPerRow) - 1,
    currentRow + Math.ceil(gridConfig.rows / 2) + bufferRows,
  );

  const start = Math.max(0, startRow * itemsPerRow);
  const end = Math.min(totalItems, (endRow + 1) * itemsPerRow);

  return { start, end };
}
