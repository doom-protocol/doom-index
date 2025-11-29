"use client";

import { FrameModel, PaintingGroup, type PaintingContentProps } from "@/components/ui/framed-painting-base";
import { usePulseAnimation, PULSE_DURATION } from "@/hooks/use-pulse-animation";
import { useTextureTransition } from "@/hooks/use-texture-transition";
import { GA_EVENTS, sendGAEvent } from "@/lib/analytics";
import {
  calculatePlaneDimensions,
  handlePointerMoveForDrag,
  handlePointerUpForClick,
  isValidPointerEvent,
} from "@/utils/three";
import { openTweetIntent } from "@/utils/twitter";
import { useGLTF } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { forwardRef, useRef, type FC } from "react";
import { AdditiveBlending, MeshStandardMaterial, type Group, type Mesh, type Texture } from "three";
import { useHaptic } from "use-haptic";

interface FramedPaintingProps {
  thumbnailUrl: string;
  framePosition?: [number, number, number];
  paintingId?: string;
}

const TRANSITION_DURATION = 0.8;
const DEFAULT_FRAME_POSITION: [number, number, number] = [0, 0.8, 4.0];
const FRAME_ROTATION: [number, number, number] = [0, Math.PI, 0];

// Material properties constants
const PAINTING_MATERIAL_ROUGHNESS = 0.25;
const PAINTING_MATERIAL_METALNESS = 0.05;

// Frame dimensions (inner dimensions for the painting)
const FRAME_INNER_WIDTH = 0.7;
const FRAME_INNER_HEIGHT = 0.7;

// Painting content component - handles texture transitions using shared hooks
const PaintingContent: FC<PaintingContentProps> = ({
  thumbnailUrl,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  paintingId,
}) => {
  const paintingMeshRef = useRef<Mesh>(null);
  const previousPaintingMeshRef = useRef<Mesh>(null);

  const { triggerHaptic } = useHaptic();

  // Use shared texture transition hook
  const { currentTexture, previousTexture, isTransitionActive, transitionElapsedRef, completeTransition, rawTexture } =
    useTextureTransition(thumbnailUrl, { componentName: "FramedPainting" });

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

      // Ease-in-out curve for smooth transition
      const easedProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Update current texture opacity (fade in)
      const currentMaterial = paintingMeshRef.current?.material;
      if (currentMaterial instanceof MeshStandardMaterial) {
        currentMaterial.opacity = easedProgress;
        currentMaterial.transparent = true;
      }

      // Update previous texture opacity (fade out)
      const previousMaterial = previousPaintingMeshRef.current?.material;
      if (previousMaterial instanceof MeshStandardMaterial) {
        previousMaterial.opacity = 1 - easedProgress;
        previousMaterial.transparent = true;
      }

      if (progress >= 1) {
        // Transition complete
        completeTransition();

        // Reset transparency
        const finalMaterial = paintingMeshRef.current?.material;
        if (finalMaterial instanceof MeshStandardMaterial) {
          finalMaterial.transparent = false;
        }
      }

      needsInvalidate = true;
    }

    // Invalidate for demand mode only when animation is active
    if (needsInvalidate) {
      invalidate();
    }
  });

  const handlePointerUpWithPulse = (event: ThreeEvent<PointerEvent>) => {
    const shouldTrigger = onPointerUp(event);
    if (shouldTrigger) {
      triggerPulse();
      triggerHaptic();
      if (paintingId) sendGAEvent(GA_EVENTS.GALLERY_PAINTING_CLICK, { painting_id: paintingId });
    }
  };

  const displayTexture = (currentTexture || rawTexture) as Texture;

  return (
    <>
      {/* Previous painting plane (shown during transition) */}
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

      {/* Current painting plane */}
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

      {/* Highlight pulse */}
      <group ref={pulseGroupRef} position={[0, 0, -0.024]} visible={false}>
        <mesh ref={pulseFillRef}>
          <planeGeometry args={[planeWidth, planeHeight]} />
          <meshBasicMaterial
            map={displayTexture}
            color="#ffffff"
            transparent
            opacity={0}
            blending={AdditiveBlending}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
        {pulseOutlineGeometry && (
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
        )}
      </group>
    </>
  );
};
PaintingContent.displayName = "PaintingContent";

// Main component - separates frame from painting content
export const FramedPainting = forwardRef<Group, FramedPaintingProps>(
  ({ thumbnailUrl, framePosition = DEFAULT_FRAME_POSITION, paintingId }, ref) => {
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
        () => {
          window.setTimeout(() => {
            openTweetIntent();
          }, PULSE_DURATION * 1000);
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
      <PaintingGroup ref={ref} position={framePosition} rotation={FRAME_ROTATION}>
        {/* GLB Frame Model */}
        <FrameModel />

        {/* Painting content */}
        <PaintingContent
          thumbnailUrl={thumbnailUrl}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          paintingId={paintingId}
        />
      </PaintingGroup>
    );
  },
);
FramedPainting.displayName = "FramedPainting";

// Preload the GLB model (outside component to avoid re-execution)
useGLTF.preload("/frame.glb");
