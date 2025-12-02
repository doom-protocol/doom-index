/**
 * Mock utilities for internal libraries
 * Provides reusable mocks for @/lib/* modules
 *
 * Usage:
 *   import { mock } from "bun:test";
 *   import { createAnalyticsMock } from "@/tests/mocks/libs";
 *
 *   mock.module("@/lib/analytics", createAnalyticsMock());
 */

import { mock } from "bun:test";
import { ok } from "neverthrow";
import type { AppError } from "@/types/app-error";

/**
 * Create mock for @/lib/analytics
 * Returns a function that returns the mock module object
 */
export function createAnalyticsMock() {
  return () => ({
    GA_EVENTS: {
      GALLERY_PAINTING_CLICK: "gallery_painting_click",
      MINT_BUTTON_CLICK: "mint_button_click",
      MINT_UPLOAD_START: "mint_upload_start",
      MINT_WALLET_CONNECT: "mint_wallet_connect",
      MINT_TRANSACTION_START: "mint_transaction_start",
      MINT_SUCCESS: "mint_success",
    },
    sendGAEvent: mock(() => {}),
  });
}

/**
 * Create mock for @/lib/glb-export-service
 *
 * ⚠️ WARNING: Do NOT use mock.module() with this mock at file level!
 * mock.module() affects ALL test files in the process.
 * Instead, use method replacement with beforeAll/afterAll:
 *
 * ```typescript
 * import { glbExportService } from "@/lib/glb-export-service";
 *
 * const originalMethod = glbExportService.exportPaintingModel;
 * beforeAll(() => {
 *   glbExportService.exportPaintingModel = mock(async () => ok(new File([], "mock.glb")));
 * });
 * afterAll(() => {
 *   glbExportService.exportPaintingModel = originalMethod;
 * });
 * ```
 */
export function createGlbExportServiceMock() {
  return () => ({
    glbExportService: {
      exportPaintingModel: mock(async () =>
        ok<File, AppError>(new File([], "test.glb", { type: "application/octet-stream" })),
      ),
      optimizeGlb: mock(async () => ok<ArrayBuffer, AppError>(new ArrayBuffer(1024))),
    },
  });
}

/**
 * Create mock for @/lib/viewer-count-store
 * Returns a function that returns the mock module object
 */
export function createViewerCountStoreMock() {
  // Use a single state object that gets mutated to maintain reference equality
  const state = {
    count: 1,
    updatedAt: Date.now(),
  };
  const listeners = new Set<() => void>();

  return () => ({
    viewerCountStore: {
      update: (newCount: number, newUpdatedAt: number) => {
        state.count = newCount;
        state.updatedAt = newUpdatedAt;
        listeners.forEach(listener => listener());
      },
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getSnapshot: () => state, // Return the same object reference
    },
  });
}

/**
 * Create mock for @/env
 * Returns a function that returns the mock module object
 */
export function createEnvMock(options?: {
  NEXT_PUBLIC_BASE_URL?: string;
  LOG_LEVEL?: string;
  NEXT_PUBLIC_R2_URL?: string;
}) {
  const baseUrl = options?.NEXT_PUBLIC_BASE_URL ?? "http://localhost:8787";
  return () => ({
    env: {
      NEXT_PUBLIC_BASE_URL: baseUrl,
      LOG_LEVEL: options?.LOG_LEVEL ?? "DEBUG",
      NEXT_PUBLIC_R2_URL: options?.NEXT_PUBLIC_R2_URL ?? "/api/r2",
    },
    isDevelopment: () => baseUrl.includes("localhost"),
    getEnvironmentName: () => (baseUrl.includes("localhost") ? "development" : "production"),
  });
}
