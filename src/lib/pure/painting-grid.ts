/**
 * Calculate grid layout configuration based on screen size
 */
export interface GridConfig {
  columns: number;
  rows: number;
  spacing: number;
  itemWidth: number;
  itemHeight: number;
}

/**
 * Desktop grid configuration: 5 columns × 10 rows
 */
const DESKTOP_GRID: GridConfig = {
  columns: 5,
  rows: 10,
  spacing: 0.8,
  itemWidth: 0.6,
  itemHeight: 0.8,
};

/**
 * Mobile grid configuration: 2 columns × 25 rows
 */
const MOBILE_GRID: GridConfig = {
  columns: 2,
  rows: 25,
  spacing: 0.6,
  itemWidth: 0.5,
  itemHeight: 0.7,
};

/**
 * Get grid configuration based on screen size
 */
export function getGridConfig(isMobile: boolean): GridConfig {
  return isMobile ? MOBILE_GRID : DESKTOP_GRID;
}

/**
 * Calculate 3D position for an item in the grid
 */
export function calculateGridPosition(
  index: number,
  config: GridConfig,
  startPosition: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  const row = Math.floor(index / config.columns);
  const col = index % config.columns;

  // Center the grid
  const totalWidth = (config.columns - 1) * config.spacing;
  const totalHeight = (config.rows - 1) * config.spacing;
  const offsetX = -totalWidth / 2;
  const offsetY = totalHeight / 2;

  const x = startPosition[0] + offsetX + col * config.spacing;
  const y = startPosition[1] + offsetY - row * config.spacing;
  const z = startPosition[2];

  return [x, y, z];
}

/**
 * Calculate total number of items that fit in the grid
 */
export function getGridCapacity(config: GridConfig): number {
  return config.columns * config.rows;
}
