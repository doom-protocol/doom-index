"use client";

import React, { useMemo } from "react";
import { MeshStandardMaterial, PlaneGeometry } from "three";

interface ArchivePaintingSkeletonProps {
  position: [number, number, number];
  width?: number;
  height?: number;
}

const SKELETON_WIDTH = 0.6;
const SKELETON_HEIGHT = 0.8;
const SKELETON_COLOR = "#4a4a66";

export const ArchivePaintingSkeleton: React.FC<ArchivePaintingSkeletonProps> = ({
  position,
  width = SKELETON_WIDTH,
  height = SKELETON_HEIGHT,
}) => {
  const geometry = useMemo(() => new PlaneGeometry(width, height), [width, height]);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: SKELETON_COLOR,
        roughness: 0.8,
        metalness: 0.1,
        emissive: SKELETON_COLOR,
        emissiveIntensity: 0.2,
      }),
    [],
  );

  return (
    <mesh position={position} geometry={geometry} material={material} castShadow receiveShadow>
      {/* Skeleton frame placeholder */}
    </mesh>
  );
};
