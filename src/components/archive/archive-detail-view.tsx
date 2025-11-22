"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ACESFilmicToneMapping, PCFSoftShadowMap, Vector3 } from "three";
import { Stats } from "@react-three/drei";
import { Lights } from "@/components/gallery/lights";
import { GalleryRoom } from "@/components/gallery/gallery-room";
import { ArchiveFramedPainting } from "./archive-framed-painting";
import { env } from "@/env";
import type { Painting } from "@/types/paintings";

interface ArchiveDetailViewProps {
  item: Painting;
  onClose: () => void;
}

const DETAIL_FRAME_POSITION: [number, number, number] = [0, 0.8, 4.0];
const INITIAL_CAMERA_POSITION: [number, number, number] = [0, 0.8, 0.8];
const ZOOMED_CAMERA_POSITION: [number, number, number] = [0, 0.8, 2.5];
const CAMERA_LERP_FACTOR = 0.05;
const isDevelopment = env.NODE_ENV === "development";

// Camera animation component
interface CameraAnimationProps {
  isZoomingOut: boolean;
  onZoomOutComplete?: () => void;
}

const CameraAnimation: React.FC<CameraAnimationProps> = ({ isZoomingOut, onZoomOutComplete }) => {
  const { camera } = useThree();
  const targetPositionRef = useRef(new Vector3(...ZOOMED_CAMERA_POSITION));
  const targetLookAtRef = useRef(new Vector3(...DETAIL_FRAME_POSITION));
  const isAnimatingRef = useRef(true);
  const hasCompletedZoomOutRef = useRef(false);

  useEffect(() => {
    if (isZoomingOut) {
      // Start zoom out animation
      targetPositionRef.current = new Vector3(...INITIAL_CAMERA_POSITION);
      isAnimatingRef.current = true;
      hasCompletedZoomOutRef.current = false;
    }
  }, [isZoomingOut]);

  useFrame(({ invalidate }) => {
    if (!isAnimatingRef.current) {
      return;
    }

    const currentPos = camera.position;
    const targetPos = targetPositionRef.current;

    // Lerp camera position
    currentPos.lerp(targetPos, CAMERA_LERP_FACTOR);

    // Update look at
    camera.lookAt(targetLookAtRef.current);

    // Check if animation is complete
    if (currentPos.distanceTo(targetPos) < 0.01) {
      isAnimatingRef.current = false;

      // If zooming out and callback provided, call it
      if (isZoomingOut && !hasCompletedZoomOutRef.current && onZoomOutComplete) {
        hasCompletedZoomOutRef.current = true;
        onZoomOutComplete();
      }
    }

    invalidate();
  });

  return null;
};

export const ArchiveDetailView: React.FC<ArchiveDetailViewProps> = ({ item, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setIsVisible(false);
    // Wait for zoom out animation to complete
    setTimeout(() => {
      onClose();
    }, 800); // Slightly longer than camera animation
  }, [onClose]);

  // Disable scroll when detail view is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    // Trigger fade in after mount
    setTimeout(() => setIsVisible(true), 50);
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [handleClose]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm lg:flex-row"
      style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}
    >
      {/* Back Button - Liquid Glass Style */}
      <button
        onClick={handleClose}
        className="fixed left-4 top-4 z-50 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-all hover:bg-white/20 hover:scale-110 cursor-pointer"
        aria-label="Back to list"
      >
        <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>

      {/* 3D Scene */}
      <div className="relative h-[50vh] w-full lg:h-full lg:w-[60%]">
        <Canvas
          frameloop="always"
          shadows
          dpr={[1, 1.5]}
          camera={{
            fov: 50,
            position: INITIAL_CAMERA_POSITION,
            near: 0.1,
            far: 100,
          }}
          gl={{
            antialias: true,
            toneMapping: ACESFilmicToneMapping,
          }}
          onCreated={({ gl }) => {
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = PCFSoftShadowMap;
            gl.toneMapping = ACESFilmicToneMapping;
            gl.setClearColor("#050505");
          }}
          style={{
            width: "100%",
            height: "100%",
          }}
        >
          <CameraAnimation isZoomingOut={isClosing} />
          <Lights />
          <GalleryRoom />
          <Suspense fallback={null}>
            <ArchiveFramedPainting item={item} framePosition={DETAIL_FRAME_POSITION} />
          </Suspense>
          {isDevelopment && <Stats />}
        </Canvas>
      </div>

      {/* Metadata Panel */}
      <div
        className={`flex h-[50vh] flex-col overflow-y-auto bg-black/80 p-6 transition-opacity duration-300 lg:h-full lg:w-[40%] lg:bg-black/60 ${
          isVisible && !isClosing ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Metadata Content */}
        <div className="space-y-6 text-white">
          {/* Basic Info */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white/90 normal-case">Basic information</h3>
            <div className="space-y-2 rounded-lg bg-white/5 p-4">
              <div>
                <span className="text-sm text-white/70">Generated:</span>
                <p className="text-sm">{formatTimestamp(item.timestamp)}</p>
              </div>
              <div>
                <span className="text-sm text-white/70">ID:</span>
                <p className="font-mono text-sm">{item.id}</p>
              </div>
              <div>
                <span className="text-sm text-white/70">Seed:</span>
                <p className="font-mono text-sm">{item.seed}</p>
              </div>
              <div>
                <span className="text-sm text-white/70">Params Hash:</span>
                <p className="font-mono text-sm">{item.paramsHash}</p>
              </div>
              <div>
                <span className="text-sm text-white/70">File Size:</span>
                <p className="text-sm">{(item.fileSize / 1024).toFixed(2)} KB</p>
              </div>
            </div>
          </div>

          {/* Visual Parameters */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white/90 normal-case">Visual parameters</h3>
            <div className="space-y-1 rounded-lg bg-white/5 p-4">
              {Object.entries(item.visualParams).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-sm text-white/70">{key}:</span>
                  <span className="font-mono text-sm">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Prompts */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white/90 normal-case">Prompt</h3>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-sm leading-relaxed text-white/90">{item.prompt}</p>
            </div>
          </div>

          {item.negative && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white/90 normal-case">Negative prompt</h3>
              <div className="rounded-lg bg-white/5 p-4">
                <p className="text-sm leading-relaxed text-white/90">{item.negative}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
