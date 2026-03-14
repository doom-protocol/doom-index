"use client";

import { create } from "zustand";
import type { MintModalProps } from "@/components/ui/mint-modal";

type MintPaintingMetadata = MintModalProps["paintingMetadata"];

interface MintFeatureState {
  isOpen: boolean;
  paintingMetadata: MintPaintingMetadata | null;
  closeMintFeature: () => void;
  clearMintFeature: () => void;
  openMintFeature: (paintingMetadata: MintPaintingMetadata) => void;
  resetMintFeature: () => void;
}

export const useMintFeatureStore = create<MintFeatureState>((set) => ({
  isOpen: false,
  paintingMetadata: null,
  closeMintFeature: () => {
    set({ isOpen: false });
  },
  clearMintFeature: () => {
    set({ paintingMetadata: null });
  },
  openMintFeature: (paintingMetadata) => {
    set({
      isOpen: true,
      paintingMetadata,
    });
  },
  resetMintFeature: () => {
    set({
      isOpen: false,
      paintingMetadata: null,
    });
  },
}));
