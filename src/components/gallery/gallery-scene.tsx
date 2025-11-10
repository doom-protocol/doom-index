"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, DoubleSide, PCFSoftShadowMap } from "three";
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
  const [isDashboardHelpOpen, setIsDashboardHelpOpen] = useState(false);

  return (
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
        target={[0, 0.8, 4.0]}
        rotateSpeed={1.0}
        zoomSpeed={1.0}
        panSpeed={0.5}
        enabled={!isDashboardHelpOpen}
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

      {/* Gallery architecture */}
      <group>
        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color="#4b4d68" roughness={0.48} metalness={0.26} side={DoubleSide} />
        </mesh>

        {/* Back wall */}
        <mesh position={[0, 1.65, 5]} rotation={[0, Math.PI, 0]} receiveShadow>
          <planeGeometry args={[10, 4.5]} />
          <meshStandardMaterial color="#6c6d89" roughness={0.84} metalness={0.11} side={DoubleSide} />
        </mesh>

        {/* Side walls */}
        <mesh rotation={[0, -Math.PI / 2, 0]} position={[5, 1.65, 0]} receiveShadow>
          <planeGeometry args={[10, 4.5]} />
          <meshStandardMaterial color="#686a86" roughness={0.84} metalness={0.11} side={DoubleSide} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]} position={[-5, 1.65, 0]} receiveShadow>
          <planeGeometry args={[10, 4.5]} />
          <meshStandardMaterial color="#686a86" roughness={0.84} metalness={0.11} side={DoubleSide} />
        </mesh>

        {/* Front wall */}
        <mesh position={[0, 1.65, -5]} receiveShadow>
          <planeGeometry args={[10, 4.5]} />
          <meshStandardMaterial color="#686a86" roughness={0.84} metalness={0.11} side={DoubleSide} />
        </mesh>

        {/* Ceiling */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 3.3, 0]} receiveShadow>
          <planeGeometry args={[7, 7]} />
          <meshStandardMaterial color="#2d2d40" roughness={0.72} metalness={0.14} side={DoubleSide} />
        </mesh>
      </group>

      {/* Central framed painting */}
      <FramedPainting thumbnailUrl={thumbnailUrl} />

      {/* Dashboard */}
      {showDashboard && <RealtimeDashboard isHelpOpen={isDashboardHelpOpen} onHelpToggle={setIsDashboardHelpOpen} />}

      {/* Performance stats - Development only */}
      {isDevelopment && <Stats />}
    </Canvas>
  );
};
