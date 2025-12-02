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
 * Returns a function that returns the mock module object
 */
export function createGlbExportServiceMock() {
  return () => ({
    glbExportService: {
      exportGroupToGlb: mock(async () => new File([], "test.glb", { type: "model/gltf-binary" })),
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
export function createEnvMock(options?: { NODE_ENV?: string; LOG_LEVEL?: string; NEXT_PUBLIC_R2_URL?: string }) {
  return () => ({
    env: {
      NODE_ENV: options?.NODE_ENV ?? "test",
      LOG_LEVEL: options?.LOG_LEVEL ?? "DEBUG",
      NEXT_PUBLIC_R2_URL: options?.NEXT_PUBLIC_R2_URL ?? "/api/r2",
    },
  });
}
