"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, PCFSoftShadowMap } from "three";
import { OrbitControls, Grid, Stats } from "@react-three/drei";
import { Lights } from "./lights";
import { FramedPainting } from "./framed-painting";
import { CameraRig } from "./camera-rig";
import { GalleryRoom } from "./gallery-room";
import { RealtimeDashboard } from "../ui/realtime-dashboard";
import { MintButton } from "../ui/mint-button";
import { useLatestPainting } from "@/hooks/use-latest-painting";
import { logger } from "@/utils/logger";
import { env } from "@/env";

interface GallerySceneProps {
  cameraPreset?: "dashboard" | "painting";
  showDashboard?: boolean;
  isHelpOpen?: boolean;
  onHelpToggle?: (open: boolean) => void;
}

const isDevelopment = env.NODE_ENV === "development";
const DEFAULT_THUMBNAIL = "/placeholder-painting.webp";
const HEADER_HEIGHT = 56;

export const GalleryScene: React.FC<GallerySceneProps> = ({
  cameraPreset: initialCameraPreset = "painting",
  showDashboard = false,
  isHelpOpen: externalIsHelpOpen,
  onHelpToggle: externalOnHelpToggle,
}) => {
  const [internalIsHelpOpen, setInternalIsHelpOpen] = useState(false);
  const isDashboardHelpOpen = externalIsHelpOpen ?? internalIsHelpOpen;
  const setIsDashboardHelpOpen = externalOnHelpToggle ?? setInternalIsHelpOpen;

  const { data: latestPainting } = useLatestPainting();
  const thumbnailUrl = latestPainting?.imageUrl ?? DEFAULT_THUMBNAIL;

  const previousThumbnailUrlRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (showDashboard && process.env.NODE_ENV !== "production") {
      console.warn("RealtimeDashboard is deprecated — set showDashboard to false or restore implementation");
    }
  }, [showDashboard]);

  useEffect(() => {
    if (previousThumbnailUrlRef.current === undefined) {
      previousThumbnailUrlRef.current = thumbnailUrl;
      logger.debug("gallery-scene.thumbnailUrl.initialized", { thumbnailUrl });
      return;
    }

    if (previousThumbnailUrlRef.current !== thumbnailUrl) {
      logger.debug("gallery-scene.thumbnailUrl.changed", {
        previousThumbnailUrl: previousThumbnailUrlRef.current,
        currentThumbnailUrl: thumbnailUrl,
        lastTs: latestPainting?.timestamp ?? null,
      });
      previousThumbnailUrlRef.current = thumbnailUrl;
    }
  }, [thumbnailUrl, latestPainting?.timestamp]);

  return (
    <>
      <Canvas
        frameloop="demand"
        shadows
        dpr={[1, 1.5]}
        camera={{
          fov: 50,
          position: [0, 0.8, 0.8],
          near: 0.1,
          far: 100,
        }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = PCFSoftShadowMap;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.setClearColor("#050505");
        }}
        style={{
          position: "fixed",
          top: `${HEADER_HEIGHT}px`,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: `calc(100% - ${HEADER_HEIGHT}px)`,
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
          target={[0, 0.8, 4.0]}
          rotateSpeed={0.5}
          zoomSpeed={0.5}
          panSpeed={0.25}
          enabled={!isDashboardHelpOpen}
          enableRotate
          mouseButtons={{ LEFT: 0, MIDDLE: 1, RIGHT: 2 }}
        />
        <Lights />

        {isDevelopment && (
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
          <FramedPainting thumbnailUrl={thumbnailUrl} paintingId={latestPainting?.id} />
        </Suspense>
        {showDashboard && <RealtimeDashboard isHelpOpen={isDashboardHelpOpen} onHelpToggle={setIsDashboardHelpOpen} />}
        {isDevelopment && <Stats />}
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
        <MintButton />
      </div>
    </>
  );
};
