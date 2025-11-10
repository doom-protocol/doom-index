"use client";

import { useRef } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import { Mesh, SRGBColorSpace } from "three";
import type { GLTF } from "three-stdlib";

interface FramedPaintingProps {
  thumbnailUrl?: string;
  framePosition?: [number, number, number];
}

const DEFAULT_THUMBNAIL = "/placeholder-painting.webp";

export const FramedPainting: React.FC<FramedPaintingProps> = ({
  thumbnailUrl = DEFAULT_THUMBNAIL,
  framePosition = [0, 1.6, -4.5],
}) => {
  const meshRef = useRef<Mesh>(null);

  // Load GLB frame model
  const { scene: frameModel } = useGLTF("/frame.glb") as GLTF;

  // Load texture - useTexture from drei already handles texture configuration
  const texture = useTexture(thumbnailUrl || DEFAULT_THUMBNAIL, loadedTexture => {
    // Configure texture on load
    loadedTexture.colorSpace = SRGBColorSpace;
    loadedTexture.anisotropy = 4;
    loadedTexture.needsUpdate = true;
  });

  // Frame dimensions (inner dimensions for the painting)
  const innerWidth = 2.0;
  const innerHeight = 2.0;

  // Calculate aspect ratio fit (contain)
  const image = texture.image as HTMLImageElement | undefined;
  const imageAspect = image && image.width && image.height ? image.width / image.height : 1;
  const frameAspect = innerWidth / innerHeight;

  let planeWidth = innerWidth;
  let planeHeight = innerHeight;

  if (imageAspect > frameAspect) {
    // Image is wider than frame
    planeHeight = innerWidth / imageAspect;
  } else {
    // Image is taller than frame
    planeWidth = innerHeight * imageAspect;
  }

  return (
    <group position={framePosition}>
      {/* GLB Frame Model */}
      <primitive object={frameModel.clone()} />

      {/* Painting plane (ImageAnchor equivalent) */}
      <mesh ref={meshRef} position={[0, 0, 0.01]}>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshStandardMaterial map={texture} roughness={0.4} metalness={0.0} />
      </mesh>
    </group>
  );
};

// Preload the GLB model
useGLTF.preload("/frame.glb");
