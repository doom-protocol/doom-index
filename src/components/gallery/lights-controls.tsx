"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { folder, useControls } from "leva";
import { useEffect, useMemo, useRef, type FC } from "react";
import { CircleGeometry, DoubleSide, Float32BufferAttribute, type Mesh, type Object3D, type SpotLight } from "three";

/**
 * Development-only interactive lights component with Leva controls.
 * Allows real-time adjustment of all lighting parameters.
 */
export const LightsWithControls: FC = () => {
  const keyLightRef = useRef<SpotLight>(null);
  const fillLightRef = useRef<SpotLight>(null);
  const targetRef = useRef<Object3D>(null);
  const floorGlowRef = useRef<Mesh>(null);
  const initializedRef = useRef(false);
  const { invalidate } = useThree();

  // Ambient Light Controls
  const ambientControls = useControls("Ambient Light", {
    intensity: { value: 0.04, min: 0, max: 1, step: 0.01 },
    color: "#151520",
  });

  // Hemisphere Light Controls
  const hemisphereControls = useControls("Hemisphere Light", {
    skyColor: "#3c3c54",
    groundColor: "#070711",
    intensity: { value: 0.06, min: 0, max: 1, step: 0.01 },
  });

  // Directional Light Controls
  const directionalControls = useControls("Directional Light", {
    position: folder({
      x: { value: -1.8, min: -10, max: 10, step: 0.1 },
      y: { value: 2.8, min: -10, max: 10, step: 0.1 },
      z: { value: 3, min: -10, max: 10, step: 0.1 },
    }),
    intensity: { value: 0.06, min: 0, max: 2, step: 0.01 },
    color: "#36364a",
  });

  // Key Spotlight Controls (Hero Light)
  const keyLightControls = useControls("Key Spotlight (Hero)", {
    position: folder({
      x: { value: 0, min: -10, max: 10, step: 0.1 },
      y: { value: 3.1, min: -10, max: 10, step: 0.1 },
      z: { value: 4.0, min: -10, max: 10, step: 0.1 },
    }),
    angle: { value: 0.4, min: 0, max: Math.PI / 2, step: 0.01 },
    penumbra: { value: 0.7, min: 0, max: 1, step: 0.01 },
    intensity: { value: 24, min: 0, max: 100, step: 0.5 },
    distance: { value: 6.0, min: 0, max: 20, step: 0.1 },
    decay: { value: 2, min: 0, max: 5, step: 0.1 },
    color: "#f0ddc8",
    castShadow: true,
    shadowMapSize: { value: 1024, min: 256, max: 4096, step: 256 },
    shadowBias: { value: -0.0012, min: -0.01, max: 0.01, step: 0.0001 },
  });

  // Fill Spotlight Controls (Side Kicker)
  const fillLightControls = useControls("Fill Spotlight (Side)", {
    position: folder({
      x: { value: 0.9, min: -10, max: 10, step: 0.1 },
      y: { value: 1.6, min: -10, max: 10, step: 0.1 },
      z: { value: 2.3, min: -10, max: 10, step: 0.1 },
    }),
    angle: { value: 0.38, min: 0, max: Math.PI / 2, step: 0.01 },
    penumbra: { value: 0.8, min: 0, max: 1, step: 0.01 },
    intensity: { value: 12, min: 0, max: 50, step: 0.5 },
    distance: { value: 5.0, min: 0, max: 20, step: 0.1 },
    decay: { value: 2, min: 0, max: 5, step: 0.1 },
    color: "#e7d2ba",
  });

  // Floor Wash Point Light Controls
  const floorWashControls = useControls("Floor Wash Light", {
    position: folder({
      x: { value: 0, min: -10, max: 10, step: 0.1 },
      y: { value: 1.05, min: -10, max: 10, step: 0.1 },
      z: { value: 3.45, min: -10, max: 10, step: 0.1 },
    }),
    intensity: { value: 0.12, min: 0, max: 2, step: 0.01 },
    distance: { value: 5.2, min: 0, max: 20, step: 0.1 },
    decay: { value: 2.1, min: 0, max: 5, step: 0.1 },
    color: "#26263a",
  });

  // Wall Grazer Left Controls
  const wallGrazerLeftControls = useControls("Wall Grazer Left", {
    position: folder({
      x: { value: -2.4, min: -10, max: 10, step: 0.1 },
      y: { value: 1.7, min: -10, max: 10, step: 0.1 },
      z: { value: 3.8, min: -10, max: 10, step: 0.1 },
    }),
    intensity: { value: 0.15, min: 0, max: 2, step: 0.01 },
    distance: { value: 7.2, min: 0, max: 20, step: 0.1 },
    decay: { value: 2.05, min: 0, max: 5, step: 0.1 },
    color: "#323248",
  });

  // Wall Grazer Right Controls
  const wallGrazerRightControls = useControls("Wall Grazer Right", {
    position: folder({
      x: { value: 2.4, min: -10, max: 10, step: 0.1 },
      y: { value: 1.7, min: -10, max: 10, step: 0.1 },
      z: { value: 3.6, min: -10, max: 10, step: 0.1 },
    }),
    intensity: { value: 0.12, min: 0, max: 2, step: 0.01 },
    distance: { value: 7.2, min: 0, max: 20, step: 0.1 },
    decay: { value: 2.05, min: 0, max: 5, step: 0.1 },
    color: "#343453",
  });

  // Back Wall Uplight Controls
  const backWallControls = useControls("Back Wall Uplight", {
    position: folder({
      x: { value: 0, min: -10, max: 10, step: 0.1 },
      y: { value: 0.78, min: -10, max: 10, step: 0.1 },
      z: { value: 4.45, min: -10, max: 10, step: 0.1 },
    }),
    intensity: { value: 0.2, min: 0, max: 2, step: 0.01 },
    distance: { value: 5.8, min: 0, max: 20, step: 0.1 },
    decay: { value: 2.2, min: 0, max: 5, step: 0.1 },
    color: "#26263a",
  });

  // Floor Glow Controls
  const floorGlowControls = useControls("Floor Glow", {
    color: "#fef3d4",
    opacity: { value: 0.04, min: 0, max: 0.5, step: 0.01 },
    radius: { value: 0.48, min: 0.1, max: 2, step: 0.01 },
    offsetZ: { value: -0.16, min: -1, max: 1, step: 0.01 },
  });

  // Target Position Controls
  const targetControls = useControls("Light Target", {
    x: { value: 0, min: -5, max: 5, step: 0.1 },
    y: { value: 0.82, min: -5, max: 5, step: 0.1 },
    z: { value: 4.0, min: -5, max: 10, step: 0.1 },
  });

  const floorGlowGeometry = useMemo(() => {
    const geometry = new CircleGeometry(floorGlowControls.radius, 64);
    const { count } = geometry.attributes.position;
    const colors: number[] = [];

    for (let i = 0; i < count; i += 1) {
      const x = geometry.attributes.position.getX(i);
      const y = geometry.attributes.position.getY(i);
      const radius = Math.min(Math.sqrt(x * x + y * y) / floorGlowControls.radius, 1);
      const intensity = Math.pow(Math.max(1 - radius, 0), 3.2);
      const falloff = intensity * 0.85;
      colors.push(falloff, falloff, falloff);
    }

    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return geometry;
  }, [floorGlowControls.radius]);

  // Initialize light targets once on mount
  useFrame(() => {
    if (initializedRef.current || !targetRef.current) {
      return;
    }

    if (keyLightRef.current) {
      keyLightRef.current.target = targetRef.current;
    }

    if (fillLightRef.current) {
      fillLightRef.current.target = targetRef.current;
    }

    initializedRef.current = true;
  });

  // Update shadow bias when control changes
  useEffect(() => {
    if (keyLightRef.current) {
      keyLightRef.current.shadow.bias = keyLightControls.shadowBias;
      invalidate();
    }
  }, [keyLightControls.shadowBias, invalidate]);

  // Update floor glow position when target changes
  useEffect(() => {
    if (floorGlowRef.current) {
      floorGlowRef.current.position.set(targetControls.x, 0.004, targetControls.z + floorGlowControls.offsetZ);
      invalidate();
    }
  }, [targetControls.x, targetControls.z, floorGlowControls.offsetZ, invalidate]);

  // Invalidate on any control change
  useEffect(() => {
    invalidate();
  }, [
    ambientControls,
    hemisphereControls,
    directionalControls,
    keyLightControls,
    fillLightControls,
    floorWashControls,
    wallGrazerLeftControls,
    wallGrazerRightControls,
    backWallControls,
    floorGlowControls,
    targetControls,
    invalidate,
  ]);

  return (
    <>
      {/* Ambient Light */}
      <ambientLight intensity={ambientControls.intensity} color={ambientControls.color} />

      {/* Hemisphere Light */}
      <hemisphereLight
        args={[hemisphereControls.skyColor, hemisphereControls.groundColor, hemisphereControls.intensity]}
      />

      {/* Directional Light */}
      <directionalLight
        position={[directionalControls.x, directionalControls.y, directionalControls.z]}
        intensity={directionalControls.intensity}
        color={directionalControls.color}
      />

      {/* Key Spotlight (Hero Light) */}
      <spotLight
        ref={keyLightRef}
        position={[keyLightControls.x, keyLightControls.y, keyLightControls.z]}
        angle={keyLightControls.angle}
        penumbra={keyLightControls.penumbra}
        intensity={keyLightControls.intensity}
        distance={keyLightControls.distance}
        decay={keyLightControls.decay}
        color={keyLightControls.color}
        castShadow={keyLightControls.castShadow}
        shadow-mapSize={[keyLightControls.shadowMapSize, keyLightControls.shadowMapSize]}
      />

      {/* Fill Spotlight (Side Kicker) */}
      <spotLight
        ref={fillLightRef}
        position={[fillLightControls.x, fillLightControls.y, fillLightControls.z]}
        angle={fillLightControls.angle}
        penumbra={fillLightControls.penumbra}
        intensity={fillLightControls.intensity}
        distance={fillLightControls.distance}
        decay={fillLightControls.decay}
        color={fillLightControls.color}
      />

      {/* Floor Wash Point Light */}
      <pointLight
        position={[floorWashControls.x, floorWashControls.y, floorWashControls.z]}
        intensity={floorWashControls.intensity}
        distance={floorWashControls.distance}
        decay={floorWashControls.decay}
        color={floorWashControls.color}
      />

      {/* Wall Grazer Left */}
      <pointLight
        position={[wallGrazerLeftControls.x, wallGrazerLeftControls.y, wallGrazerLeftControls.z]}
        intensity={wallGrazerLeftControls.intensity}
        distance={wallGrazerLeftControls.distance}
        decay={wallGrazerLeftControls.decay}
        color={wallGrazerLeftControls.color}
      />

      {/* Wall Grazer Right */}
      <pointLight
        position={[wallGrazerRightControls.x, wallGrazerRightControls.y, wallGrazerRightControls.z]}
        intensity={wallGrazerRightControls.intensity}
        distance={wallGrazerRightControls.distance}
        decay={wallGrazerRightControls.decay}
        color={wallGrazerRightControls.color}
      />

      {/* Back Wall Uplight */}
      <pointLight
        position={[backWallControls.x, backWallControls.y, backWallControls.z]}
        intensity={backWallControls.intensity}
        distance={backWallControls.distance}
        decay={backWallControls.decay}
        color={backWallControls.color}
      />

      {/* Floor Glow */}
      <mesh ref={floorGlowRef} rotation={[-Math.PI / 2, 0, 0]} geometry={floorGlowGeometry}>
        <meshBasicMaterial
          color={floorGlowControls.color}
          transparent
          opacity={floorGlowControls.opacity}
          depthWrite={false}
          side={DoubleSide}
          vertexColors
        />
      </mesh>

      {/* Target Object for Focused Lights */}
      <object3D ref={targetRef} position={[targetControls.x, targetControls.y, targetControls.z]} />
    </>
  );
};
