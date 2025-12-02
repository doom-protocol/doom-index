/**
 * Mock utilities for hooks
 * Provides reusable mocks for @/hooks/* modules
 *
 * Usage:
 *   import { mock } from "bun:test";
 *   import { createUseLatestPaintingMock } from "@/tests/mocks/hooks";
 *
 *   mock.module("@/hooks/use-latest-painting", createUseLatestPaintingMock());
 */

import { mock } from "bun:test";
import type { PaintingMetadata } from "@/types/paintings";

/**
 * Create mock for @/hooks/use-latest-painting
 * Returns a function that returns the mock module object
 */
export function createUseLatestPaintingMock(options?: {
  painting?: PaintingMetadata | null;
  isLoading?: boolean;
  error?: Error | null;
}) {
  const realUseLatestPainting = require("@/hooks/use-latest-painting");
  const mockUseLatestPainting = mock(() => ({
    data: options?.painting ?? null,
    isLoading: options?.isLoading ?? false,
    error: options?.error ?? null,
    dataUpdatedAt: Date.now(),
  }));

  return () => ({
    ...realUseLatestPainting,
    useLatestPainting: mockUseLatestPainting,
    useLatestPaintingRefetch: () => async () => undefined,
  });
}

/**
 * Create mock for @/hooks/use-solana-wallet
 * Returns a function that returns the mock module object
 */
export function createUseSolanaWalletMock(options?: {
  connecting?: boolean;
  connected?: boolean;
  publicKey?: string | null;
}) {
  return () => ({
    useSolanaWallet: () => ({
      connecting: options?.connecting ?? false,
      connected: options?.connected ?? false,
      publicKey: options?.publicKey ?? null,
      disconnect: mock(() => {}),
      connect: mock(() => {}),
    }),
  });
}

/**
 * Create mock for @/hooks/use-viewer
 * Returns a function that returns the mock module object
 */
export function createUseViewerMock() {
  return () => ({
    useViewer: () => {
      // No-op: viewer worker is not available in test environment
    },
  });
}

/**
 * Create mock for @/hooks/use-transformed-texture-url
 * Returns a function that returns the mock module object
 */
export function createUseTransformedTextureUrlMock() {
  return () => ({
    useTransformedTextureUrl: (url: string) => url,
  });
}

/**
 * Create mock for @/hooks/use-safe-texture
 * Returns a function that returns the mock module object
 */
export function createUseSafeTextureMock(options?: { texture?: unknown; onLoad?: (texture: unknown) => void }) {
  const mockTexture = options?.texture ?? {
    colorSpace: "",
    anisotropy: 1,
    needsUpdate: false,
    image: { src: "", width: 512, height: 512 },
    dispose: mock(() => {}),
  };

  const useSafeTexture = (url: string, onLoad?: (texture: unknown) => void) => {
    if (onLoad || options?.onLoad) {
      (onLoad || options?.onLoad)?.(mockTexture);
    }
    return mockTexture;
  };

  useSafeTexture.preload = mock(() => {});
  useSafeTexture.clear = mock(() => {});

  return () => ({
    useSafeTexture,
  });
}
