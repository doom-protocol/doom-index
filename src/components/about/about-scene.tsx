"use client";

import React, { useMemo, useState, Suspense } from "react";
import type { PropsWithChildren } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { ACESFilmicToneMapping, PCFSoftShadowMap } from "three";
import { GalleryRoom } from "../gallery/gallery-room";
import { Lights } from "../gallery/lights";
import { logger } from "@/utils/logger";
import { useIOS, useMobile } from "@/hooks/use-mobile";
import { FloatingWhitepaper } from "./floating-whitepaper";
import WhitepaperViewer from "./whitepaper-viewer";

interface AboutSceneProps extends PropsWithChildren {
  initialCameraPosition?: [number, number, number];
}

export const AboutScene: React.FC<AboutSceneProps> = ({ children, initialCameraPosition = [0, 0.8, 0.8] }) => {
  const HEADER_HEIGHT = 56;
  const isMobile = useMobile();
  const isIOS = useIOS();
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
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
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
          top: `${HEADER_HEIGHT}px`,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: `calc(100% - ${HEADER_HEIGHT}px)`,
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
          enabled={!isIOS}
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
        {!isIOS && (
          <Suspense fallback={null}>
            <FloatingWhitepaper isMobile={isMobile} onHoverChange={setIsPaperHovered}>
              {children}
            </FloatingWhitepaper>
          </Suspense>
        )}
      </Canvas>

      {/* iOS: DOM fallback (drei#720 Html transform issue workaround) */}
      {isIOS && (
        <div
          style={{
            position: "fixed",
            top: `${HEADER_HEIGHT}px`,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "16px",
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: "min(700px, 100%)",
              height: "100%",
              background: "#ffffff",
              overflowY: "auto",
              overflowX: "hidden",
              pointerEvents: "auto",
              boxShadow:
                "0 0 0 1px rgba(0, 0, 0, 0.05), 0 2px 8px rgba(0, 0, 0, 0.1), 0 8px 24px rgba(0, 0, 0, 0.15), 0 16px 48px rgba(0, 0, 0, 0.2)",
              borderRadius: "2px",
              border: "1px solid rgba(200, 200, 200, 0.3)",
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-y",
              overscrollBehavior: "contain",
              WebkitTouchCallout: "none",
              WebkitUserSelect: "text",
            }}
          >
            <div style={{ padding: "1px 0" }}>
              <WhitepaperViewer>{children}</WhitepaperViewer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
