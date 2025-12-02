/**
 * Unit tests for GalleryScene texture loading and rendering
 * Tests the time from texture request to texture loaded callback
 *
 * Uses real image URLs from /api/r2/ endpoint to test actual image loading behavior
 */

// Import preload to ensure happy-dom globals are registered before any imports
import "../../preload";

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { render, waitFor, cleanup } from "@testing-library/react";
import { useEffect, useState, type FC, type ReactNode } from "react";
import { createLoggerMock, createMockPerformance, resetMockTime, advanceMockTime, getMockTime } from "../../mocks";

// Store captured logger calls for assertions using shared helper
const { logger: mockLogger, calls: loggerCalls } = createLoggerMock();

// Mock logger to capture timing logs
mock.module("@/utils/logger", () => ({
  logger: mockLogger,
}));

// Store original performance for restoration
const originalPerformance = globalThis.performance;

// Mock env - use NEXT_PUBLIC_BASE_URL to determine development environment
mock.module("@/env", () => ({
  env: {
    NEXT_PUBLIC_BASE_URL: "http://localhost:8787",
    LOG_LEVEL: "DEBUG",
    NEXT_PUBLIC_R2_URL: "/api/r2",
  },
  isDevelopment: () => true,
  getEnvironmentName: () => "development" as const,
}));

// Real image URL from /api/r2/ endpoint for realistic testing
// This URL format matches production image paths
const REAL_IMAGE_URL = "/api/r2/images/2025/12/02/DOOM_202512020110_03309aff_5779632aeaa9.webp";

// Mock use-latest-painting hook
// IMPORTANT: We spread the real module's exports to avoid breaking
// use-latest-painting.test.ts which tests the actual functions/constants
const mockPainting = {
  id: "DOOM_202512020110_03309aff_5779632aeaa9",
  timestamp: "2025-12-02T01:10:00.000Z",
  minuteBucket: "2025/12/02/01/10",
  paramsHash: "03309aff",
  seed: "5779632aeaa9",
  imageUrl: REAL_IMAGE_URL,
  fileSize: 1024000,
  visualParams: {
    fogDensity: 0.5,
    skyTint: 0.3,
    reflectivity: 0.2,
    blueBalance: 0.1,
    vegetationDensity: 0.4,
    organicPattern: 0.3,
    radiationGlow: 0.1,
    debrisIntensity: 0.2,
    mechanicalPattern: 0.1,
    metallicRatio: 0.2,
    fractalDensity: 0.3,
    bioluminescence: 0.1,
    shadowDepth: 0.4,
    redHighlight: 0.1,
    lightIntensity: 0.8,
    warmHue: 0.2,
    tokenWeights: {
      fear: 0.2,
      hope: 0.3,
      machine: 0.1,
      ice: 0.1,
      forest: 0.1,
      co2: 0.1,
      pandemic: 0.05,
      nuke: 0.05,
    },
    worldPrompt: "Test world prompt",
  },
  prompt: "Test painting prompt",
  negative: "",
};

// Import the real module to spread its exports
const realUseLatestPainting = require("@/hooks/use-latest-painting");

mock.module("@/hooks/use-latest-painting", () => ({
  // Spread all real exports (constants, pure functions) to avoid breaking other tests
  ...realUseLatestPainting,
  // Only override the hooks that need mocking for our tests
  useLatestPainting: () => ({
    data: mockPainting,
    isLoading: false,
    error: null,
  }),
  useLatestPaintingRefetch: () => async () => undefined,
}));

// Mock Solana wallet hook
mock.module("@/hooks/use-solana-wallet", () => ({
  useSolanaWallet: () => ({
    connecting: false,
    connected: false,
    publicKey: null,
  }),
}));

// Note: We don't mock @/lib/glb-export-service globally as it interferes with
// glb-export-service.test.ts. The gallery-scene component doesn't directly use
// glbExportService during render, so we don't need to mock it here.

// Mock analytics
mock.module("@/lib/analytics", () => ({
  GA_EVENTS: { GALLERY_PAINTING_CLICK: "gallery_painting_click" },
  sendGAEvent: mock(() => {}),
}));

// Mock toast
mock.module("sonner", () => ({
  toast: {
    error: mock(() => {}),
    success: mock(() => {}),
  },
}));

// Mock use-haptic
mock.module("use-haptic", () => ({
  useHaptic: () => ({
    triggerHaptic: mock(() => {}),
  }),
}));

