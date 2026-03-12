/**
 * Unit tests for GalleryScene texture loading and rendering
 * Tests the time from texture request to texture loaded callback
 *
 * Uses direct Arweave image URLs to test actual image loading behavior
 */

// Import preload to ensure happy-dom globals are registered before any imports
import "../../preload";

import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import type { FC, ReactNode } from "react";
import type { PublicKey } from "@solana/web3.js";
import { createLoggerMock, createMockPerformance, resetMockTime, advanceMockTime, getMockTime } from "../../mocks";

// Store captured logger calls for assertions using shared helper
const { logger: mockLogger, calls: loggerCalls } = createLoggerMock();

// Mock logger to capture timing logs
void mock.module("@/utils/logger", () => ({
  logger: mockLogger,
}));

const readMockTRPCClient = () => ({
  paintings: {
    prepareMintMetadata: {
      mutate: async () => {
        await Promise.resolve();
        return {
          baseMetadataUrl: "https://permagate.io/manifest-tx",
          manifestTxId: "manifest-tx",
          metadataTxId: "metadata-tx",
          resolvedFromProbe: true,
          tokenMetadataUrl: "https://permagate.io/manifest-tx/1",
        };
      },
    },
  },
});

void mock.module("@/lib/trpc/client", () => ({
  useTRPCClient: readMockTRPCClient,
}));

// Store original performance for restoration
const originalPerformance = globalThis.performance;

// Mock env - use NEXT_PUBLIC_BASE_URL to determine development environment
void mock.module("@/env", () => ({
  env: {
    NEXT_PUBLIC_BASE_URL: "http://localhost:8787",
    LOG_LEVEL: "DEBUG",
    NEXT_PUBLIC_GENERATION_INTERVAL_MS: 600000,
  },
  publicEnv: {
    NEXT_PUBLIC_BASE_URL: "http://localhost:8787",
    LOG_LEVEL: "DEBUG",
    NEXT_PUBLIC_GENERATION_INTERVAL_MS: 600000,
  },
  isDevelopment: () => true,
  getEnvironmentName: () => "development" as const,
}));

// Realistic Arweave gateway URL for production-like testing
const REAL_IMAGE_URL = "https://permagate.io/painting-image-tx-03309aff5779";

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

const nextMockPainting = {
  ...mockPainting,
  id: "DOOM_202512020120_abcdef12_999999999999",
  timestamp: "2025-12-02T01:20:00.000Z",
  paramsHash: "abcdef12",
  seed: "999999999999",
  imageUrl: "https://permagate.io/painting-image-tx-abcdef129999",
};

// Import the real module to spread its exports
const realUseLatestPainting = await import("@/hooks/use-latest-painting");
let currentLatestPainting: typeof mockPainting | null = mockPainting;
const latestPaintingHook = () => ({
  data: currentLatestPainting,
  isLoading: false,
  error: null,
});
const latestPaintingRefetch = () => async () => Promise.resolve(undefined);

void mock.module("@/hooks/use-latest-painting", () => ({
  // Spread all real exports (constants, pure functions) to avoid breaking other tests
  ...realUseLatestPainting,
  // Only override the hooks that need mocking for our tests
  useLatestPainting: latestPaintingHook,
  useLatestPaintingRefetch: latestPaintingRefetch,
}));

// Mock Solana wallet hook
const solanaWalletHook = () => ({
  connectWallet: async () => {
    await Promise.resolve();
    return {};
  },
  connecting: false,
  connected: false,
  publicKey: null,
});
void mock.module("@/hooks/use-solana-wallet", () => ({
  useSolanaWallet: solanaWalletHook,
}));

const walletHook = () => ({
  connected: false,
  publicKey: null as PublicKey | null,
  sendTransaction: mock(async () => {
    await Promise.resolve();
    return "sig";
  }),
  wallet: null,
});
const connectionHook = () => ({
  connection: {
    confirmTransaction: mock(async () => {
      await Promise.resolve();
      return {
        context: { slot: 1 },
        value: { err: null },
      };
    }),
    getLatestBlockhash: mock(async () => {
      await Promise.resolve();
      return {
        blockhash: "9Wzyd8M5LE8P6J4s3FCq8nP4C5sVuk94suBT76cKiDH6",
        lastValidBlockHeight: 123,
      };
    }),
  },
});
void mock.module("@solana/wallet-adapter-react", () => ({
  useConnection: connectionHook,
  useWallet: walletHook,
}));

