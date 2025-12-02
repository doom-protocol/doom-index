/**
 * Mock utilities for external libraries
 * Provides reusable mocks for third-party npm packages
 *
 * Usage:
 *   import { mock } from "bun:test";
 *   import { createSonnerMock } from "@/tests/mocks/external";
 *
 *   mock.module("sonner", createSonnerMock());
 */

import { mock } from "bun:test";

/**
 * Create mock for sonner (toast notifications)
 * Returns a function that returns the mock module object
 */
export function createSonnerMock() {
  return () => ({
    toast: {
      error: mock(() => {}),
      success: mock(() => {}),
    },
  });
}

/**
 * Create mock for use-haptic
 * Returns a function that returns the mock module object
 */
export function createUseHapticMock() {
  return () => ({
    useHaptic: () => ({
      triggerHaptic: mock(() => {}),
    }),
  });
}

/**
 * Create mock for use-sound
 * Returns a function that returns the mock module object
 */
export function createUseSoundMock() {
  return () => ({
    default: () => [mock(() => {}), { stop: mock(() => {}) }],
  });
}

/**
 * Create mock for @react-three/fiber
 * Returns a function that returns the mock module object
 */
export function createReactThreeFiberMock() {
  const React = require("react");
  const MockCanvas: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return React.createElement("div", { "data-testid": "mock-canvas" }, children);
  };

  return () => ({
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
  });
}

/**
 * Create mock for @react-three/drei
 * Returns a function that returns the mock module object
 */
export function createReactThreeDreiMock() {
  const useGLTFMock = () => ({
    scene: { clone: () => ({}) },
    nodes: {},
    materials: {},
  });
  useGLTFMock.preload = mock(() => {});

  return () => ({
    Grid: () => null,
    OrbitControls: () => null,
    Stats: () => null,
    useGLTF: useGLTFMock,
  });
}
