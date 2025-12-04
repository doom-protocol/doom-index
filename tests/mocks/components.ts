/**
 * Mock utilities for components
 * Provides reusable mocks for @/components/* modules
 *
 * Usage:
 *   import { mock } from "bun:test";
 *   import { createGalleryComponentMocks, createUIComponentMocks } from "@/tests/mocks/components";
 *
 *   mock.module("@/components/gallery/camera-rig", createGalleryComponentMocks().cameraRig);
 *   mock.module("@/components/ui/mint-modal", createUIComponentMocks().mintModal);
 */

import React, { type ReactElement, type ReactNode } from "react";

type GalleryComponentMocks = {
  cameraRig: () => { CameraRig: () => ReactElement | null };
  galleryRoom: () => { GalleryRoom: () => ReactElement | null };
  lights: () => { Lights: () => ReactElement | null };
};

type UIComponentMocks = {
  framedPaintingBase: () => {
    FrameModel: () => ReactElement | null;
    PaintingGroup: ({ children }: { children: ReactNode }) => ReactElement;
  };
  threeErrorBoundary: () => { ThreeErrorBoundary: ({ children }: { children: ReactNode }) => ReactElement };
  mintModal: () => { MintModal: React.FC<{ isOpen: boolean }> };
};

/**
 * Create mocks for gallery components
 * Returns an object with factory functions for each component
 */
export function createGalleryComponentMocks(): GalleryComponentMocks {
  return {
    cameraRig: () => ({
      CameraRig: () => null,
    }),
    galleryRoom: () => ({
      GalleryRoom: () => null,
    }),
    lights: () => ({
      Lights: () => null,
    }),
  };
}

/**
 * Create mocks for UI components
 * Returns an object with factory functions for each component
 */
export function createUIComponentMocks(): UIComponentMocks {
  const MockMintModal: React.FC<{ isOpen: boolean }> = ({ isOpen }) =>
    isOpen ? React.createElement("div", { "data-testid": "mint-modal" }, "Modal") : null;
  MockMintModal.displayName = "MockMintModal";

  return {
    framedPaintingBase: () => ({
      FrameModel: () => null,
      PaintingGroup: ({ children }: { children: ReactNode }) =>
        React.createElement("div", { "data-testid": "painting-group" }, children),
    }),
    threeErrorBoundary: () => ({
      ThreeErrorBoundary: ({ children }: { children: ReactNode }) =>
        React.createElement(React.Fragment, null, children),
    }),
    mintModal: () => ({
      MintModal: MockMintModal,
    }),
  };
}
