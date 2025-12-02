/**
 * Shared performance mock utilities for tests
 * Provides deterministic timing control for texture loading and other timing-sensitive tests
 */

/**
 * State for mock time control
 */
let mockTime = 0;
const originalPerformance = globalThis.performance;

/**
 * Create a complete performance mock that includes measure() for React 19
 */
export function createMockPerformance(): Performance {
  return {
    ...originalPerformance,
    now: () => mockTime,
    measure: () => ({}) as PerformanceMeasure,
    mark: () => ({}) as PerformanceMark,
    clearMarks: () => {},
    clearMeasures: () => {},
    getEntries: () => [],
    getEntriesByName: () => [],
    getEntriesByType: () => [],
    toJSON: () => ({}),
  };
}

/**
 * Get current mock time
 */
export function getMockTime(): number {
  return mockTime;
}

/**
 * Set mock time to a specific value
 */
export function setMockTime(time: number): void {
  mockTime = time;
}

/**
 * Advance mock time by a delta
 */
export function advanceMockTime(delta: number): void {
  mockTime += delta;
}

/**
 * Reset mock time to 0
 */
export function resetMockTime(): void {
  mockTime = 0;
}

/**
 * Install the mock performance object globally
 */
export function installMockPerformance(): void {
  globalThis.performance = createMockPerformance();
}

/**
 * Restore the original performance object
 */
export function restorePerformance(): void {
  globalThis.performance = originalPerformance;
}