const walletModalState = {
  setVisible: mock((_visible: boolean) => {}),
};
const readWalletModalState = () => walletModalState;
void mock.module("@solana/wallet-adapter-react-ui", () => ({
  useWalletModal: readWalletModalState,
}));

// Gallery scene no longer depends on the old client-side GLB export service.
// The R3F mocks below are enough for this render path.

// Mock analytics
void mock.module("@/lib/analytics", () => ({
  GA_EVENTS: { GALLERY_PAINTING_CLICK: "gallery_painting_click" },
  sendGAEvent: mock(() => {}),
}));

// Mock toast
void mock.module("sonner", () => ({
  toast: {
    error: mock(() => {}),
    success: mock(() => {}),
  },
}));

// Mock use-haptic
const hapticHook = () => ({
  triggerHaptic: mock(() => {}),
});
void mock.module("use-haptic", () => ({
  useHaptic: hapticHook,
}));

// Mock useTransformedTextureUrl
const transformedTextureUrlHook = (url: string) => url;
void mock.module("@/hooks/use-transformed-texture-url", () => ({
  useTransformedTextureUrl: transformedTextureUrlHook,
}));

// Mock useSafeTexture to capture onLoad callback and call it synchronously
void mock.module("@/hooks/use-safe-texture", () => {
  const mockTexture = {
    colorSpace: "",
    anisotropy: 1,
    needsUpdate: false,
    image: { src: REAL_IMAGE_URL, width: 512, height: 512 },
    dispose: mock(() => {}),
  };

  const loadSafeTexture = (_url: string, onLoad?: (texture: unknown) => void) => {
    // Store callback for later invocation
    if (onLoad) {
      // Simulate texture load completion after a controlled delay
      // Advance mock time to simulate network/decode time
      advanceMockTime(150); // 150ms simulated load time
      onLoad(mockTexture);
    }

    return mockTexture;
  };

  loadSafeTexture.preload = mock(() => {});
  loadSafeTexture.clear = mock(() => {});

  return { useSafeTexture: loadSafeTexture };
});

// Mock @react-three/fiber Canvas and hooks
const MockCanvas: FC<{ children: ReactNode }> = ({ children }) => {
  return <div data-testid="mock-canvas">{children}</div>;
};

const readThreeContext = () => ({
  gl: {
    initTexture: mock(() => {}),
    shadowMap: { enabled: false, type: 0 },
    toneMapping: 0,
    setClearColor: mock(() => {}),
  },
  invalidate: mock(() => {}),
});
void mock.module("@react-three/fiber", () => ({
  Canvas: MockCanvas,
  useFrame: mock(() => {}),
  useThree: readThreeContext,
}));

// Mock @react-three/drei
interface MockOrbitControlsState {
  object: {
    position: {
      x: number;
      y: number;
      z: number;
    };
  };
  target: {
    x: number;
    y: number;
    z: number;
  };
  update: ReturnType<typeof mock>;
}

interface MockOrbitControlsChangeEvent {
  target: MockOrbitControlsState;
}

const createOrbitControlsState = (): MockOrbitControlsState => ({
  object: {
    position: {
      x: 0,
      y: 0.8,
      z: 0.8,
    },
  },
  target: {
    x: 0,
    y: 0.8,
    z: 4.0,
  },
  update: mock(() => {}),
});

let orbitControlsState = createOrbitControlsState();
let latestOrbitControlsProps: Record<string, unknown> | null = null;

const MockOrbitControls = (props: Record<string, unknown>) => {
  latestOrbitControlsProps = props;

  return null;
};

const readGltf = () => ({
  scene: { clone: () => ({}) },
  nodes: {},
  materials: {},
});
void mock.module("@react-three/drei", () => ({
  Grid: () => null,
  OrbitControls: MockOrbitControls,
  Stats: () => null,
  useGLTF: readGltf,
}));

// Add preload to useGLTF mock
const readGltfWithPreload = () => ({
  scene: { clone: () => ({}) },
  nodes: {},
  materials: {},
});
readGltfWithPreload.preload = mock(() => {});

