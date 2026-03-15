"use client";

import { useLatestPainting } from "@/hooks/use-latest-painting";
import {
  constrainOrbitControlsSnapshot,
  isOrbitControlsWithinBounds,
  restoreOrbitControlsSnapshot,
} from "@/lib/pure/gallery-orbit-bounds";
import type { OrbitControlsBounds } from "@/lib/pure/gallery-orbit-bounds";
import type { PaintingMetadata } from "@/types/paintings";
import { logger } from "@/utils/logger";
import { Grid, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, startTransition, useEffect, useRef, useState } from "react";
import type { FC } from "react";
import { ACESFilmicToneMapping, PCFSoftShadowMap } from "three";
import type { Group } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useMintFeatureStore } from "@/features/mint/store";
import { MintButton } from "../ui/mint-button";
import { ThreeErrorBoundary } from "../ui/three-error-boundary";

import { CameraRig } from "./camera-rig";
import { FramedPainting } from "./framed-painting";
import { GALLERY_BACK_WALL_Z, GALLERY_FLOOR_Y, GalleryRoom } from "./gallery-room";
import { Lights } from "./lights";
import { isDevelopment } from "@/env";

interface GallerySceneProps {
  cameraPreset?: "dashboard" | "painting";
  initialPainting?: PaintingMetadata | null;
}

const DEFAULT_THUMBNAIL = "/placeholder-painting.webp";
const HEADER_HEIGHT = 56;
const CAMERA_FLOOR_CLEARANCE = 0.02;
const CAMERA_BACK_WALL_CLEARANCE = 0.02;
const MIN_CAMERA_Y = GALLERY_FLOOR_Y + CAMERA_FLOOR_CLEARANCE;
const MAX_CAMERA_Z = GALLERY_BACK_WALL_Z - CAMERA_BACK_WALL_CLEARANCE;
const MAX_POLAR_ANGLE = Math.PI / 2;
const MIN_AZIMUTH_ANGLE = Math.PI / 2;
const MAX_AZIMUTH_ANGLE = (Math.PI * 3) / 2;

interface OrbitControlsEvent {
  target?: unknown;
}

const ORBIT_CONTROLS_BOUNDS: OrbitControlsBounds = {
  minY: MIN_CAMERA_Y,
  maxZ: MAX_CAMERA_Z,
};

const readOrbitControls = (event?: OrbitControlsEvent): OrbitControlsImpl | null => {
  const controls = event?.target;

  if (!controls || typeof controls !== "object") {
    return null;
  }

  if (!("object" in controls) || !("target" in controls)) {
    return null;
  }

  return controls as OrbitControlsImpl;
};

