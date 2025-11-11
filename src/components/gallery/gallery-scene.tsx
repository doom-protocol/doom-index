"use client";

import { useState, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, DoubleSide, PCFSoftShadowMap } from "three";
import { OrbitControls, Grid, Stats } from "@react-three/drei";
import { Lights } from "./lights";
import { FramedPainting } from "./framed-painting";
import { CameraRig } from "./camera-rig";
import { RealtimeDashboard } from "../ui/realtime-dashboard";
import { useHaptic } from "use-haptic";
import { useGlobalState } from "@/hooks/use-global-state";
import { logger } from "@/utils/logger";

interface GallerySceneProps {
  cameraPreset?: "dashboard" | "painting";
  showDashboard?: boolean;
}

const isDevelopment = process.env.NODE_ENV === "development";
const DEFAULT_THUMBNAIL = "/placeholder-painting.webp";

export const GalleryScene: React.FC<GallerySceneProps> = ({
  cameraPreset: initialCameraPreset = "painting",
  showDashboard = true,
}) => {
  const [isDashboardHelpOpen, setIsDashboardHelpOpen] = useState(false);
  const [currentCameraPreset, setCurrentCameraPreset] = useState<"dashboard" | "painting">(initialCameraPreset);

  const { triggerHaptic } = useHaptic();

  const { data: globalState } = useGlobalState();
  const thumbnailUrl = globalState?.imageUrl ?? DEFAULT_THUMBNAIL;

  const previousThumbnailUrlRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (previousThumbnailUrlRef.current === undefined) {
      previousThumbnailUrlRef.current = thumbnailUrl;
      logger.info("gallery-scene.thumbnailUrl.initialized", { thumbnailUrl });
      return;
    }

    if (previousThumbnailUrlRef.current !== thumbnailUrl) {
      logger.info("gallery-scene.thumbnailUrl.changed", {
        previousThumbnailUrl: previousThumbnailUrlRef.current,
        currentThumbnailUrl: thumbnailUrl,
        globalStateLastTs: globalState?.lastTs ?? null,
      });
      previousThumbnailUrlRef.current = thumbnailUrl;
    }
  }, [thumbnailUrl, globalState?.lastTs]);

  return (
    <>
      <Canvas
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
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          margin: 0,
          padding: 0,
          display: "block",
          background: "#000000",
        }}
      >
        <CameraRig preset={currentCameraPreset} />
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
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
            <planeGeometry args={[10, 10]} />
            <meshStandardMaterial color="#4b4d68" roughness={0.48} metalness={0.26} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 1.65, 5]} rotation={[0, Math.PI, 0]} receiveShadow>
            <planeGeometry args={[10, 4.5]} />
            <meshStandardMaterial color="#6c6d89" roughness={0.84} metalness={0.11} side={DoubleSide} />
          </mesh>
          <mesh rotation={[0, -Math.PI / 2, 0]} position={[5, 1.65, 0]} receiveShadow>
            <planeGeometry args={[10, 4.5]} />
            <meshStandardMaterial color="#686a86" roughness={0.84} metalness={0.11} side={DoubleSide} />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]} position={[-5, 1.65, 0]} receiveShadow>
            <planeGeometry args={[10, 4.5]} />
            <meshStandardMaterial color="#686a86" roughness={0.84} metalness={0.11} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 1.65, -5]} receiveShadow>
            <planeGeometry args={[10, 4.5]} />
            <meshStandardMaterial color="#686a86" roughness={0.84} metalness={0.11} side={DoubleSide} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 3.3, 0]} receiveShadow>
            <planeGeometry args={[7, 7]} />
            <meshStandardMaterial color="#2d2d40" roughness={0.72} metalness={0.14} side={DoubleSide} />
          </mesh>
        </group>

        <FramedPainting thumbnailUrl={thumbnailUrl} />
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
          gap: "24px",
          alignItems: "center",
          zIndex: 1000,
          pointerEvents: "none",
        }}
      >
        {(["dashboard", "painting"] as const).map(preset => (
          <button
            key={preset}
            type="button"
            onClick={() => setCurrentCameraPreset(preset)}
            onPointerDown={e => {
              triggerHaptic();
              e.currentTarget.style.transform = "scale(0.95)";
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
            }}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
              cursor: "pointer",
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              touchAction: "manipulation",
              padding: 0,
              outline: "none",
            }}
            onPointerEnter={e => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.boxShadow =
                "0 6px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)";
            }}
            onPointerLeave={e => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)";
            }}
            onPointerUp={e => {
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
            }}
          >
            {preset === "painting" ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255, 255, 255, 0.9)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))" }}
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 9h6v6H9z" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255, 255, 255, 0.9)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))" }}
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M8 10h8M8 14h6" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </>
  );
};