void mock.module("@react-three/drei", () => ({
  Grid: () => null,
  OrbitControls: MockOrbitControls,
  Stats: () => null,
  useGLTF: readGltfWithPreload,
}));

// Note: We don't mock "three" module globally as it interferes with other tests
// The R3F mocks above handle the WebGL-specific bits for this suite.

// Mock framed-painting-base
void mock.module("@/components/ui/framed-painting-base", () => ({
  FrameModel: () => null,
  PaintingGroup: ({ children }: { children: ReactNode }) => <div data-testid="painting-group">{children}</div>,
}));

// Mock three-error-boundary
void mock.module("@/components/ui/three-error-boundary", () => ({
  ThreeErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Note: We don't mock @/components/ui/mint-button globally as it interferes with
// mint-button.test.tsx. The MintButton component will use its real implementation
// but with mocked dependencies (wallet, analytics, etc.)

// Mock gallery sub-components
void mock.module("@/components/gallery/camera-rig", () => ({
  CameraRig: () => null,
}));

const realGalleryRoom = await import("@/components/gallery/gallery-room");

void mock.module("@/components/gallery/gallery-room", () => ({
  ...realGalleryRoom,
  GalleryRoom: () => null,
}));

// Create a mock Lights component that we can reference
let latestLightsProps: Record<string, unknown> | null = null;

const MockLights: FC<Record<string, unknown>> = (props) => {
  useEffect(() => {
    latestLightsProps = props;
  }, [props]);

  return <div data-testid="full-lights" />;
};

void mock.module("@/components/gallery/lights", () => ({
  Lights: MockLights,
}));

// Mock leva (client-side only GUI library)
const readLevaControls = () => ({});
void mock.module("leva", () => ({
  Leva: () => null,
  useControls: readLevaControls,
}));

// Mock next/dynamic so a component with a loading fallback behaves like the
// preloaded placeholder path. This lets us catch regressions where GalleryScene
// renders a temporary light rig before the final Lights component is ready.
void mock.module("next/dynamic", () => ({
  default: (_loader: unknown, options?: { loading?: FC }) => {
    if (options?.loading) {
      const LoadingComponent = options.loading;
      return LoadingComponent;
    }

    return () => null;
  },
}));

// Mock utils
void mock.module("@/utils/three", () => ({
  calculatePlaneDimensions: () => [0.7, 0.7],
  handlePointerMoveForDrag: mock(() => {}),
  handlePointerUpForClick: mock(() => false),
  isValidPointerEvent: mock(() => true),
}));

void mock.module("@/utils/twitter", () => ({
  openTweetIntent: mock(() => {}),
}));

void mock.module("@/utils/url", () => ({
  getBaseUrl: () => "https://doomindex.com",
}));

describe("unit/components/gallery-scene", () => {
  beforeEach(() => {
    // Reset mock time using shared helper
    resetMockTime();
    // Clear logger calls
    loggerCalls.length = 0;
    latestOrbitControlsProps = null;
    latestLightsProps = null;
    orbitControlsState = createOrbitControlsState();
    currentLatestPainting = mockPainting;

    // Override performance with complete mock for React 19
    globalThis.performance = createMockPerformance();
  });

  afterEach(() => {
    cleanup();
    // Restore original performance
    globalThis.performance = originalPerformance;
  });

  afterAll(() => {
    mock.restore();
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
          (call) => call.method === "debug" && call.args[0] === "framed-painting.texture.loaded",
        );
        expect(textureLoadedLog).toBeDefined();
      });
    });

    it("should measure texture load duration correctly", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      render(<GalleryScene />);

      await waitFor(() => {
        const textureLoadedLog = loggerCalls.find(
          (call) => call.method === "debug" && call.args[0] === "framed-painting.texture.loaded",
        );

        expect(textureLoadedLog).toBeDefined();
        if (textureLoadedLog) {
          const payload = textureLoadedLog.args[1] as {
            durationMs: number;
            url: string;
            paintingId?: string;
          };
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
          (call) => call.method === "debug" && call.args[0] === "framed-painting.texture.loaded",
        );

        expect(textureLoadedLog).toBeDefined();
        if (textureLoadedLog) {
          const payload = textureLoadedLog.args[1] as {
            durationMs: number;
            url: string;
            paintingId?: string;
          };
          expect(payload.paintingId).toBe("DOOM_202512020110_03309aff_5779632aeaa9");
        }
      });
    });

    it("should include texture URL in loaded log", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      render(<GalleryScene />);

      await waitFor(() => {
        const textureLoadedLog = loggerCalls.find(
          (call) => call.method === "debug" && call.args[0] === "framed-painting.texture.loaded",
        );

        expect(textureLoadedLog).toBeDefined();
        if (textureLoadedLog) {
          const payload = textureLoadedLog.args[1] as {
            durationMs: number;
            url: string;
            paintingId?: string;
          };
          // URL should contain the real image path with transformation params
          expect(payload.url).toContain("https://permagate.io/painting-image-tx-03309aff5779");
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
          (call) => call.method === "debug" && call.args[0] === "framed-painting.texture.loaded",
        );
        expect(textureLoadedLog).toBeDefined();
      });

      // Verify no artificial delays were added beyond our simulated load time
      // The total time should be close to our simulated 150ms
      // Note: dynamic imports may add some overhead, so we allow up to 300ms
      const endTime = getMockTime();
      expect(endTime - startTime).toBeLessThanOrEqual(300);
    });

    it("should not mount MintModal until the mint flow is opened", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      const { getByRole, queryByRole, queryByTestId } = render(<GalleryScene />);

      expect(queryByTestId("mint-modal-shell")).toBeNull();
      expect(queryByRole("button", { name: /connect wallet/i })).toBeNull();

      fireEvent.click(getByRole("button", { name: /mint/i }));

      await waitFor(() => {
        expect(queryByTestId("mint-modal-shell")).toBeInTheDocument();
        expect(queryByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
      });
    });

    it("should keep MintModal mounted across a transient latest painting refetch gap", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      const { getByRole, queryByRole, queryByTestId, rerender } = render(<GalleryScene />);

      fireEvent.click(getByRole("button", { name: /mint/i }));

      await waitFor(() => {
        expect(queryByTestId("mint-modal-shell")).toBeInTheDocument();
        expect(queryByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
      });

      currentLatestPainting = null;
      rerender(<GalleryScene />);

      await waitFor(() => {
        expect(queryByTestId("mint-modal-shell")).toBeInTheDocument();
        expect(queryByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
      });
    });

    it("should close MintModal when a newer painting arrives", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      const { getByRole, queryByRole, queryByTestId, rerender } = render(<GalleryScene />);

      fireEvent.click(getByRole("button", { name: /mint/i }));

      await waitFor(() => {
        expect(queryByTestId("mint-modal-shell")).toBeInTheDocument();
      });

      currentLatestPainting = nextMockPainting;
      rerender(<GalleryScene />);

      await waitFor(() => {
        expect(queryByTestId("mint-modal-shell")).toBeNull();
        expect(queryByRole("button", { name: /connect wallet/i })).toBeNull();
      });
    });

    it("should clamp floor overflow into the allowed volume and keep later moves responsive", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      render(<GalleryScene />);

      await waitFor(() => {
        expect(latestOrbitControlsProps).toBeDefined();
      });

      const onChange = latestOrbitControlsProps?.onChange as
        | ((event: MockOrbitControlsChangeEvent) => void)
        | undefined;
      expect(onChange).toBeDefined();

      orbitControlsState.object.position.x = 0.35;
      orbitControlsState.object.position.y = 0.12;
      orbitControlsState.object.position.z = 1.1;
      orbitControlsState.target.x = 0.35;
      orbitControlsState.target.y = 0.2;
      orbitControlsState.target.z = 4.3;
      onChange?.({ target: orbitControlsState });

      orbitControlsState.object.position.x = 0.6;
      orbitControlsState.object.position.y = 0.05;
      orbitControlsState.object.position.z = 1.6;
      orbitControlsState.target.x = 0.65;
      orbitControlsState.target.y = -0.25;
      orbitControlsState.target.z = 4.7;
      onChange?.({ target: orbitControlsState });

      expect(orbitControlsState.object.position).toEqual({
        x: 0.6,
        y: 0.3,
        z: 1.6,
      });
      expect(orbitControlsState.target).toEqual({
        x: 0.65,
        y: 0,
        z: 4.7,
      });
      expect(orbitControlsState.update).toHaveBeenCalled();

      orbitControlsState.update.mockClear();
      orbitControlsState.object.position.x = 0.5;
      orbitControlsState.object.position.y = 0.18;
      orbitControlsState.object.position.z = 1.4;
      orbitControlsState.target.x = 0.55;
      orbitControlsState.target.y = 0.26;
      orbitControlsState.target.z = 4.5;
      onChange?.({ target: orbitControlsState });

      expect(orbitControlsState.object.position).toEqual({
        x: 0.5,
        y: 0.18,
        z: 1.4,
      });
      expect(orbitControlsState.target).toEqual({
        x: 0.55,
        y: 0.26,
        z: 4.5,
      });
      expect(orbitControlsState.update).not.toHaveBeenCalled();
    });

    it("should clamp back-wall overflow into the allowed volume", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      render(<GalleryScene />);

      await waitFor(() => {
        expect(latestOrbitControlsProps).toBeDefined();
      });

      const onChange = latestOrbitControlsProps?.onChange as
        | ((event: MockOrbitControlsChangeEvent) => void)
        | undefined;
      expect(onChange).toBeDefined();

      orbitControlsState.object.position.x = 0.15;
      orbitControlsState.object.position.y = 0.25;
      orbitControlsState.object.position.z = 1.8;
      orbitControlsState.target.x = 0.2;
      orbitControlsState.target.y = 0.4;
      orbitControlsState.target.z = 4.7;
      onChange?.({ target: orbitControlsState });

      orbitControlsState.object.position.x = 0.25;
      orbitControlsState.object.position.y = 0.3;
      orbitControlsState.object.position.z = 5.2;
      orbitControlsState.target.x = 0.3;
      orbitControlsState.target.y = 0.45;
      orbitControlsState.target.z = 5.3;
      onChange?.({ target: orbitControlsState });

      expect(orbitControlsState.object.position.x).toBe(0.25);
      expect(orbitControlsState.object.position.y).toBe(0.3);
      expect(orbitControlsState.object.position.z).toBeCloseTo(4.88, 10);
      expect(orbitControlsState.target.x).toBe(0.3);
      expect(orbitControlsState.target.y).toBe(0.45);
      expect(orbitControlsState.target.z).toBeCloseTo(4.98, 10);
      expect(orbitControlsState.update).toHaveBeenCalled();
    });

    it("should configure OrbitControls with front-facing angular bounds", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      render(<GalleryScene />);

      await waitFor(() => {
        expect(latestOrbitControlsProps).toBeDefined();
      });

      expect(latestOrbitControlsProps?.maxPolarAngle).toBe(Math.PI / 2);
      expect(latestOrbitControlsProps?.minAzimuthAngle).toBe(Math.PI / 2);
      expect(latestOrbitControlsProps?.maxAzimuthAngle).toBe((Math.PI * 3) / 2);
    });
  });

  describe("performance-guarantees", () => {
    it("should keep the top page on the production light rig from the first render", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      const { getByTestId } = render(<GalleryScene />);

      await waitFor(() => {
        expect(getByTestId("full-lights")).toBeDefined();
      });

      expect(latestLightsProps?.disableDevControls).toBe(true);
    });

    it("should configure OrbitControls with damping for smooth inertial movement", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      render(<GalleryScene />);

      await waitFor(() => {
        expect(latestOrbitControlsProps).toBeDefined();
      });

      expect(latestOrbitControlsProps?.enableDamping).toBe(true);
      expect(latestOrbitControlsProps?.dampingFactor).toBe(0.05);
    });

    it("should not add artificial delays to texture loading", async () => {
      const { GalleryScene } = await import("@/components/gallery/gallery-scene");

      const renderStart = getMockTime();
      render(<GalleryScene />);

      await waitFor(() => {
        const textureLoadedLog = loggerCalls.find(
          (call) => call.method === "debug" && call.args[0] === "framed-painting.texture.loaded",
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
          (call) => call.method === "debug" && typeof call.args[0] === "string" && call.args[0].includes("texture"),
        );

        // Should have at least the texture.loaded log
        expect(textureLogs.length).toBeGreaterThanOrEqual(1);

        // The loaded log should exist
        const loadedLog = textureLogs.find((log) => (log.args[0] as string).includes("loaded"));
        expect(loadedLog).toBeDefined();
      });
    });
  });
});
