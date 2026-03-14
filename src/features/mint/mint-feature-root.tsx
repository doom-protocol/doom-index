"use client";

import { LazyWalletProvider } from "@/components/providers/lazy-wallet-provider";
import { MintModal } from "@/components/ui/mint-modal";
import { useEffect, useRef } from "react";
import { useMintFeatureStore } from "./store";

const MODAL_TRANSITION_MS = 500;

export function MintFeatureRoot() {
  const clearMintFeature = useMintFeatureStore((state) => state.clearMintFeature);
  const closeMintFeature = useMintFeatureStore((state) => state.closeMintFeature);
  const isOpen = useMintFeatureStore((state) => state.isOpen);
  const paintingMetadata = useMintFeatureStore((state) => state.paintingMetadata);
  const closeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen || !paintingMetadata) {
      return;
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      clearMintFeature();
      closeTimeoutRef.current = null;
    }, MODAL_TRANSITION_MS);

    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [clearMintFeature, isOpen, paintingMetadata]);

  if (!paintingMetadata) {
    return null;
  }

  return (
    <LazyWalletProvider>
      <MintModal
        isOpen={isOpen}
        onClose={() => {
          closeMintFeature();
        }}
        paintingMetadata={paintingMetadata}
      />
    </LazyWalletProvider>
  );
}
