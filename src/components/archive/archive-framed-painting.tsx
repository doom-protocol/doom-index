"use client";

import { FrameModel, PaintingGroup, type PaintingContentProps } from "@/components/ui/framed-painting-base";
import { usePulseAnimation } from "@/hooks/use-pulse-animation";
import { useTextureTransition } from "@/hooks/use-texture-transition";
import type { Painting } from "@/types/paintings";
import {
  calculatePlaneDimensions,
  handlePointerMoveForDrag,
  handlePointerUpForClick,
  isValidPointerEvent,
} from "@/utils/three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useRef, type FC } from "react";
import { AdditiveBlending, type MeshStandardMaterial, type Mesh, type Texture } from "three";

interface ArchiveFramedPaintingProps {
  item: Painting;
  framePosition?: [number, number, number];
  onPointerClick?: (item: Painting, event: ThreeEvent<PointerEvent>) => void;
}

const TRANSITION_DURATION = 0.8;
const DEFAULT_FRAME_POSITION: [number, number, number] = [0, 0.8, 4.0];
const FRAME_ROTATION: [number, number, number] = [0, Math.PI, 0];

const PAINTING_MATERIAL_ROUGHNESS = 0.25;
const PAINTING_MATERIAL_METALNESS = 0.05;

const FRAME_INNER_WIDTH = 0.6;
const FRAME_INNER_HEIGHT = 0.8;

// Painting content component - uses shared hooks for texture transitions and pulse animation
const PaintingContent: FC<PaintingContentProps> = ({
  thumbnailUrl,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}) => {
  const paintingMeshRef = useRef<Mesh>(null);
  const previousPaintingMeshRef = useRef<Mesh>(null);

  // Use shared texture transition hook
  const { currentTexture, previousTexture, isTransitionActive, transitionElapsedRef, completeTransition, rawTexture } =
    useTextureTransition(thumbnailUrl, { componentName: "ArchiveFramedPainting" });

  // Calculate aspect ratio fit (contain) based on current texture
  const activeTexture = currentTexture || rawTexture;
  const [planeWidth, planeHeight] = calculatePlaneDimensions(activeTexture, FRAME_INNER_WIDTH, FRAME_INNER_HEIGHT);

  // Use shared pulse animation hook
  const {
    refs: { pulseGroupRef, pulseFillRef, pulseOutlineRef },
    pulseOutlineGeometry,
    triggerPulse,
    updatePulse,
  } = usePulseAnimation(planeWidth, planeHeight);

  // Calculate dimensions for previous texture if it exists
  const [previousPlaneWidth, previousPlaneHeight] = calculatePlaneDimensions(
    previousTexture,
    FRAME_INNER_WIDTH,
    FRAME_INNER_HEIGHT,
  );

  useFrame(({ invalidate }, delta) => {
    let needsInvalidate = false;

    // Handle pulse animation
    if (updatePulse(delta)) {
      needsInvalidate = true;
    }

    // Handle texture transition animation
    if (isTransitionActive) {
      transitionElapsedRef.current += delta;
      const progress = Math.min(transitionElapsedRef.current / TRANSITION_DURATION, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      if (previousPaintingMeshRef.current) {
        const opacity = 1 - easedProgress;
        const material = previousPaintingMeshRef.current.material as MeshStandardMaterial;
        if (material) {
          material.opacity = opacity;
        }
      }

      if (paintingMeshRef.current) {
        const opacity = easedProgress;
        const material = paintingMeshRef.current.material as MeshStandardMaterial;
        if (material) {
          material.opacity = opacity;
        }
      }

      if (progress >= 1) {
        completeTransition();
      }

      needsInvalidate = true;
    }

    if (needsInvalidate) {
      invalidate();
    }
  });

  const handlePointerUpWithPulse = (event: ThreeEvent<PointerEvent>): boolean => {
    const result = onPointerUp(event);
    if (result && pulseGroupRef.current && pulseFillRef.current && pulseOutlineRef.current) {
      triggerPulse();
    }
    return result;
  };

  const displayTexture = (currentTexture || rawTexture) as Texture;

  return (
    <>
      {previousTexture && (
        <mesh ref={previousPaintingMeshRef} position={[0, 0, -0.026]} castShadow={false} receiveShadow={false}>
          <planeGeometry args={[previousPlaneWidth, previousPlaneHeight]} />
          <meshStandardMaterial
            map={previousTexture}
            roughness={PAINTING_MATERIAL_ROUGHNESS}
            metalness={PAINTING_MATERIAL_METALNESS}
            transparent
            opacity={1}
          />
        </mesh>
      )}

      <mesh
        ref={paintingMeshRef}
        position={[0, 0, -0.025]}
        castShadow
        receiveShadow
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={handlePointerUpWithPulse}
        onPointerLeave={onPointerCancel}
        onPointerOut={onPointerCancel}
        onPointerCancel={onPointerCancel}
      >
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshStandardMaterial
          map={displayTexture}
          roughness={PAINTING_MATERIAL_ROUGHNESS}
          metalness={PAINTING_MATERIAL_METALNESS}
          transparent={isTransitionActive}
          opacity={isTransitionActive ? 0 : 1}
        />
      </mesh>

      <group ref={pulseGroupRef} position={[0, 0, -0.024]} visible={false}>
        {pulseOutlineGeometry && (
          <>
            <mesh ref={pulseFillRef}>
              <planeGeometry args={[planeWidth, planeHeight]} />
              <meshBasicMaterial
                color="#ffffff"
                transparent
                opacity={0}
                blending={AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            <lineSegments ref={pulseOutlineRef} geometry={pulseOutlineGeometry}>
              <lineBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
            </lineSegments>
          </>
        )}
      </group>
    </>
  );
};

export const ArchiveFramedPainting: FC<ArchiveFramedPaintingProps> = ({
  item,
  framePosition = DEFAULT_FRAME_POSITION,
  onPointerClick,
}) => {
  const pointerDownPositionRef = useRef<{ x: number; y: number } | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const hasPointerMovedRef = useRef(false);

  const resetPointerState = () => {
    pointerDownPositionRef.current = null;
    activePointerIdRef.current = null;
    hasPointerMovedRef.current = false;
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (!event.isPrimary) {
      return;
    }

    if (event.pointerType !== "touch" && event.button !== 0) {
      return;
    }

    event.stopPropagation();
    resetPointerState();

    pointerDownPositionRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
    activePointerIdRef.current = event.pointerId;
    hasPointerMovedRef.current = false;
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    handlePointerMoveForDrag(event, pointerDownPositionRef, hasPointerMovedRef, activePointerIdRef);
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>): boolean => {
    return handlePointerUpForClick(
      event,
      pointerDownPositionRef,
      hasPointerMovedRef,
      activePointerIdRef,
      resetPointerState,
      e => {
        if (onPointerClick) {
          onPointerClick(item, e);
        }
      },
    );
  };

  const handlePointerCancel = (event: ThreeEvent<PointerEvent>) => {
    if (!isValidPointerEvent(event, activePointerIdRef.current)) {
      return;
    }

    resetPointerState();
  };

  return (
    <PaintingGroup position={framePosition} rotation={FRAME_ROTATION}>
      <FrameModel />
      <PaintingContent
        thumbnailUrl={item.imageUrl}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />
    </PaintingGroup>
  );
};
ArchiveFramedPainting.displayName = "ArchiveFramedPainting";
