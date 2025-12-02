/**
 * Centralized mock utilities
 * Import from this file to use all available mocks
 *
 * Usage example:
 *   import { mock } from "bun:test";
 *   import {
 *     createUrlMock,
 *     createLoggerMockFactory,
 *     createEnvMock,
 *     createAnalyticsMock,
 *     createSonnerMock,
 *     createUseHapticMock,
 *     createUseSoundMock,
 *     createMockPerformance,
 *     resetMockTime,
 *   } from "@/tests/mocks";
 *
 *   // Setup mocks before importing modules
 *   mock.module("@/utils/url", createUrlMock());
 *   const { mockFactory: loggerMockFactory } = createLoggerMockFactory();
 *   mock.module("@/utils/logger", loggerMockFactory);
 *   mock.module("@/env", createEnvMock());
 *   mock.module("@/lib/analytics", createAnalyticsMock());
 *   mock.module("sonner", createSonnerMock());
 *   mock.module("use-haptic", createUseHapticMock());
 *   mock.module("use-sound", createUseSoundMock());
 *
 *   // Setup performance mock
 *   beforeEach(() => {
 *     resetMockTime();
 *     globalThis.performance = createMockPerformance();
 *   });
 */

export * from "./utils";
export * from "./hooks";
export * from "./libs";
export * from "./external";
export * from "./components";
export * from "./logger";
export * from "./performance";
