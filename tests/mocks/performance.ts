/**
 * Mock utilities for performance
 * Provides deterministic timing control for texture loading and other timing-sensitive tests
 *
 * Usage:
 *   import { createMockPerformance, resetMockTime, advanceMockTime } from "@/tests/mocks/performance";
 *
 *   beforeEach(() => {
 *     resetMockTime();
 *     globalThis.performance = createMockPerformance();
 *   });
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
  const performanceMock = Object.create(null) as Performance;
  Object.assign(performanceMock, originalPerformance);
  performanceMock.now = () => mockTime;
  performanceMock.measure = () => ({}) as PerformanceMeasure;
  performanceMock.mark = () => ({}) as PerformanceMark;
  performanceMock.clearMarks = () => {};
  performanceMock.clearMeasures = () => {};
  performanceMock.getEntries = () => [];
  performanceMock.getEntriesByName = () => [];
  performanceMock.getEntriesByType = () => [];
  performanceMock.toJSON = () => ({});
  return performanceMock;
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
