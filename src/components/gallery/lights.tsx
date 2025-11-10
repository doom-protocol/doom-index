"use client";

import { useRef } from "react";
import { SpotLight, Object3D } from "three";
import { useFrame, useThree } from "@react-three/fiber";

export const Lights: React.FC = () => {
  const spotLightRef = useRef<SpotLight>(null);
  const targetRef = useRef<Object3D>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (spotLightRef.current && targetRef.current) {
      spotLightRef.current.target = targetRef.current;
    }
  });

  return (
    <>
      {/* Reduced ambient light for gallery atmosphere */}
      <ambientLight intensity={0.8} />

      {/* Hemisphere light for natural indoor lighting */}
      <hemisphereLight args={["#ffffff", "#444444", 0.5]} />

      {/* Main directional light from front-top */}
      <directionalLight position={[0, 4, 5]} intensity={0.6} />

      {/* Directional lights from all sides */}
      <directionalLight position={[0, 4, -5]} intensity={0.6} />
      <directionalLight position={[-5, 2, 0]} intensity={0.4} />
      <directionalLight position={[5, 2, 0]} intensity={0.4} />

      {/* Fill light from below */}
      <directionalLight position={[0, -2, 0]} intensity={0.3} />

      {/* Main spotlight targeting the painting */}
      <spotLight ref={spotLightRef} position={[0, 2.8, 1]} intensity={8.0} angle={0.6} penumbra={0.8} distance={6} />

      {/* Additional spotlights for painting glow effect */}
      <spotLight
        position={[-0.8, 2.3, 1.5]}
        target-position={[0, 0.8, 2.8]}
        intensity={4.0}
        angle={0.4}
        penumbra={0.9}
        distance={5}
      />
      <spotLight
        position={[0.8, 2.3, 1.5]}
        target-position={[0, 0.8, 2.8]}
        intensity={4.0}
        angle={0.4}
        penumbra={0.9}
        distance={5}
      />

      {/* Corner lights for even distribution */}
      <pointLight position={[-2.5, 2.5, -2.5]} intensity={0.3} distance={8} />
      <pointLight position={[2.5, 2.5, -2.5]} intensity={0.3} distance={8} />
      <pointLight position={[-2.5, 2.5, 2.5]} intensity={0.3} distance={8} />
      <pointLight position={[2.5, 2.5, 2.5]} intensity={0.3} distance={8} />

      {/* Target object for main spotlight */}
      <object3D ref={targetRef} position={[0, 0.8, 2.8]} />
    </>
  );
};
