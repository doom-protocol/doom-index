"use client";

import React, { useMemo, useState, Suspense } from "react";
import type { PropsWithChildren } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { ACESFilmicToneMapping, PCFSoftShadowMap } from "three";
import { GalleryRoom } from "../gallery/gallery-room";
import { Lights } from "../gallery/lights";
import { logger } from "@/utils/logger";
import { useMobile } from "@/hooks/use-mobile";
import { FloatingWhitepaper } from "./floating-whitepaper";
import WhitepaperViewer from "./whitepaper-viewer";

interface AboutSceneProps extends PropsWithChildren {
  initialCameraPosition?: [number, number, number];
}

export const AboutScene: React.FC<AboutSceneProps> = ({ children, initialCameraPosition = [0, 0.8, 0.8] }) => {
  const isMobile = useMobile();
  const [webglError, setWebglError] = useState(false);
  const [isPaperHovered, setIsPaperHovered] = useState(false);

  const handleWebGLError = (error: unknown) => {
    logger.error("about-scene.webgl.failed", { error });
    setWebglError(true);
  };

  const orbitTarget = useMemo<[number, number, number]>(() => [0, 0.8, 4.0], []);

  // WebGLエラー時のみフォールバック表示
  if (webglError) {
    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          minHeight: "100vh",
          padding: "48px 24px",
          background: "#050505",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <WhitepaperViewer>{children}</WhitepaperViewer>
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Canvas
        frameloop="demand"
        shadows
        dpr={[1, 1.5]}
        camera={{
          fov: 50,
          position: initialCameraPosition,
          near: 0.1,
          far: 100,
        }}
        gl={{ antialias: true }}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          background: "#000000",
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = PCFSoftShadowMap;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.setClearColor("#050505");
        }}
        onError={handleWebGLError}
      >
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          enablePan={false}
          enableRotate={false}
          enableZoom={isMobile ? true : !isPaperHovered}
          minDistance={0.5}
          maxDistance={5}
          target={orbitTarget}
          rotateSpeed={0.5}
          zoomSpeed={0.5}
          panSpeed={0.25}
          touches={{ ONE: 0, TWO: 2 }}
          mouseButtons={{ LEFT: 0, MIDDLE: 1, RIGHT: 2 }}
        />
        <Lights />
        <GalleryRoom />
        <Suspense fallback={null}>
          <FloatingWhitepaper isMobile={isMobile} onHoverChange={setIsPaperHovered}>
            {children}
          </FloatingWhitepaper>
        </Suspense>
      </Canvas>
    </div>
  );
};