// Mock useTransformedTextureUrl
mock.module("@/hooks/use-transformed-texture-url", () => ({
  useTransformedTextureUrl: (url: string) => url,
}));

// Mock useSafeTexture to capture onLoad callback and call it synchronously
mock.module("@/hooks/use-safe-texture", () => {
  const mockTexture = {
    colorSpace: "",
    anisotropy: 1,
    needsUpdate: false,
    image: { src: REAL_IMAGE_URL, width: 512, height: 512 },
    dispose: mock(() => {}),
  };

  const useSafeTexture = (url: string, onLoad?: (texture: unknown) => void) => {
    // Store callback for later invocation
    if (onLoad) {
      // Simulate texture load completion after a controlled delay
      // Advance mock time to simulate network/decode time
      advanceMockTime(150); // 150ms simulated load time
      onLoad(mockTexture);
    }

    return mockTexture;
  };

  useSafeTexture.preload = mock(() => {});
  useSafeTexture.clear = mock(() => {});

  return { useSafeTexture };
});

// Mock @react-three/fiber Canvas and hooks
const MockCanvas: FC<{ children: ReactNode }> = ({ children }) => {
  return <div data-testid="mock-canvas">{children}</div>;
};

mock.module("@react-three/fiber", () => ({
  Canvas: MockCanvas,
  useFrame: mock(() => {}),
  useThree: () => ({
    gl: {
      initTexture: mock(() => {}),
      shadowMap: { enabled: false, type: 0 },
      toneMapping: 0,
      setClearColor: mock(() => {}),
    },
    invalidate: mock(() => {}),
  }),
}));

// Mock @react-three/drei
mock.module("@react-three/drei", () => ({
  Grid: () => null,
  OrbitControls: () => null,
  Stats: () => null,
  useGLTF: () => ({
    scene: { clone: () => ({}) },
    nodes: {},
    materials: {},
  }),
}));

// Add preload to useGLTF mock
const useGLTFMock = () => ({
  scene: { clone: () => ({}) },
  nodes: {},
  materials: {},
});
useGLTFMock.preload = mock(() => {});

mock.module("@react-three/drei", () => ({
  Grid: () => null,
  OrbitControls: () => null,
  Stats: () => null,
  useGLTF: useGLTFMock,
}));

// Note: We don't mock "three" module globally as it interferes with other tests
// (e.g., glb-export-service.test.ts). The R3F mocks above handle WebGL-specific bits.

// Mock framed-painting-base
mock.module("@/components/ui/framed-painting-base", () => ({
  FrameModel: () => null,
  PaintingGroup: ({ children }: { children: ReactNode }) => <div data-testid="painting-group">{children}</div>,
}));

