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

type BunMock = ReturnType<typeof mock>;

type UrlMock = () => {
  getBaseUrl: () => string;
  getPumpFunUrl: (address: string) => string;
};

type ThreeUtilsMock = () => {
  calculatePlaneDimensions: () => [number, number];
  handlePointerMoveForDrag: BunMock;
  handlePointerUpForClick: BunMock;
  isValidPointerEvent: BunMock;
};

type TwitterMock = () => {
  openTweetIntent: BunMock;
};

/**
 * Create mock for @/utils/url
 * Returns a function that returns the mock module object
 */
export function createUrlMock(): UrlMock {
  return () => ({
    getBaseUrl: () => "http://localhost:8787",
    getPumpFunUrl: (address: string) => `https://pump.fun/${address}`,
  });
}

/**
 * Create mock for @/utils/three
 * Returns a function that returns the mock module object
 */
export function createThreeUtilsMock(): ThreeUtilsMock {
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
export function createTwitterMock(): TwitterMock {
  return () => ({
    openTweetIntent: mock(() => {}),
  });
}
