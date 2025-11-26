"use client";

import React, { useMemo } from "react";
import { DoubleSide, MeshStandardMaterial, PlaneGeometry } from "three";

export const GalleryRoom: React.FC = () => {
  // Shared geometries
  const floorGeometry = useMemo(() => new PlaneGeometry(10, 10), []);
  const wallGeometry = useMemo(() => new PlaneGeometry(10, 4.5), []);
  const ceilingGeometry = useMemo(() => new PlaneGeometry(7, 7), []);

  // Shared materials
  const floorMaterial = useMemo(
    () => new MeshStandardMaterial({ color: "#4b4d68", roughness: 0.48, metalness: 0.26, side: DoubleSide }),
    [],
  );
  const wallMaterial = useMemo(
    () => new MeshStandardMaterial({ color: "#6c6d89", roughness: 0.84, metalness: 0.11, side: DoubleSide }),
    [],
  );
  const sideWallMaterial = useMemo(
    () => new MeshStandardMaterial({ color: "#686a86", roughness: 0.84, metalness: 0.11, side: DoubleSide }),
    [],
  );
  const ceilingMaterial = useMemo(
    () => new MeshStandardMaterial({ color: "#2d2d40", roughness: 0.72, metalness: 0.14, side: DoubleSide }),
    [],
  );

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        receiveShadow
        geometry={floorGeometry}
        material={floorMaterial}
      />
      <mesh
        position={[0, 1.65, 5]}
        rotation={[0, Math.PI, 0]}
        receiveShadow
        geometry={wallGeometry}
        material={wallMaterial}
      />
      <mesh
        rotation={[0, -Math.PI / 2, 0]}
        position={[5, 1.65, 0]}
        receiveShadow
        geometry={wallGeometry}
        material={sideWallMaterial}
      />
      <mesh
        rotation={[0, Math.PI / 2, 0]}
        position={[-5, 1.65, 0]}
        receiveShadow
        geometry={wallGeometry}
        material={sideWallMaterial}
      />
      <mesh position={[0, 1.65, -5]} receiveShadow geometry={wallGeometry} material={sideWallMaterial} />
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 3.3, 0]}
        receiveShadow
        geometry={ceilingGeometry}
        material={ceilingMaterial}
      />
    </group>
  );
};
