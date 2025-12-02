"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type FC } from "react";
import { CircleGeometry, DoubleSide, Float32BufferAttribute, type Mesh, type Object3D, type SpotLight } from "three";

interface LightsProps {
  variant?: "simple" | "full";
}

// Simple lights for fast initial render (no hooks, no shadows)
const SimpleLights: FC = () => (
  <>
    <ambientLight intensity={0.5} color="#323248" />
    <directionalLight position={[-1.5, 2.5, 3]} intensity={0.8} color="#f6e3c4" />
  </>
);

// Full lights with all effects
const FullLights: FC = () => {
  const keyLightRef = useRef<SpotLight>(null);
  const fillLightRef = useRef<SpotLight>(null);
  const targetRef = useRef<Object3D>(null);
  const floorGlowRef = useRef<Mesh>(null);
  const initializedRef = useRef(false);

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

  // Initialize light targets once on mount (no continuous updates needed)
  useFrame(() => {
    // Skip if already initialized or refs not ready
    if (initializedRef.current || !targetRef.current) {
      return;
    }

    // Set up light targets once - they don't change during runtime
    if (keyLightRef.current) {
      keyLightRef.current.target = targetRef.current;
      keyLightRef.current.shadow.bias = -0.0012;
    }

    if (fillLightRef.current) {
      fillLightRef.current.target = targetRef.current;
    }

    // Position floor glow once
    if (floorGlowRef.current) {
      const targetPos = targetRef.current.position;
      floorGlowRef.current.position.set(targetPos.x, 0.004, targetPos.z - 0.16);
    }

    // Mark as initialized - no more updates needed
    initializedRef.current = true;
    // No invalidate() call - lights are static, no need for continuous rendering
  });

  return (
    <>
      {/* Gentle ambient glow to lift the space */}
      <ambientLight intensity={0.2} color="#26263a" />

      {/* Ceiling bounce to keep wall details slightly visible */}
      <hemisphereLight args={["#5a5a7a", "#131320", 0.25]} />

      {/* Subtle overhead wash to outline architecture */}
      <directionalLight position={[-1.8, 2.8, 3]} intensity={0.18} color="#4a4a64" />

      {/* Key spotlight directly above the painting */}
      <spotLight
        ref={keyLightRef}
        position={[0, 2.95, 4.0]}
        angle={0.7}
        penumbra={0.96}
        intensity={26}
        distance={6.5}
        decay={2}
        color="#f6e3c4"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* Secondary spill from the front to soften falloff */}
      <spotLight
        ref={fillLightRef}
        position={[0.15, 2.3, 2.6]}
        angle={0.7}
        penumbra={0.95}
        intensity={14}
        distance={6.5}
        decay={2}
        color="#dccab0"
      />

      {/* Subtle floor wash */}
      <pointLight position={[0, 1.05, 3.45]} intensity={0.4} distance={5.2} decay={2.1} color="#3c3c56" />

      {/* Wall grazers for a very soft ambient glow */}
      <pointLight position={[-2.4, 1.7, 3.8]} intensity={0.45} distance={7.2} decay={2.05} color="#4a4a66" />
      <pointLight position={[2.4, 1.7, 3.6]} intensity={0.4} distance={7.2} decay={2.05} color="#4c4c69" />

      {/* Back wall uplight to silhouette the frame */}
      <pointLight position={[0, 0.78, 4.45]} intensity={0.45} distance={5.8} decay={2.2} color="#323248" />

      {/* Soft floor glow to hint at the spotlight focus */}
      <mesh ref={floorGlowRef} rotation={[-Math.PI / 2, 0, 0]} geometry={floorGlowGeometry}>
        <meshBasicMaterial
          color="#fef3d4"
          transparent
          opacity={0.08}
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

// Exported component that switches between simple and full lights
export const Lights: FC<LightsProps> = ({ variant = "full" }) => {
  if (variant === "simple") {
    return <SimpleLights />;
  }
  return <FullLights />;
};
