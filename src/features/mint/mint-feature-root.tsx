"use client";

import { LazyWalletProvider } from "@/components/providers/lazy-wallet-provider";
import { MintModal } from "@/components/ui/mint-modal";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMintFeatureStore } from "./store";

const MODAL_TRANSITION_MS = 500;

interface MintPaintingMetadata {
  timestamp: string;
  paintingHash: string;
  thumbnailUrl: string;
}

interface MintModalRenderState {
  isMounted: boolean;
  isOpen: boolean;
  paintingMetadata: MintPaintingMetadata | null;
}

type MintFeatureStoreState = ReturnType<typeof useMintFeatureStore.getState>;

function getPaintingKey(paintingMetadata: MintPaintingMetadata | null | undefined): string | null {
  if (!paintingMetadata) {
    return null;
  }

  return `${paintingMetadata.paintingHash}:${paintingMetadata.timestamp}:${paintingMetadata.thumbnailUrl}`;
}

export function MintFeatureRoot() {
  const clearMintFeature = useMintFeatureStore((state) => state.clearMintFeature);
  const closeMintFeature = useMintFeatureStore((state) => state.closeMintFeature);
  const closeTimeoutRef = useRef<number | null>(null);
  const openFrameRef = useRef<number | null>(null);
  const initialMintFeatureStateRef = useRef(useMintFeatureStore.getState());
  const [modalRenderState, setModalRenderState] = useState<MintModalRenderState>(() => ({
    isMounted: initialMintFeatureStateRef.current.paintingMetadata !== null,
    isOpen: false,
    paintingMetadata: initialMintFeatureStateRef.current.paintingMetadata,
  }));
  const modalStateRef = useRef(modalRenderState);

  const commitModalRenderState = useCallback((nextState: MintModalRenderState) => {
    modalStateRef.current = nextState;
    setModalRenderState(nextState);
  }, []);

  const openModal = useCallback(
    (paintingMetadata: MintPaintingMetadata) => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }

      if (openFrameRef.current !== null) {
        window.cancelAnimationFrame(openFrameRef.current);
        openFrameRef.current = null;
      }

      const currentModalState = modalStateRef.current;
      const incomingPaintingKey = getPaintingKey(paintingMetadata);
      const renderedPaintingKey = getPaintingKey(currentModalState.paintingMetadata);

      if (incomingPaintingKey === renderedPaintingKey && currentModalState.isMounted && currentModalState.isOpen) {
        return;
      }

      commitModalRenderState({
        isMounted: true,
        isOpen: false,
        paintingMetadata,
      });

      openFrameRef.current = window.requestAnimationFrame(() => {
        const nextPaintingMetadata = modalStateRef.current.paintingMetadata ?? paintingMetadata;
        commitModalRenderState({
          isMounted: true,
          isOpen: true,
          paintingMetadata: nextPaintingMetadata,
        });
        openFrameRef.current = null;
      });
    },
    [commitModalRenderState],
  );

  const closeModal = useCallback(() => {
    if (openFrameRef.current !== null) {
      window.cancelAnimationFrame(openFrameRef.current);
      openFrameRef.current = null;
    }

    if (!modalStateRef.current.isMounted) {
      return;
    }

    commitModalRenderState({
      isMounted: true,
      isOpen: false,
      paintingMetadata: modalStateRef.current.paintingMetadata,
    });

    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      commitModalRenderState({
        isMounted: false,
        isOpen: false,
        paintingMetadata: null,
      });
      clearMintFeature();
      closeTimeoutRef.current = null;
    }, MODAL_TRANSITION_MS);
  }, [clearMintFeature, commitModalRenderState]);

  useEffect(() => {
    const syncWithMintFeatureState = (state: MintFeatureStoreState) => {
      if (state.isOpen && state.paintingMetadata) {
        openModal(state.paintingMetadata);
        return;
      }

      if (modalStateRef.current.isMounted) {
        closeModal();
      }
    };

    syncWithMintFeatureState(useMintFeatureStore.getState());
    const unsubscribe = useMintFeatureStore.subscribe(syncWithMintFeatureState);

    return () => {
      unsubscribe();
      if (openFrameRef.current !== null) {
        window.cancelAnimationFrame(openFrameRef.current);
      }
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [closeModal, openModal]);

  if (!modalRenderState.isMounted || !modalRenderState.paintingMetadata) {
    return null;
  }

  return (
    <LazyWalletProvider>
      <MintModal
        isOpen={modalRenderState.isOpen}
        onClose={() => {
          closeMintFeature();
        }}
        paintingMetadata={modalRenderState.paintingMetadata}
      />
    </LazyWalletProvider>
  );
}
