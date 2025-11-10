"use client";

import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping } from "three";
import { Lights } from "./lights";
import { FramedPainting } from "./framed-painting";
import { CameraRig } from "./camera-rig";
import { RealtimeDashboard } from "../ui/realtime-dashboard";

interface GallerySceneProps {
  thumbnailUrl?: string;
  cameraPreset?: "dashboard" | "painting";
  showDashboard?: boolean;
}

export const GalleryScene: React.FC<GallerySceneProps> = ({
  thumbnailUrl,
  cameraPreset = "painting",
  showDashboard = true,
}) => {
  return (
    <Canvas
      camera={{ fov: 50, position: [0, 1.6, 1.0] }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}
      style={{ width: "100%", height: "100vh", background: "#000000" }}
    >
      <CameraRig preset={cameraPreset} />
      <Lights />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#050505" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Back Wall */}
      <mesh position={[0, 2.5, -5]} receiveShadow>
        <planeGeometry args={[20, 5]} />
        <meshStandardMaterial color="#050505" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Side Walls */}
      <mesh position={[-10, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[20, 5]} />
        <meshStandardMaterial color="#050505" roughness={0.8} metalness={0.1} />
      </mesh>

      <mesh position={[10, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[20, 5]} />
        <meshStandardMaterial color="#050505" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Central framed painting */}
      <FramedPainting thumbnailUrl={thumbnailUrl} />

      {/* Dashboard */}
      {showDashboard && <RealtimeDashboard />}
    </Canvas>
  );
};
