"use client";

import { useRef } from "react";
import { SpotLight, Object3D } from "three";
import { useFrame } from "@react-three/fiber";

export const Lights: React.FC = () => {
  const spotLightRef = useRef<SpotLight>(null);
  const targetRef = useRef<Object3D>(null);

  useFrame(() => {
    if (spotLightRef.current && targetRef.current) {
      spotLightRef.current.target = targetRef.current;
    }
  });

  return (
    <>
      {/* Ambient light for overall scene illumination */}
      <ambientLight intensity={0.05} />

      {/* Spotlight targeting the central frame */}
      <spotLight ref={spotLightRef} position={[0, 3.0, -2.0]} intensity={3.0} angle={0.2} penumbra={0.6} castShadow />

      {/* Target object for spotlight (center of the frame) */}
      <object3D ref={targetRef} position={[0, 1.6, -4.5]} />
    </>
  );
};
