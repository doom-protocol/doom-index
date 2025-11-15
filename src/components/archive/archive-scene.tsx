"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, PCFSoftShadowMap } from "three";
import { Stats } from "@react-three/drei";
import { Lights } from "@/components/gallery/lights";
import { GalleryRoom } from "@/components/gallery/gallery-room";
import { ArchiveCameraRig } from "./archive-camera-rig";
import { env } from "@/env";

interface ArchiveSceneProps {
  children?: React.ReactNode;
  totalItems: number;
}

const isDevelopment = env.NODE_ENV === "development";

export const ArchiveScene: React.FC<ArchiveSceneProps> = ({ children, totalItems }) => {
  return (
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
        position: "fixed",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
    >
      <ArchiveCameraRig totalItems={totalItems} />
      <Lights />
      <GalleryRoom />
      <Suspense fallback={null}>{children}</Suspense>
      {isDevelopment && <Stats />}
    </Canvas>
  );
};
