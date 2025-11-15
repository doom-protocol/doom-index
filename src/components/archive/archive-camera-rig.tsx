"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { useScrollY } from "@/hooks/use-scroll-y";
import { getGridConfig } from "@/lib/pure/archive-grid";
import { useMobile } from "@/hooks/use-mobile";

interface ArchiveCameraRigProps {
  totalItems: number;
}

const LERP_FACTOR = 0.1;
const INITIAL_CAMERA_POSITION: [number, number, number] = [0, 0.8, 0.8];
const INITIAL_LOOK_AT: [number, number, number] = [0, 0.8, 4.0];

export const ArchiveCameraRig: React.FC<ArchiveCameraRigProps> = ({ totalItems: _totalItems }) => {
  const { camera } = useThree();
  const scrollY = useScrollY();
  const isMobile = useMobile();
  const gridConfig = getGridConfig(isMobile);

  const targetZRef = useRef(camera.position.z);
  const currentLookAtRef = useRef(new Vector3(...INITIAL_LOOK_AT));

  // Calculate virtual scroll height
  const virtualScrollHeight = gridConfig.rows * 120; // rowHeight in pixels

  // Update virtual scroll height
  useEffect(() => {
    const scrollContainer = document.documentElement;
    scrollContainer.style.height = `${virtualScrollHeight}px`;
    return () => {
      scrollContainer.style.height = "";
    };
  }, [virtualScrollHeight]);

  // Calculate target camera Z position from scroll
  useEffect(() => {
    const rowHeight = 120; // pixels per row
    const rowIndex = Math.floor(scrollY / rowHeight);
    const zSpacing = gridConfig.spacing;
    const initialZ = INITIAL_CAMERA_POSITION[2];
    targetZRef.current = initialZ + rowIndex * zSpacing;
  }, [scrollY, gridConfig.spacing]);

  // Smooth camera movement with lerp
  useFrame(({ invalidate }) => {
    const currentZ = camera.position.z;
    const targetZ = targetZRef.current;

    if (Math.abs(currentZ - targetZ) > 0.01) {
      camera.position.setZ(currentZ + (targetZ - currentZ) * LERP_FACTOR);
      camera.lookAt(currentLookAtRef.current);
      invalidate();
    }
  });

  return null;
};