export const GalleryScene: FC<GallerySceneProps> = ({
  cameraPreset: initialCameraPreset = "painting",
  initialPainting,
}) => {
  const [MintFeatureRootComponent, setMintFeatureRootComponent] = useState<FC | null>(null);
  const isDevMode = isDevelopment();
  const { data: latestPainting, isFetching } = useLatestPainting(initialPainting);
  const lastResolvedPaintingRef = useRef<PaintingMetadata | null>(initialPainting ?? null);

  useEffect(() => {
    if (latestPainting) {
      lastResolvedPaintingRef.current = latestPainting;
      return;
    }

    if (!isFetching) {
      lastResolvedPaintingRef.current = null;
    }
  }, [isFetching, latestPainting]);

  const displayPainting = isFetching ? (latestPainting ?? lastResolvedPaintingRef.current) : latestPainting;
  const thumbnailUrl = displayPainting?.imageUrl ?? DEFAULT_THUMBNAIL;

  const openMintFeature = useMintFeatureStore((state) => state.openMintFeature);
  const isMintFeatureVisible = useMintFeatureStore((state) => state.isOpen || state.paintingMetadata !== null);
  const resetMintFeature = useMintFeatureStore((state) => state.resetMintFeature);
  const paintingRef = useRef<Group>(null);
  const isClampingCameraRef = useRef(false);

  const handleMintClick = () => {
    if (!displayPainting) return;

    openMintFeature({
      timestamp: displayPainting.timestamp,
      paintingHash: displayPainting.id,
      thumbnailUrl: displayPainting.imageUrl,
    });
  };

  const previousPaintingKeyRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const currentPainting = latestPainting ?? null;
    const currentPaintingKey = currentPainting
      ? `${currentPainting.id}:${currentPainting.timestamp}:${currentPainting.imageUrl}`
      : null;

    if (previousPaintingKeyRef.current === undefined) {
      previousPaintingKeyRef.current = currentPaintingKey;
      logger.debug("gallery-scene.latest-painting.initialized", {
        paintingId: currentPainting?.id ?? null,
        thumbnailUrl,
      });
      return;
    }

    if (currentPaintingKey === null || currentPainting === null) {
      return;
    }

    if (previousPaintingKeyRef.current === null) {
      previousPaintingKeyRef.current = currentPaintingKey;
      return;
    }

    if (previousPaintingKeyRef.current !== currentPaintingKey) {
      logger.debug("gallery-scene.latest-painting.changed", {
        currentThumbnailUrl: thumbnailUrl,
        paintingId: currentPainting.id,
        lastTs: currentPainting.timestamp,
      });
      previousPaintingKeyRef.current = currentPaintingKey;
      startTransition(() => {
        resetMintFeature();
      });
    }
  }, [latestPainting, resetMintFeature, thumbnailUrl]);

  useEffect(() => {
    return () => {
      resetMintFeature();
    };
  }, [resetMintFeature]);

  useEffect(() => {
    if (!isMintFeatureVisible || MintFeatureRootComponent) {
      return;
    }

    let isMounted = true;

    void import("@/features/mint/mint-feature-root").then((mod) => {
      if (!isMounted) {
        return;
      }

      setMintFeatureRootComponent(() => mod.MintFeatureRoot);
    });

    return () => {
      isMounted = false;
    };
  }, [MintFeatureRootComponent, isMintFeatureVisible]);

  const handleOrbitControlsChange = (event?: OrbitControlsEvent) => {
    const controls = readOrbitControls(event);
    if (!controls || isClampingCameraRef.current) {
      return;
    }

    if (isOrbitControlsWithinBounds(controls, ORBIT_CONTROLS_BOUNDS)) {
      return;
    }

    const constrainedOrbitControlsState = constrainOrbitControlsSnapshot(controls, ORBIT_CONTROLS_BOUNDS);

    isClampingCameraRef.current = true;
    try {
      restoreOrbitControlsSnapshot(controls, constrainedOrbitControlsState);
      controls.update();
    } finally {
      isClampingCameraRef.current = false;
    }
  };

  return (
    <>
      <Canvas
        className="r3f-gallery-canvas"
        frameloop="demand"
        shadows
        dpr={[1, 2]}
        camera={{
          fov: 50,
          position: [0, 0.8, 0.8],
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
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = PCFSoftShadowMap;
        }}
        style={{
          position: "fixed",
          top: `${String(HEADER_HEIGHT)}px`,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: `calc(100% - ${String(HEADER_HEIGHT)}px)`,
          margin: 0,
          padding: 0,
          display: "block",
          background: "#000000",
        }}
      >
        <CameraRig preset={initialCameraPreset} />
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          touches={{ ONE: 0, TWO: 2 }}
          enableZoom
          enablePan
          minDistance={0.5}
          maxDistance={5}
          maxPolarAngle={MAX_POLAR_ANGLE}
          minAzimuthAngle={MIN_AZIMUTH_ANGLE}
          maxAzimuthAngle={MAX_AZIMUTH_ANGLE}
          target={[0, 0.8, 4.0]}
          rotateSpeed={0.5}
          zoomSpeed={0.5}
          panSpeed={0.25}
          enableRotate
          mouseButtons={{ LEFT: 0, MIDDLE: 1, RIGHT: 2 }}
          onChange={handleOrbitControlsChange}
        />
        <Lights />

        {isDevMode && (
          <>
            <axesHelper args={[5]} />
            <Grid
              args={[10, 10]}
              cellSize={0.5}
              cellThickness={0.5}
              cellColor="#6f6f6f"
              sectionSize={1}
              sectionThickness={1}
              sectionColor="#9d4b4b"
              fadeDistance={25}
              fadeStrength={1}
              followCamera={false}
              infiniteGrid={false}
              position={[0, -0.5, 0]}
            />
          </>
        )}
        <GalleryRoom />

        <Suspense fallback={null}>
          <ThreeErrorBoundary fallback={<FramedPainting thumbnailUrl={DEFAULT_THUMBNAIL} paintingId={undefined} />}>
            <FramedPainting ref={paintingRef} thumbnailUrl={thumbnailUrl} paintingId={displayPainting?.id} />
          </ThreeErrorBoundary>
        </Suspense>
      </Canvas>
      <div
        style={{
          position: "fixed",
          bottom: "32px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          zIndex: 1000,
          pointerEvents: "none",
        }}
      >
        <MintButton onClick={handleMintClick} isLoading={false} disabled={!displayPainting} />
      </div>
      {isMintFeatureVisible && MintFeatureRootComponent ? <MintFeatureRootComponent /> : null}
    </>
  );
};
