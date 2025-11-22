"use client";

import React, { useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Group, Mesh, MeshStandardMaterial, MeshBasicMaterial } from "three";
import type { GLTF } from "three-stdlib";

// Shared Types
export interface PaintingContentProps {
  thumbnailUrl: string;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (event: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (event: ThreeEvent<PointerEvent>) => boolean;
  onPointerCancel: (event: ThreeEvent<PointerEvent>) => void;
  paintingId?: string;
}

export interface PaintingGroupProps {
  position: [number, number, number];
  rotation: [number, number, number];
  children: React.ReactNode;
}

// Constants
const ENTRANCE_DURATION = 0.5;

// Shared Components

export const FrameModel: React.FC = () => {
  const { scene: frameModel } = useGLTF("/frame.glb") as GLTF;
  const clonedModel = frameModel.clone();

  return <primitive object={clonedModel} scale={[-1, 1, 1]} castShadow />;
};
FrameModel.displayName = "FrameModel";

export const PaintingGroup: React.FC<PaintingGroupProps> = ({ position, rotation, children }) => {
  const groupRef = useRef<Group>(null);
  const entranceElapsedRef = useRef(0);
  const isEntranceActiveRef = useRef(true);

  useFrame(({ invalidate }, delta) => {
    if (!isEntranceActiveRef.current || !groupRef.current) {
      return;
    }

    entranceElapsedRef.current += delta;
    const progress = Math.min(entranceElapsedRef.current / ENTRANCE_DURATION, 1);

    // Smooth opacity animation: 0 -> 1
    const opacity = progress;

    // Apply opacity to all children meshes
    groupRef.current.traverse(child => {
      if (child instanceof Mesh && child.material) {
        const material = child.material;
        if (Array.isArray(material)) {
          material.forEach(mat => {
            if (mat instanceof MeshStandardMaterial || mat instanceof MeshBasicMaterial) {
              mat.transparent = true;
              mat.opacity = opacity;
            }
          });
        } else if (material instanceof MeshStandardMaterial || material instanceof MeshBasicMaterial) {
          material.transparent = true;
          material.opacity = opacity;
        }
      }
    });

    if (progress >= 1) {
      isEntranceActiveRef.current = false;
      // Reset transparency after animation
      groupRef.current.traverse(child => {
        if (child instanceof Mesh && child.material) {
          const material = child.material;
          if (Array.isArray(material)) {
            material.forEach(mat => {
              if (mat instanceof MeshStandardMaterial || mat instanceof MeshBasicMaterial) {
                mat.transparent = false;
                mat.opacity = 1;
              }
            });
          } else if (material instanceof MeshStandardMaterial || material instanceof MeshBasicMaterial) {
            material.transparent = false;
            material.opacity = 1;
          }
        }
      });
    }

    invalidate();
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {children}
    </group>
  );
};
PaintingGroup.displayName = "PaintingGroup";
