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

type BunMock = ReturnType<typeof mock>;

type UseLatestPaintingMockOptions = {
  painting?: PaintingMetadata | null;
  isLoading?: boolean;
  error?: Error | null;
};

type UseSolanaWalletModuleFactory = () => {
  useSolanaWallet: () => {
    connecting: boolean;
    connected: boolean;
    publicKey: string | null;
    disconnect: BunMock;
    connect: BunMock;
  };
};

type UseLatestPaintingModuleMock = {
  useLatestPainting: BunMock;
  useLatestPaintingRefetch: () => () => Promise<void>;
  MIN_REFETCH_INTERVAL_MS: number;
  STALE_POLL_INTERVAL_MS: number;
  POST_GENERATION_DELAY_MS: number;
  clampInterval: (value: number) => number;
  computeRefetchDelay: (lastTimestamp?: string | null) => number;
  fetchLatestPainting: unknown;
};

/**
 * Create mock for @/hooks/use-latest-painting
 * Returns a function that returns the mock module object
 */
export function createUseLatestPaintingMock(options?: UseLatestPaintingMockOptions): () => UseLatestPaintingModuleMock {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const realUseLatestPainting = require("@/hooks/use-latest-painting") as UseLatestPaintingModuleMock;
  const mockUseLatestPainting = mock(() => ({
    data: options?.painting ?? null,
    isLoading: options?.isLoading ?? false,
    error: options?.error ?? null,
    dataUpdatedAt: Date.now(),
  }));

  return (): UseLatestPaintingModuleMock => ({
    ...realUseLatestPainting,
    useLatestPainting: mockUseLatestPainting,
    useLatestPaintingRefetch: () => async () => Promise.resolve(undefined),
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
}): UseSolanaWalletModuleFactory {
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
export function createUseViewerMock(): () => { useViewer: () => void } {
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
export function createUseTransformedTextureUrlMock(): () => { useTransformedTextureUrl: (url: string) => string } {
  return () => ({
    useTransformedTextureUrl: (url: string) => url,
  });
}

/**
 * Create mock for @/hooks/use-safe-texture
 * Returns a function that returns the mock module object
 */
export function createUseSafeTextureMock(options?: { texture?: unknown; onLoad?: (texture: unknown) => void }): () => {
  useSafeTexture: {
    (url: string, onLoad?: (texture: unknown) => void): unknown;
    preload: BunMock;
    clear: BunMock;
  };
} {
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
