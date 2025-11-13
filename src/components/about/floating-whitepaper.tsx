"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import WhitepaperViewer from "./whitepaper-viewer";

interface FloatingWhitepaperProps extends PropsWithChildren {
  position?: [number, number, number];
  isMobile?: boolean;
  onHoverChange?: (isHovered: boolean) => void;
}

export const FloatingWhitepaper: React.FC<FloatingWhitepaperProps> = ({
  children,
  position = [0, 0.8, 4.0],
  isMobile = false,
  onHoverChange,
}) => {
  const groupRef = useRef<Group>(null);
  const basePositionRef = useRef<[number, number, number]>(position);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const { size } = useThree();

  useEffect(() => {
    basePositionRef.current = position;
    if (groupRef.current) {
      groupRef.current.position.set(position[0], position[1], position[2]);
    }
  }, [position]);

  useFrame(({ invalidate }) => {
    if (!groupRef.current) {
      return;
    }

    const [baseX, baseY, baseZ] = basePositionRef.current;

    // Fixed position - no floating animation for better readability
    groupRef.current.position.set(baseX, baseY, baseZ);

    // Face camera: rotate 180 degrees around Y axis to face camera correctly
    // Camera is at [0, 0.8, 0.8] looking at [0, 0.8, 4.0]
    // Paper is at [0, 0.8, 4.0], so it needs to face back towards camera
    groupRef.current.rotation.set(0, Math.PI, 0);

    // Invalidate for demand mode
    invalidate();
  });

  // Calculate paper size based on viewport: height 90% of viewport, width for comfortable reading
  const distanceFactor = useMemo(() => {
    const { width } = size;

    // Larger distance factor for closer appearance
    if (width <= 480) {
      return 0.8;
    }

    if (width <= 768) {
      return 0.75;
    }

    if (width <= 1280) {
      return 0.7;
    }

    return 0.65;
  }, [size]);

  const paperHeight = useMemo(() => {
    // Height is viewport height minus header height (approximately 60px)
    const { height } = size;
    const headerHeight = 60;
    return `${height - headerHeight}px`;
  }, [size]);

  const paperWidth = useMemo(() => {
    // Width is narrower for better reading (max 700px, responsive)
    const { width } = size;
    const maxWidth = 700;
    const minWidth = Math.min(width * 1.0, maxWidth);
    return `${minWidth}px`;
  }, [size]);

  useEffect(() => {
    if (onHoverChange) {
      onHoverChange(isHovered);
    }
  }, [isHovered, onHoverChange]);

  return (
    <group ref={groupRef} position={position}>
      <Html
        transform
        distanceFactor={distanceFactor}
        style={{
          pointerEvents: "auto",
          width: paperWidth,
          height: paperHeight,
          userSelect: "text",
        }}
        zIndexRange={[100, 0]}
      >
        <div
          ref={scrollContainerRef}
          style={{
            width: "100%",
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            position: "relative",
            backgroundColor: "#ffffff",
            margin: 0,
            padding: 0,
            boxShadow: `
              0 0 0 1px rgba(0, 0, 0, 0.05),
              0 2px 8px rgba(0, 0, 0, 0.1),
              0 8px 24px rgba(0, 0, 0, 0.15),
              0 16px 48px rgba(0, 0, 0, 0.2)
            `,
            borderRadius: "2px",
            border: "1px solid rgba(200, 200, 200, 0.3)",
            ...(isMobile
              ? {
                  WebkitOverflowScrolling: "touch",
                  touchAction: "pan-y",
                }
              : {}),
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onWheel={e => {
            // PCでのマウスホイールスクロールを優先するため、イベントの伝播を停止
            if (!isMobile) {
              e.stopPropagation();
            }
          }}
          {...(isMobile
            ? {
                onTouchStart: () => {
                  // タッチ開始時にホバー状態を設定（スクロール可能にする）
                  setIsHovered(true);
                },
                onTouchEnd: () => {
                  // タッチ終了時に少し遅延してホバー状態を解除
                  setTimeout(() => setIsHovered(false), 100);
                },
              }
            : {})}
        >
          <WhitepaperViewer>{children}</WhitepaperViewer>
        </div>
      </Html>
    </group>
  );
};
