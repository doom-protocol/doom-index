"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type FC } from "react";
import {
  CircleGeometry,
  DoubleSide,
  Float32BufferAttribute,
  type Mesh,
  type Object3D,
  type SpotLight,
  Vector3,
} from "three";

export const Lights: FC = () => {
  const keyLightRef = useRef<SpotLight>(null);
  const fillLightRef = useRef<SpotLight>(null);
  const targetRef = useRef<Object3D>(null);
  const floorGlowRef = useRef<Mesh>(null);

  const lightPosition = useRef(new Vector3());
  const targetPosition = useRef(new Vector3());

  const floorGlowGeometry = useMemo(() => {
    const geometry = new CircleGeometry(0.48, 64);
    const { count } = geometry.attributes.position;
    const colors: number[] = [];

    for (let i = 0; i < count; i += 1) {
      const x = geometry.attributes.position.getX(i);
      const y = geometry.attributes.position.getY(i);
      const radius = Math.min(Math.sqrt(x * x + y * y) / 0.48, 1);
      const intensity = Math.pow(Math.max(1 - radius, 0), 3.2);
      const falloff = intensity * 0.85;
      colors.push(falloff, falloff, falloff);
    }

    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return geometry;
  }, []);

  useFrame(({ invalidate }) => {
    if (!targetRef.current) {
      return;
    }

    targetPosition.current.copy(targetRef.current.position);

    if (keyLightRef.current) {
      keyLightRef.current.target = targetRef.current;
      keyLightRef.current.shadow.bias = -0.0012;
      lightPosition.current.copy(keyLightRef.current.position);
    }

    if (fillLightRef.current) {
      fillLightRef.current.target = targetRef.current;
    }

    if (floorGlowRef.current) {
      floorGlowRef.current.position.set(targetPosition.current.x, 0.004, targetPosition.current.z - 0.16);
    }

    // Invalidate for demand mode
    invalidate();
  });

  return (
    <>
      {/* Gentle ambient glow to lift the space */}
      <ambientLight intensity={0.48} color="#323248" />

      {/* Ceiling bounce to keep wall details visible */}
      <hemisphereLight args={["#737395", "#1e1e2c", 0.55]} />

      {/* Subtle overhead wash to outline architecture */}
      <directionalLight position={[-1.8, 2.8, 3]} intensity={0.45} color="#5c5c74" />

      {/* Key spotlight directly above the painting */}
      <spotLight
        ref={keyLightRef}
        position={[0, 2.95, 4.0]}
        angle={0.62}
        penumbra={0.96}
        intensity={20}
        distance={5.8}
        decay={2}
        color="#f6e3c4"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      {/* Secondary spill from the front to soften falloff */}
      <spotLight
        ref={fillLightRef}
        position={[0.35, 2.4, 2.8]}
        angle={0.6}
        penumbra={0.95}
        intensity={12}
        distance={6.2}
        decay={2}
        color="#dccab0"
      />

      {/* Subtle floor wash */}
      <pointLight position={[0, 1.05, 3.45]} intensity={1.2} distance={5.2} decay={2.1} color="#4a4a66" />

      {/* Wall grazers for a luxurious ambient glow */}
      <pointLight position={[-2.4, 1.7, 3.8]} intensity={1.55} distance={7.2} decay={2.05} color="#5a5a75" />
      <pointLight position={[2.4, 1.7, 3.6]} intensity={1.45} distance={7.2} decay={2.05} color="#5c5c78" />

      {/* Back wall uplight to silhouette the frame */}
      <pointLight position={[0, 0.78, 4.45]} intensity={1.05} distance={5.8} decay={2.2} color="#3c3c52" />

      {/* Soft floor glow to hint at the spotlight focus */}
      <mesh ref={floorGlowRef} rotation={[-Math.PI / 2, 0, 0]} geometry={floorGlowGeometry}>
        <meshBasicMaterial
          color="#fef3d4"
          transparent
          opacity={0.14}
          depthWrite={false}
          side={DoubleSide}
          vertexColors
        />
      </mesh>

      {/* Target object for the focused lights */}
      <object3D ref={targetRef} position={[0, 0.82, 4.0]} />
    </>
  );
};
