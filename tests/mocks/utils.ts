/**
 * Mock utilities for utils modules
 * Provides reusable mocks for @/utils/* modules
 *
 * Usage:
 *   import { mock } from "bun:test";
 *   import { createUrlMock, createLoggerMock } from "@/tests/mocks/utils";
 *
 *   mock.module("@/utils/url", createUrlMock());
 *   const { mockLogger } = createLoggerMock();
 *   mock.module("@/utils/logger", () => ({ logger: mockLogger }));
 */

import { mock } from "bun:test";

/**
 * Create mock for @/utils/url
 * Returns a function that returns the mock module object
 */
export function createUrlMock() {
  return () => ({
    getBaseUrl: () => "http://localhost:8787",
    getPumpFunUrl: (address: string) => `https://pump.fun/${address}`,
  });
}

/**
 * Create mock for @/utils/three
 * Returns a function that returns the mock module object
 */
export function createThreeUtilsMock() {
  return () => ({
    calculatePlaneDimensions: () => [0.7, 0.7],
    handlePointerMoveForDrag: mock(() => {}),
    handlePointerUpForClick: mock(() => false),
    isValidPointerEvent: mock(() => true),
  });
}

/**
 * Create mock for @/utils/twitter
 * Returns a function that returns the mock module object
 */
export function createTwitterMock() {
  return () => ({
    openTweetIntent: mock(() => {}),
  });
}
