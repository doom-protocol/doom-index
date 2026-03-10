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

interface UseLatestPaintingMockOptions {
  painting?: PaintingMetadata | null;
  isLoading?: boolean;
  error?: Error | null;
}

type UseSolanaWalletModuleFactory = () => {
  useSolanaWallet: () => {
    connecting: boolean;
    connected: boolean;
    publicKey: string | null;
    disconnect: BunMock;
    connect: BunMock;
  };
};

interface UseLatestPaintingModuleMock {
  useLatestPainting: BunMock;
  useLatestPaintingRefetch: () => () => Promise<void>;
  MIN_REFETCH_INTERVAL_MS: number;
  STALE_POLL_INTERVAL_MS: number;
  POST_GENERATION_DELAY_MS: number;
  clampInterval: (value: number) => number;
  computeRefetchDelay: (lastTimestamp?: string | null) => number;
  fetchLatestPainting: unknown;
}

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
  const refetchLatestPainting = () => async () => Promise.resolve(undefined);

  return (): UseLatestPaintingModuleMock => ({
    ...realUseLatestPainting,
    useLatestPainting: mockUseLatestPainting,
    useLatestPaintingRefetch: refetchLatestPainting,
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
  const readSolanaWallet = () => ({
    connecting: options?.connecting ?? false,
    connected: options?.connected ?? false,
    publicKey: options?.publicKey ?? null,
    disconnect: mock(() => {}),
    connect: mock(() => {}),
  });

  return () => ({
    useSolanaWallet: readSolanaWallet,
  });
}

/**
 * Create mock for @/hooks/use-viewer
 * Returns a function that returns the mock module object
 */
export function createUseViewerMock(): () => { useViewer: () => void } {
  const watchViewer = () => {
    // No-op: viewer worker is not available in test environment
  };

  return () => ({
    useViewer: watchViewer,
  });
}

/**
 * Create mock for @/hooks/use-transformed-texture-url
 * Returns a function that returns the mock module object
 */
export function createUseTransformedTextureUrlMock(): () => {
  useTransformedTextureUrl: (url: string) => string;
} {
  const transformTextureUrl = (url: string) => url;

  return () => ({
    useTransformedTextureUrl: transformTextureUrl,
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

  const loadSafeTexture = (_url: string, onLoad?: (texture: unknown) => void) => {
    if (onLoad || options?.onLoad) {
      (onLoad || options?.onLoad)?.(mockTexture);
    }
    return mockTexture;
  };

  loadSafeTexture.preload = mock(() => {});
  loadSafeTexture.clear = mock(() => {});

  return () => ({
    useSafeTexture: loadSafeTexture,
  });
}