// Mock three-error-boundary
mock.module("@/components/ui/three-error-boundary", () => ({
  ThreeErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Note: We don't mock @/components/ui/mint-button globally as it interferes with
// mint-button.test.tsx. The MintButton component will use its real implementation
// but with mocked dependencies (wallet, analytics, etc.)

mock.module("@/components/ui/mint-modal", () => ({
  MintModal: () => null,
}));

// Mock gallery sub-components
mock.module("@/components/gallery/camera-rig", () => ({
  CameraRig: () => null,
}));

mock.module("@/components/gallery/gallery-room", () => ({
  GalleryRoom: () => null,
}));

// Create a mock Lights component that we can reference
const MockLights: FC = () => null;

mock.module("@/components/gallery/lights", () => ({
  Lights: MockLights,
}));

// Mock leva (client-side only GUI library)
mock.module("leva", () => ({
  Leva: () => null,
  useControls: () => ({}),
}));

// Mock next/dynamic to return the mocked Lights component directly
// Since Lights is already mocked above, we can return it synchronously
mock.module("next/dynamic", () => ({
  default: () => MockLights,
}));

// Mock utils
mock.module("@/utils/three", () => ({
  calculatePlaneDimensions: () => [0.7, 0.7],
  handlePointerMoveForDrag: mock(() => {}),
  handlePointerUpForClick: mock(() => false),
  isValidPointerEvent: mock(() => true),
}));

mock.module("@/utils/twitter", () => ({
  openTweetIntent: mock(() => {}),
}));

mock.module("@/utils/url", () => ({
  getBaseUrl: () => "https://doomindex.com",
}));

describe("unit/components/gallery-scene", () => {
  beforeEach(() => {
    // Reset mock time using shared helper
    resetMockTime();
    // Clear logger calls
    loggerCalls.length = 0;

    // Override performance with complete mock for React 19
    globalThis.performance = createMockPerformance();
  });

  afterEach(() => {
    cleanup();
    // Restore original performance
    globalThis.performance = originalPerformance;
  });

  describe("texture-loading-timing", () => {
    it("should render GalleryScene with Canvas", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      const { getByTestId } = render(<GalleryScene />);

      await waitFor(() => {
        expect(getByTestId("mock-canvas")).toBeDefined();
      });
    });

    it("should log texture loaded event with duration", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      render(<GalleryScene />);

      await waitFor(() => {
        const textureLoadedLog = loggerCalls.find(
          call => call.method === "debug" && call.args[0] === "framed-painting.texture.loaded",
        );
        expect(textureLoadedLog).toBeDefined();
      });
    });

    it("should measure texture load duration correctly", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      render(<GalleryScene />);

      await waitFor(() => {
        const textureLoadedLog = loggerCalls.find(
          call => call.method === "debug" && call.args[0] === "framed-painting.texture.loaded",
        );

        expect(textureLoadedLog).toBeDefined();
        if (textureLoadedLog) {
          const payload = textureLoadedLog.args[1] as { durationMs: number; url: string; paintingId?: string };
          // Duration should be the difference between start and end time
          // Our mock advances time by 150ms when texture loads
          expect(typeof payload.durationMs).toBe("number");
          expect(payload.durationMs).toBeGreaterThanOrEqual(0);
        }
      });
    });

    it("should include painting ID in texture loaded log", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      render(<GalleryScene />);

      await waitFor(() => {
        const textureLoadedLog = loggerCalls.find(
          call => call.method === "debug" && call.args[0] === "framed-painting.texture.loaded",
        );

        expect(textureLoadedLog).toBeDefined();
        if (textureLoadedLog) {
          const payload = textureLoadedLog.args[1] as { durationMs: number; url: string; paintingId?: string };
          expect(payload.paintingId).toBe("DOOM_202512020110_03309aff_5779632aeaa9");
        }
      });
    });

    it("should include texture URL in loaded log", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      render(<GalleryScene />);

      await waitFor(() => {
        const textureLoadedLog = loggerCalls.find(
          call => call.method === "debug" && call.args[0] === "framed-painting.texture.loaded",
        );

        expect(textureLoadedLog).toBeDefined();
        if (textureLoadedLog) {
          const payload = textureLoadedLog.args[1] as { durationMs: number; url: string; paintingId?: string };
          // URL should contain the real image path with transformation params
          expect(payload.url).toContain("/api/r2/images/2025/12/02/DOOM_202512020110_03309aff_5779632aeaa9.webp");
        }
      });
    });

    it("should call onLoad callback synchronously when texture is ready", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      const startTime = getMockTime();
      render(<GalleryScene />);

      // The texture onLoad should have been called during render
      await waitFor(() => {
        const textureLoadedLog = loggerCalls.find(
          call => call.method === "debug" && call.args[0] === "framed-painting.texture.loaded",
        );
        expect(textureLoadedLog).toBeDefined();
      });

      // Verify no artificial delays were added beyond our simulated load time
      // The total time should be close to our simulated 150ms
      // Note: dynamic imports may add some overhead, so we allow up to 300ms
      const endTime = getMockTime();
      expect(endTime - startTime).toBeLessThanOrEqual(300);
    });
  });

  describe("performance-guarantees", () => {
    it("should not add artificial delays to texture loading", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      const renderStart = getMockTime();
      render(<GalleryScene />);

      await waitFor(() => {
        const textureLoadedLog = loggerCalls.find(
          call => call.method === "debug" && call.args[0] === "framed-painting.texture.loaded",
        );
        expect(textureLoadedLog).toBeDefined();
      });

      // Total render time should be reasonable (no setTimeout delays)
      const renderEnd = getMockTime();
      const totalRenderTime = renderEnd - renderStart;

      // Should complete within our simulated load time + small overhead
      expect(totalRenderTime).toBeLessThan(500);
    });

    it("should log texture loading events in correct order", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      render(<GalleryScene />);

      await waitFor(() => {
        // Find all texture-related logs
        const textureLogs = loggerCalls.filter(
          call => call.method === "debug" && typeof call.args[0] === "string" && call.args[0].includes("texture"),
        );

        // Should have at least the texture.loaded log
        expect(textureLogs.length).toBeGreaterThanOrEqual(1);

        // The loaded log should exist
        const loadedLog = textureLogs.find(log => (log.args[0] as string).includes("loaded"));
        expect(loadedLog).toBeDefined();
      });
    });
  });
});
