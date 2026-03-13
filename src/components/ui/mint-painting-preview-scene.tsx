"use client";

import { FramedPainting } from "@/components/gallery/framed-painting";
import { Lights } from "@/components/gallery/lights";
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import type { FC, ReactNode, RefObject } from "react";
import { ACESFilmicToneMapping } from "three";
import type { Group } from "three";

interface MintPaintingPreviewSceneProps {
  canvasChildren?: ReactNode;
  isLoading?: boolean;
  isOpen: boolean;
  paintingRef: RefObject<Group | null>;
  thumbnailUrl: string;
  onTextureReady?: () => void;
}

export const MintPaintingPreviewScene: FC<MintPaintingPreviewSceneProps> = ({
  canvasChildren,
  isLoading = false,
  isOpen,
  paintingRef,
  thumbnailUrl,
  onTextureReady,
}) => {
  return (
    <Canvas
      className="r3f-gallery-canvas"
      frameloop={isOpen ? "demand" : "never"}
      shadows={false}
      dpr={[1, 1.5]}
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
      }}
      style={{
        width: "100%",
        height: "100%",
        pointerEvents: isOpen ? "auto" : "none",
        touchAction: isOpen ? "auto" : "none",
      }}
    >
      <Lights />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={6}
        target={[0, 0.8, 4.0]}
        rotateSpeed={0.5}
        zoomSpeed={0.5}
        enabled={isOpen && !isLoading}
      />
      <Suspense
        fallback={
          <mesh position={[0, 0.8, 4]}>
            <planeGeometry args={[1.2, 1.6]} />
            <meshBasicMaterial color="#1f2937" opacity={0.65} transparent />
          </mesh>
        }
      >
        <FramedPainting ref={paintingRef} thumbnailUrl={thumbnailUrl} onTextureReady={onTextureReady} />
      </Suspense>
      {canvasChildren}
    </Canvas>
  );
};
