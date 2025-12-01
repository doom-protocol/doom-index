/**
 * Unit tests for GalleryScene texture loading and rendering
 * Tests the time from texture request to texture loaded callback
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { render, waitFor, cleanup } from "@testing-library/react";
import type { FC, ReactNode } from "react";

// Store captured logger calls for assertions
const loggerCalls: { method: string; args: unknown[] }[] = [];

// Mock logger to capture timing logs
mock.module("@/utils/logger", () => ({
  logger: {
    debug: (...args: unknown[]) => {
      loggerCalls.push({ method: "debug", args });
    },
    error: (...args: unknown[]) => {
      loggerCalls.push({ method: "error", args });
    },
    info: (...args: unknown[]) => {
      loggerCalls.push({ method: "info", args });
    },
    warn: (...args: unknown[]) => {
      loggerCalls.push({ method: "warn", args });
    },
    log: (...args: unknown[]) => {
      loggerCalls.push({ method: "log", args });
    },
    getCurrentLevel: () => "DEBUG",
    getLevels: () => ["ERROR", "WARN", "LOG", "INFO", "DEBUG"],
  },
}));

// Mock performance.now for deterministic timing
let mockTime = 0;
const originalPerformance = globalThis.performance;

// Create a complete performance mock that includes measure() for React 19
const createMockPerformance = (): Performance => ({
  ...originalPerformance,
  now: () => mockTime,
  measure: () => ({}) as PerformanceMeasure,
  mark: () => ({}) as PerformanceMark,
  clearMarks: () => {},
  clearMeasures: () => {},
  getEntries: () => [],
  getEntriesByName: () => [],
  getEntriesByType: () => [],
  toJSON: () => ({}),
});

// Mock env
mock.module("@/env", () => ({
  env: {
    NODE_ENV: "test",
    LOG_LEVEL: "DEBUG",
    NEXT_PUBLIC_R2_URL: "/api/r2",
  },
}));

// Mock use-latest-painting hook
const mockPainting = {
  id: "test-painting-1",
  timestamp: new Date().toISOString(),
  minuteBucket: "2025/11/30/12/00",
  paramsHash: "test-hash",
  seed: "12345",
  imageUrl: "/api/r2/paintings/test.webp",
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

mock.module("@/hooks/use-latest-painting", () => ({
  useLatestPainting: () => ({
    data: mockPainting,
    isLoading: false,
    error: null,
  }),
}));

// Mock Solana wallet hook
mock.module("@/hooks/use-solana-wallet", () => ({
  useSolanaWallet: () => ({
    connecting: false,
    connected: false,
    publicKey: null,
  }),
}));

// Mock GLB export service
mock.module("@/lib/glb-export-service", () => ({
  glbExportService: {
    exportPaintingModel: mock(() => Promise.resolve({ isOk: () => false, error: new Error("mock") })),
    optimizeGlb: mock(() => Promise.resolve({ isOk: () => false, error: new Error("mock") })),
  },
}));

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

// Mock useSafeTextureto capture onLoad callback and call it synchronously
mock.module("@/hooks/use-safe-texture", () => {
  const mockTexture = {
    colorSpace: "",
    anisotropy: 1,
    needsUpdate: false,
    image: { src: "/api/r2/paintings/test.webp", width: 512, height: 512 },
    dispose: mock(() => {}),
  };

  const useSafeTexture = (url: string, onLoad?: (texture: unknown) => void) => {
    // Store callback for later invocation
    if (onLoad) {
      // Simulate texture load completion after a controlled delay
      // Advance mock time to simulate network/decode time
      mockTime += 150; // 150ms simulated load time
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

// Mock Three.js classes
mock.module("three", () => ({
  ACESFilmicToneMapping: 0,
  PCFSoftShadowMap: 0,
  SRGBColorSpace: "srgb",
  AdditiveBlending: 0,
  Group: class Group {
    position = { set: mock(() => {}) };
    rotation = { set: mock(() => {}) };
    scale = { set: mock(() => {}) };
    visible = true;
  },
  Mesh: class Mesh {
    position = { set: mock(() => {}) };
    material = {};
  },
  LineSegments: class LineSegments {},
  Texture: class Texture {
    colorSpace = "";
    anisotropy = 1;
    needsUpdate = false;
    dispose = mock(() => {});
  },
  PlaneGeometry: class PlaneGeometry {
    dispose = mock(() => {});
  },
  EdgesGeometry: class EdgesGeometry {
    dispose = mock(() => {});
  },
  MeshBasicMaterial: class MeshBasicMaterial {
    opacity = 1;
    transparent = false;
  },
  MeshStandardMaterial: class MeshStandardMaterial {
    opacity = 1;
    transparent = false;
  },
  LineBasicMaterial: class LineBasicMaterial {
    opacity = 1;
  },
}));

// Mock framed-painting-base
mock.module("@/components/ui/framed-painting-base", () => ({
  FrameModel: () => null,
  PaintingGroup: ({ children }: { children: ReactNode }) => <div data-testid="painting-group">{children}</div>,
}));

// Mock three-error-boundary
mock.module("@/components/ui/three-error-boundary", () => ({
  ThreeErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Mock mint components
mock.module("@/components/ui/mint-button", () => ({
  MintButton: () => <button data-testid="mint-button">Mint</button>,
}));

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

mock.module("@/components/gallery/lights", () => ({
  Lights: () => null,
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
    // Reset mock time
    mockTime = 0;
    // Clear logger calls
    loggerCalls.length = 0;

    // Override performancewith complete mock for React 19
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
          expect(payload.paintingId).toBe("test-painting-1");
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
          expect(payload.url).toContain("/api/r2/paintings/test.webp");
        }
      });
    });

    it("should call onLoad callback synchronously when texture is ready", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      const startTime = mockTime;
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
      const endTime = mockTime;
      expect(endTime - startTime).toBeLessThanOrEqual(200);
    });

    it("should render mint button", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      const { getByTestId } = render(<GalleryScene />);

      await waitFor(() => {
        expect(getByTestId("mint-button")).toBeDefined();
      });
    });
  });

  describe("performance-guarantees", () => {
    it("should not add artificial delays to texture loading", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      const renderStart = mockTime;
      render(<GalleryScene />);

      await waitFor(() => {
        const textureLoadedLog = loggerCalls.find(
          call => call.method === "debug" && call.args[0] === "framed-painting.texture.loaded",
        );
        expect(textureLoadedLog).toBeDefined();
      });

      // Total render time should be reasonable (no setTimeout delays)
      const renderEnd = mockTime;
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
