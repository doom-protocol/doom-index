"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import {
  AdditiveBlending,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";
import type { GLTF } from "three-stdlib";
import { openTweetIntent } from "@/utils/twitter";

interface FramedPaintingProps {
  thumbnailUrl?: string;
  framePosition?: [number, number, number];
}

const DEFAULT_THUMBNAIL = "/placeholder-painting.webp";
const PULSE_DURATION = 0.6;
const PULSE_MAX_SCALE = 1.45;
const INITIAL_PULSE_FILL_OPACITY = 0.45;
const INITIAL_PULSE_OUTLINE_OPACITY = 0.85;
const POINTER_DRAG_THRESHOLD = 6;

export const FramedPainting: React.FC<FramedPaintingProps> = ({
  thumbnailUrl = DEFAULT_THUMBNAIL,
  framePosition = [0, 0.8, 4.0],
}) => {
  const paintingMeshRef = useRef<Mesh>(null);
  const pulseGroupRef = useRef<Group>(null);
  const pulseFillRef = useRef<Mesh>(null);
  const pulseOutlineRef = useRef<LineSegments>(null);
  const pulseElapsedRef = useRef(0);
  const isPulseActiveRef = useRef(false);
  const pointerDownPositionRef = useRef<{ x: number; y: number } | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const hasPointerMovedRef = useRef(false);

  // Load GLB frame model
  const { scene: frameModel } = useGLTF("/frame.glb") as GLTF;

  // Load texture
  const texture = useTexture(thumbnailUrl || DEFAULT_THUMBNAIL, loadedTexture => {
    loadedTexture.colorSpace = SRGBColorSpace;
    loadedTexture.anisotropy = 4;
    loadedTexture.needsUpdate = true;
  });

  // Frame dimensions (inner dimensions for the painting)
  // GLB model is 1m height, so inner painting should be slightly smaller
  // Adjust size to fit both mobile and PC screens
  const innerWidth = 0.7;
  const innerHeight = 0.7;

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

  const pulseOutlineGeometry = useMemo(() => {
    const plane = new PlaneGeometry(planeWidth, planeHeight);
    const edges = new EdgesGeometry(plane, 1);
    plane.dispose();
    return edges;
  }, [planeWidth, planeHeight]);

  useEffect(() => {
    return () => {
      pulseOutlineGeometry.dispose();
    };
  }, [pulseOutlineGeometry]);

  useFrame((_, delta) => {
    if (!isPulseActiveRef.current || !pulseGroupRef.current) {
      return;
    }

    pulseElapsedRef.current += delta;
    const progress = Math.min(pulseElapsedRef.current / PULSE_DURATION, 1);
    const scale = 1 + progress * (PULSE_MAX_SCALE - 1);

    pulseGroupRef.current.scale.set(scale, scale, 1);

    const fillMaterial = pulseFillRef.current?.material;
    if (fillMaterial instanceof MeshBasicMaterial) {
      fillMaterial.opacity = INITIAL_PULSE_FILL_OPACITY * (1 - progress);
    }

    const outlineMaterial = pulseOutlineRef.current?.material;
    if (outlineMaterial instanceof LineBasicMaterial) {
      outlineMaterial.opacity = INITIAL_PULSE_OUTLINE_OPACITY * (1 - progress);
    }

    if (progress >= 1) {
      pulseGroupRef.current.visible = false;
      isPulseActiveRef.current = false;
    }
  });

  const triggerPulse = useCallback(() => {
    if (!pulseGroupRef.current) {
      return;
    }

    pulseElapsedRef.current = 0;
    isPulseActiveRef.current = true;
    pulseGroupRef.current.visible = true;
    pulseGroupRef.current.scale.set(1, 1, 1);

    // Reset material opacity directly without storing references
    if (pulseFillRef.current?.material instanceof MeshBasicMaterial) {
      pulseFillRef.current.material.opacity = INITIAL_PULSE_FILL_OPACITY;
    }

    if (pulseOutlineRef.current?.material instanceof LineBasicMaterial) {
      pulseOutlineRef.current.material.opacity = INITIAL_PULSE_OUTLINE_OPACITY;
    }
  }, []);

  const triggerHaptics = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.navigator.vibrate?.(40);
    } catch {
      // ignore haptics failures
    }
  }, []);

  const resetPointerState = useCallback(() => {
    pointerDownPositionRef.current = null;
    activePointerIdRef.current = null;
    hasPointerMovedRef.current = false;
  }, []);

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!event.isPrimary) {
        return;
      }

      // For touch events, allow all touches. For mouse, only allow left button (button 0)
      if (event.pointerType !== "touch" && event.button !== 0) {
        return;
      }

      // Stop propagation to prevent OrbitControls from handling the event
      event.stopPropagation();

      resetPointerState();

      pointerDownPositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
      activePointerIdRef.current = event.pointerId;
      hasPointerMovedRef.current = false;
    },
    [resetPointerState],
  );
  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!event.isPrimary) {
      return;
    }

    if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) {
      return;
    }

    const start = pointerDownPositionRef.current;
    if (!start) {
      return;
    }

    // Stop propagation to prevent OrbitControls from handling the event during drag
    event.stopPropagation();

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.hypot(deltaX, deltaY) > POINTER_DRAG_THRESHOLD) {
      hasPointerMovedRef.current = true;
    }
  }, []);

  const handlePointerUp = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!event.isPrimary) {
        return;
      }

      if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) {
        return;
      }

      const shouldTrigger =
        pointerDownPositionRef.current !== null &&
        !hasPointerMovedRef.current &&
        (event.pointerType === "touch" || event.button === 0);

      resetPointerState();

      if (!shouldTrigger) {
        return;
      }

      event.stopPropagation();
      triggerPulse();
      triggerHaptics();

      window.setTimeout(() => {
        openTweetIntent({ assetUrl: thumbnailUrl });
      }, PULSE_DURATION * 1000);
    },
    [resetPointerState, thumbnailUrl, triggerHaptics, triggerPulse],
  );

  const handlePointerCancel = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!event.isPrimary) {
        return;
      }

      if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) {
        return;
      }

      resetPointerState();
    },
    [resetPointerState],
  );

  return (
    <group position={framePosition} rotation={[0, Math.PI, 0]}>
      {/* GLB Frame Model - flip X-axis to show front face */}
      <primitive object={frameModel.clone()} scale={[-1, 1, 1]} castShadow />

      {/* Painting plane */}
      <mesh
        ref={paintingMeshRef}
        position={[0, 0, -0.025]}
        castShadow
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerCancel}
        onPointerOut={handlePointerCancel}
        onPointerCancel={handlePointerCancel}
      >
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshStandardMaterial map={texture} roughness={0.25} metalness={0.05} />
      </mesh>

      {/* Highlight pulse */}
      <group ref={pulseGroupRef} position={[0, 0, -0.024]} visible={false}>
        <mesh ref={pulseFillRef}>
          <planeGeometry args={[planeWidth, planeHeight]} />
          <meshBasicMaterial
            map={texture}
            color="#ffffff"
            transparent
            opacity={0}
            blending={AdditiveBlending}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
        <lineSegments ref={pulseOutlineRef} geometry={pulseOutlineGeometry}>
          <lineBasicMaterial
            color="#ffffff"
            transparent
            opacity={0}
            depthWrite={false}
            depthTest={false}
            blending={AdditiveBlending}
          />
        </lineSegments>
      </group>
    </group>
  );
};

// Preload the GLB model
useGLTF.preload("/frame.glb");
