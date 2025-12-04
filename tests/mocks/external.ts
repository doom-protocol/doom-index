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
import React, { type ReactElement, type ReactNode } from "react";

type BunMock = ReturnType<typeof mock>;

type SonnerMock = () => {
  toast: {
    error: BunMock;
    success: BunMock;
  };
};

type UseHapticMock = () => {
  useHaptic: () => {
    triggerHaptic: BunMock;
  };
};

type UseSoundMock = () => {
  default: () => [BunMock, { stop: BunMock }];
};

type ReactThreeFiberMock = () => {
  Canvas: React.FC<{ children: ReactNode }>;
  useFrame: BunMock;
  useThree: () => {
    gl: {
      initTexture: BunMock;
      shadowMap: { enabled: boolean; type: number };
      toneMapping: number;
      setClearColor: BunMock;
    };
    invalidate: BunMock;
  };
};

type ReactThreeDreiMock = () => {
  Grid: () => ReactElement | null;
  OrbitControls: () => ReactElement | null;
  Stats: () => ReactElement | null;
  useGLTF: {
    (): {
      scene: { clone: () => Record<string, unknown> };
      nodes: Record<string, unknown>;
      materials: Record<string, unknown>;
    };
    preload: BunMock;
  };
};

/**
 * Create mock for sonner (toast notifications)
 * Returns a function that returns the mock module object
 */
export function createSonnerMock(): SonnerMock {
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
export function createUseHapticMock(): UseHapticMock {
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
export function createUseSoundMock(): UseSoundMock {
  return () => ({
    default: () => [mock(() => {}), { stop: mock(() => {}) }],
  });
}

/**
 * Create mock for @react-three/fiber
 * Returns a function that returns the mock module object
 */
export function createReactThreeFiberMock(): ReactThreeFiberMock {
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
export function createReactThreeDreiMock(): ReactThreeDreiMock {
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
