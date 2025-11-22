"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, PCFSoftShadowMap, Group } from "three";
import { OrbitControls, Grid, Stats } from "@react-three/drei";
import { Lights } from "./lights";
import { FramedPainting } from "./framed-painting";
import { CameraRig } from "./camera-rig";
import { GalleryRoom } from "./gallery-room";
import { RealtimeDashboard } from "../ui/realtime-dashboard";
import { MintButton } from "../ui/mint-button";
import { MintModal } from "../ui/mint-modal";
import { useLatestPainting } from "@/hooks/use-latest-painting";
import { logger } from "@/utils/logger";
import { env } from "@/env";
import { glbExportService } from "@/lib/glb-export-service";
import { toast } from "sonner";

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

  // Export state
  const paintingRef = useRef<Group>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedGlbFile, setExportedGlbFile] = useState<File | null>(null);
  const [isMintModalOpen, setIsMintModalOpen] = useState(false);

  const handleExport = async () => {
    // If GLB file is already exported, open mint modal
    if (exportedGlbFile && latestPainting) {
      setIsMintModalOpen(true);
      return;
    }

    // Otherwise, export GLB
    if (isExporting || !paintingRef.current) return;

    setIsExporting(true);
    try {
      const result = await glbExportService.exportPaintingModel(paintingRef);
      if (result.isOk()) {
        const file = result.value;

        // Try to optimize if size > 32MB
        let finalFile = file;
        const MAX_SIZE_MB = 32;
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
          const arrayBuffer = await file.arrayBuffer();
          const optimizedResult = await glbExportService.optimizeGlb(arrayBuffer, MAX_SIZE_MB);
          if (optimizedResult.isOk()) {
            finalFile = new File([optimizedResult.value], file.name, { type: "application/octet-stream" });
          } else {
            logger.warn("MintButton.optimizeFailed", { error: optimizedResult.error });
            // Continue with original file if optimization fails
          }
        }

        // Store the file for mint flow and open mint modal
        setExportedGlbFile(finalFile);
        setIsMintModalOpen(true);
        logger.info("MintButton.exportSuccess", { fileName: finalFile.name, size: finalFile.size });
      } else {
        logger.error("MintButton.exportFailed", { error: result.error });
        toast.error(`Export failed: ${result.error.message}`);
      }
    } catch (e) {
      logger.error("MintButton.exportException", { error: e });
      const errorMessage = e instanceof Error ? e.message : "Export failed";
      toast.error(`Export error: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };

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
      setExportedGlbFile(null);
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
          <FramedPainting ref={paintingRef} thumbnailUrl={thumbnailUrl} paintingId={latestPainting?.id} />
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
        <MintButton onClick={handleExport} isLoading={isExporting} />
      </div>

      {/* Mint Modal */}
      <MintModal
        isOpen={isMintModalOpen && !!latestPainting && !!exportedGlbFile}
        onClose={() => {
          setIsMintModalOpen(false);
          // Do not clear exportedGlbFile here to allow exit animation
          // It will be cleared when painting changes or manually if needed
        }}
        paintingMetadata={{
          timestamp: latestPainting?.timestamp ?? new Date().toISOString(),
          paintingHash: latestPainting?.id ?? `painting-${Date.now()}`,
          thumbnailUrl: latestPainting?.imageUrl ?? DEFAULT_THUMBNAIL,
        }}
        glbFile={exportedGlbFile}
      />
    </>
  );
};
