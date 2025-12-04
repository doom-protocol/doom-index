"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { PropsWithChildren } from "react";
import { useEffect, useMemo, useRef, useState, type FC } from "react";
import type { Group } from "three";
import WhitepaperViewer from "./whitepaper-viewer";

interface FloatingWhitepaperProps extends PropsWithChildren {
  position?: [number, number, number];
  isMobile?: boolean;
  onHoverChange?: (isHovered: boolean) => void;
}

const ENTRANCE_DURATION = 0.5;

export const FloatingWhitepaper: FC<FloatingWhitepaperProps> = ({
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
  const entranceElapsedRef = useRef(0);
  const isEntranceActiveRef = useRef(true);

  useEffect(() => {
    basePositionRef.current = position;
    if (groupRef.current) {
      groupRef.current.position.set(position[0], position[1], position[2]);
    }
  }, [position]);

  useFrame(({ invalidate }, delta) => {
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

    // Entrance animation: fade in from 0 to 1
    if (isEntranceActiveRef.current && scrollContainerRef.current) {
      entranceElapsedRef.current += delta;
      const progress = Math.min(entranceElapsedRef.current / ENTRANCE_DURATION, 1);
      const opacity = progress;

      scrollContainerRef.current.style.opacity = opacity.toString();

      if (progress >= 1) {
        isEntranceActiveRef.current = false;
        // Ensure final opacity is 1
        if (scrollContainerRef.current) {
          scrollContainerRef.current.style.opacity = "1";
        }
      }

      invalidate();
    } else {
      // Invalidate for demand mode
      invalidate();
    }
  });

  // Fixed aspect ratio (A4 paper ratio: 210:297 ≈ 0.707)
  const PAPER_ASPECT_RATIO = 0.7070707071; // width / height (derived from 210 / 297)

  // Calculate paper size maintaining fixed aspect ratio
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

  const { paperWidth, paperHeight } = useMemo(() => {
    const { width, height } = size;
    const headerHeight = 60;
    const availableHeight = height - headerHeight;
    const availableWidth = width;

    // Calculate maximum size maintaining aspect ratio
    // Try fitting by width first
    let calculatedWidth = availableWidth * 0.9; // Use 90% of available width
    let calculatedHeight = calculatedWidth / PAPER_ASPECT_RATIO;

    // If height exceeds available space, fit by height instead
    if (calculatedHeight > availableHeight * 0.9) {
      calculatedHeight = availableHeight * 0.9;
      calculatedWidth = calculatedHeight * PAPER_ASPECT_RATIO;
    }

    // Set reasonable min/max constraints
    const minWidth = 320; // Minimum readable width
    const maxWidth = 800; // Maximum comfortable reading width
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
      paperWidth: `${finalWidth}px`,
      paperHeight: `${finalHeight}px`,
    };
  }, [size, PAPER_ASPECT_RATIO]);

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
          className="relative m-0 h-full w-full overflow-x-hidden overflow-y-auto rounded-sm border border-[rgba(200,200,200,0.3)] bg-white p-0"
          style={{
            opacity: 0, // Start with opacity 0, will be animated to 1
            boxShadow: `
              0 0 0 1px rgba(0, 0, 0, 0.05),
              0 2px 8px rgba(0, 0, 0, 0.1),
              0 8px 24px rgba(0, 0, 0, 0.15),
              0 16px 48px rgba(0, 0, 0, 0.2)
            `,
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
            // Stop event propagation to prioritize mouse wheel scrolling on PC
            if (!isMobile) {
              e.stopPropagation();
            }
          }}
          {...(isMobile
            ? {
                onTouchStart: () => {
                  // Set hover state on touch start (to enable scrolling)
                  setIsHovered(true);
                },
                onTouchEnd: () => {
                  // Clear hover state with slight delay on touch end
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
