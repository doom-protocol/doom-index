"use client";

import React, { useMemo, useState, Suspense, useEffect } from "react";
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

const ENTRANCE_DURATION = 500; // milliseconds for CSS transition

// WebGL error fallback component with entrance animation
const WebGLErrorFallback: React.FC<PropsWithChildren & { paperSize: { width: string; height: string } }> = ({
  children,
  paperSize,
}) => {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    // Trigger fade-in animation on mount
    requestAnimationFrame(() => {
      setOpacity(1);
    });
  }, []);

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
      <div
        style={{
          width: paperSize.width,
          height: paperSize.height,
          maxWidth: "100%",
          maxHeight: "calc(100vh - 96px)",
          background: "#ffffff",
          overflowY: "auto",
          overflowX: "hidden",
          boxShadow:
            "0 0 0 1px rgba(0, 0, 0, 0.05), 0 2px 8px rgba(0, 0, 0, 0.1), 0 8px 24px rgba(0, 0, 0, 0.15), 0 16px 48px rgba(0, 0, 0, 0.2)",
          borderRadius: "2px",
          border: "1px solid rgba(200, 200, 200, 0.3)",
          opacity,
          transition: `opacity ${ENTRANCE_DURATION}ms ease-out`,
        }}
      >
        <WhitepaperViewer>{children}</WhitepaperViewer>
      </div>
    </div>
  );
};

// iOS fallback component with entrance animation
const IOSFallback: React.FC<
  PropsWithChildren & { paperSize: { width: string; height: string }; headerHeight: number }
> = ({ children, paperSize, headerHeight }) => {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    // Trigger fade-in animation on mount
    requestAnimationFrame(() => {
      setOpacity(1);
    });
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: `${headerHeight}px`,
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
          width: paperSize.width,
          height: paperSize.height,
          maxWidth: "100%",
          maxHeight: "100%",
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
          opacity,
          transition: `opacity ${ENTRANCE_DURATION}ms ease-out`,
        }}
      >
        <div style={{ padding: "1px 0" }}>
          <WhitepaperViewer>{children}</WhitepaperViewer>
        </div>
      </div>
    </div>
  );
};

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

  // Fixed aspect ratio (A4 paper ratio: 210:297 ≈ 0.707)
  const PAPER_ASPECT_RATIO = 210 / 297; // width / height

  // Calculate paper size for iOS fallback maintaining fixed aspect ratio
  const iosPaperSize = useMemo(() => {
    if (typeof window === "undefined") {
      return { width: "700px", height: "990px" };
    }

    const availableWidth = window.innerWidth - 32; // padding 16px * 2
    const availableHeight = window.innerHeight - HEADER_HEIGHT - 32; // padding 16px * 2

    // Calculate maximum size maintaining aspect ratio
    let calculatedWidth = availableWidth * 0.9;
    let calculatedHeight = calculatedWidth / PAPER_ASPECT_RATIO;

    // If height exceeds available space, fit by height instead
    if (calculatedHeight > availableHeight * 0.9) {
      calculatedHeight = availableHeight * 0.9;
      calculatedWidth = calculatedHeight * PAPER_ASPECT_RATIO;
    }

    // Set reasonable min/max constraints
    const minWidth = 320;
    const maxWidth = 800;
    const minHeight = minWidth / PAPER_ASPECT_RATIO;
    const maxHeight = maxWidth / PAPER_ASPECT_RATIO;

    // Apply constraints while maintaining aspect ratio
    let finalWidth = Math.max(minWidth, Math.min(maxWidth, calculatedWidth));
    let finalHeight = finalWidth / PAPER_ASPECT_RATIO;

    // Ensure height also fits within constraints
    if (finalHeight > maxHeight) {
      finalHeight = maxHeight;
      finalWidth = finalHeight * PAPER_ASPECT_RATIO;
    }
    if (finalHeight < minHeight) {
      finalHeight = minHeight;
      finalWidth = finalHeight * PAPER_ASPECT_RATIO;
    }

    return {
      width: `${finalWidth}px`,
      height: `${finalHeight}px`,
    };
  }, [PAPER_ASPECT_RATIO]);

  // Calculate paper size for WebGL error fallback maintaining fixed aspect ratio
  const webglErrorPaperSize = useMemo(() => {
    if (typeof window === "undefined") {
      return { width: "700px", height: "990px" };
    }

    const availableWidth = window.innerWidth - 96; // padding 48px * 2
    const availableHeight = window.innerHeight - 96; // padding 48px * 2

    // Calculate maximum size maintaining aspect ratio
    let calculatedWidth = availableWidth * 0.9;
    let calculatedHeight = calculatedWidth / PAPER_ASPECT_RATIO;

    // If height exceeds available space, fit by height instead
    if (calculatedHeight > availableHeight * 0.9) {
      calculatedHeight = availableHeight * 0.9;
      calculatedWidth = calculatedHeight * PAPER_ASPECT_RATIO;
    }

    // Set reasonable min/max constraints
    const minWidth = 320;
    const maxWidth = 800;
    const minHeight = minWidth / PAPER_ASPECT_RATIO;
    const maxHeight = maxWidth / PAPER_ASPECT_RATIO;

    // Apply constraints while maintaining aspect ratio
    let finalWidth = Math.max(minWidth, Math.min(maxWidth, calculatedWidth));
    let finalHeight = finalWidth / PAPER_ASPECT_RATIO;

    // Ensure height also fits within constraints
    if (finalHeight > maxHeight) {
      finalHeight = maxHeight;
      finalWidth = finalHeight * PAPER_ASPECT_RATIO;
    }
    if (finalHeight < minHeight) {
      finalHeight = minHeight;
      finalWidth = finalHeight * PAPER_ASPECT_RATIO;
    }

    return {
      width: `${finalWidth}px`,
      height: `${finalHeight}px`,
    };
  }, [PAPER_ASPECT_RATIO]);

  // WebGLエラー時のみフォールバック表示
  if (webglError) {
    return <WebGLErrorFallback paperSize={webglErrorPaperSize}>{children}</WebGLErrorFallback>;
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
        <IOSFallback paperSize={iosPaperSize} headerHeight={HEADER_HEIGHT}>
          {children}
        </IOSFallback>
      )}
    </div>
  );
};
