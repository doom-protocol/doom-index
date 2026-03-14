"use client";

import { GalleryRoom } from "@/components/gallery/gallery-room";
import { Lights } from "@/components/gallery/lights";
import { useEscapeKey } from "@/hooks/use-click-outside";
import { sendGAEvent } from "@/lib/analytics";
import type { Painting } from "@/types/paintings";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { FC } from "react";
import { ACESFilmicToneMapping, Vector3 } from "three";
import { useHaptic } from "use-haptic";
import { ArchiveFramedPainting } from "./archive-framed-painting";
import { ArchiveMetadataPanel } from "./archive-metadata-panel";

interface ArchiveDetailViewProps {
  item: Painting;
  onClose: () => void;
}

const DETAIL_FRAME_POSITION: [number, number, number] = [0, 0.8, 4.0];
const INITIAL_CAMERA_POSITION: [number, number, number] = [0, 0.8, 0.8];
const ZOOMED_CAMERA_POSITION: [number, number, number] = [0, 0.8, 2.5];
const CAMERA_LERP_FACTOR = 0.05;

interface CameraAnimationProps {
  isZoomingOut: boolean;
  onZoomOutComplete?: () => void;
}

const CameraAnimation: FC<CameraAnimationProps> = ({ isZoomingOut, onZoomOutComplete }) => {
  const { camera, invalidate } = useThree();
  const targetPositionRef = useRef(new Vector3(...ZOOMED_CAMERA_POSITION));
  const targetLookAtRef = useRef(new Vector3(...DETAIL_FRAME_POSITION));
  const isAnimatingRef = useRef(true);
  const hasCompletedZoomOutRef = useRef(false);

  useEffect(() => {
    if (isZoomingOut) {
      targetPositionRef.current = new Vector3(...INITIAL_CAMERA_POSITION);
      isAnimatingRef.current = true;
      hasCompletedZoomOutRef.current = false;
      invalidate();
    }
  }, [isZoomingOut, invalidate]);

  useFrame(({ invalidate }) => {
    if (!isAnimatingRef.current) {
      return;
    }

    const currentPos = camera.position;
    const targetPos = targetPositionRef.current;

    currentPos.lerp(targetPos, CAMERA_LERP_FACTOR);
    camera.lookAt(targetLookAtRef.current);

    if (currentPos.distanceTo(targetPos) < 0.01) {
      isAnimatingRef.current = false;

      if (isZoomingOut && !hasCompletedZoomOutRef.current && onZoomOutComplete) {
        hasCompletedZoomOutRef.current = true;
        onZoomOutComplete();
      }
    }

    invalidate();
  });

  return null;
};

export const ArchiveDetailView: FC<ArchiveDetailViewProps> = ({ item, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const { triggerHaptic } = useHaptic();

  const handleClose = useCallback(() => {
    triggerHaptic();
    setIsClosing(true);
    setIsVisible(false);
    window.setTimeout(() => {
      onClose();
    }, 800);
  }, [onClose, triggerHaptic]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const timeoutId = window.setTimeout(() => {
      setIsVisible(true);
    }, 50);
    sendGAEvent("archive_detail_view", { painting_id: item.id });
    return () => {
      window.clearTimeout(timeoutId);
      document.body.style.overflow = "";
    };
  }, [item.id]);

  useEscapeKey(handleClose);

  return (
    <div
      className="fixed inset-0 flex flex-col bg-black/95 backdrop-blur-sm lg:flex-row"
      style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", zIndex: 1100 }}
    >
      <button
        type="button"
        onClick={handleClose}
        className="fixed top-4 left-4 z-50 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-all hover:scale-110 hover:bg-white/20"
        aria-label="Back to list"
      >
        <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>

      <div className="relative h-[50vh] w-full lg:h-full lg:w-[60%]">
        <Canvas
          frameloop="demand"
          shadows={false}
          dpr={[1, 1.5]}
          camera={{
            fov: 50,
            position: INITIAL_CAMERA_POSITION,
            near: 0.1,
            far: 100,
          }}
          gl={{
            antialias: true,
            stencil: false,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = ACESFilmicToneMapping;
            gl.setClearColor("#050505");
          }}
          style={{ width: "100%", height: "100%" }}
        >
          <CameraAnimation isZoomingOut={isClosing} />
          <Lights disableDevControls />
          <GalleryRoom />
          <Suspense fallback={null}>
            <ArchiveFramedPainting item={item} framePosition={DETAIL_FRAME_POSITION} />
          </Suspense>
        </Canvas>
      </div>

      <div
        className={`flex h-[50vh] flex-col overflow-y-auto bg-black/80 p-6 transition-opacity duration-300 lg:h-full lg:w-[40%] lg:bg-black/60 ${
          isVisible && !isClosing ? "opacity-100" : "opacity-0"
        }`}
      >
        <ArchiveMetadataPanel item={item} />
      </div>
    </div>
  );
};
