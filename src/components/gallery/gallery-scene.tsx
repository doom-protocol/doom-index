"use client";

import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping } from "three";
import { OrbitControls, Grid, Stats } from "@react-three/drei";
import { Lights } from "./lights";
import { FramedPainting } from "./framed-painting";
import { CameraRig } from "./camera-rig";
import { RealtimeDashboard } from "../ui/realtime-dashboard";

interface GallerySceneProps {
  thumbnailUrl?: string;
  cameraPreset?: "dashboard" | "painting";
  showDashboard?: boolean;
}

const isDevelopment = process.env.NODE_ENV === "development";

export const GalleryScene: React.FC<GallerySceneProps> = ({
  thumbnailUrl,
  cameraPreset = "painting",
  showDashboard = true,
}) => {
  return (
    <Canvas
      camera={{
        fov: 50,
        position: [0, 0.8, 0.8],
        near: 0.1,
        far: 100,
      }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}
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
      <CameraRig preset={cameraPreset} />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        touches={{
          ONE: 0, // TOUCH_ROTATE (one finger rotation) - 0 = ROTATE
          TWO: 2, // TOUCH_DOLLY_PAN (two finger zoom/pan) - 2 = DOLLY_PAN
        }}
        enableZoom={true}
        enablePan={true}
        minDistance={0.5}
        maxDistance={5}
        target={[0, 0.8, 2.8]}
        rotateSpeed={1.0}
        zoomSpeed={1.0}
        panSpeed={0.5}
        enableRotate={true}
        mouseButtons={{
          LEFT: 0, // ROTATE
          MIDDLE: 1, // DOLLY
          RIGHT: 2, // PAN
        }}
      />
      <Lights />

      {/* Debug helpers - Development only */}
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

      {/* Gallery Room - Smaller box with inside visible */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[6, 4, 6]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.9} metalness={0.05} side={2} />
      </mesh>

      {/* Central framed painting */}
      <FramedPainting thumbnailUrl={thumbnailUrl} />

      {/* Dashboard */}
      {showDashboard && <RealtimeDashboard />}

      {/* Performance stats - Development only */}
      {isDevelopment && <Stats />}
    </Canvas>
  );
};
