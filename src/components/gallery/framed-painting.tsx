"use client";

import React, { useEffect, useLayoutEffect, useRef, useState, forwardRef } from "react";
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
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Texture,
} from "three";
import { openTweetIntent } from "@/utils/twitter";
import {
  calculatePlaneDimensions,
  handlePointerMoveForDrag,
  handlePointerUpForClick,
  isValidPointerEvent,
} from "@/utils/three";
import { sendGAEvent, GA_EVENTS } from "@/lib/analytics";
import { FrameModel, PaintingGroup, type PaintingContentProps } from "@/components/ui/framed-painting-base";

interface FramedPaintingProps {
  thumbnailUrl: string;
  framePosition?: [number, number, number];
  paintingId?: string;
}

const PULSE_DURATION = 0.6;
const PULSE_MAX_SCALE = 1.45;
const INITIAL_PULSE_FILL_OPACITY = 0.45;
const INITIAL_PULSE_OUTLINE_OPACITY = 0.85;
const TRANSITION_DURATION = 0.8;
const DEFAULT_FRAME_POSITION: [number, number, number] = [0, 0.8, 4.0];
const FRAME_ROTATION: [number, number, number] = [0, Math.PI, 0];

// Material properties constants
const PAINTING_MATERIAL_ROUGHNESS = 0.25;
const PAINTING_MATERIAL_METALNESS = 0.05;

// Painting content component - handles texture transitions
const PaintingContent: React.FC<PaintingContentProps> = ({
  thumbnailUrl,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  paintingId,
}) => {
  const paintingMeshRef = useRef<Mesh>(null);
  const previousPaintingMeshRef = useRef<Mesh>(null);
  const pulseGroupRef = useRef<Group>(null);
  const pulseFillRef = useRef<Mesh>(null);
  const pulseOutlineRef = useRef<LineSegments>(null);
  const pulseElapsedRef = useRef(0);
  const isPulseActiveRef = useRef(false);

  // Load texture - useTexture automatically handles URL changes
  const texture = useTexture(thumbnailUrl, loadedTexture => {
    loadedTexture.colorSpace = SRGBColorSpace;
    loadedTexture.anisotropy = 4;
    loadedTexture.needsUpdate = true;
  });

  // Texture transition state
  const [currentTexture, setCurrentTexture] = useState<Texture | null>(texture);
  const [previousTexture, setPreviousTexture] = useState<Texture | null>(null);
  const [isTransitionActive, setIsTransitionActive] = useState(false);
  const previousThumbnailUrlRef = useRef<string | null>(thumbnailUrl);
  const transitionElapsedRef = useRef(0);
  const previousTextureRef = useRef<Texture | null>(null);
  const currentTextureRef = useRef<Texture | null>(texture);
  const pendingUrlRef = useRef<string | null>(null);

  // Handle thumbnailUrl changes - start transition when URL changes
  useLayoutEffect(() => {
    // URL changed - prepare for transition
    if (previousThumbnailUrlRef.current !== thumbnailUrl) {
      pendingUrlRef.current = thumbnailUrl;
      previousThumbnailUrlRef.current = thumbnailUrl;

      // If texture is already loaded and different, start transition immediately
      if (texture && currentTextureRef.current && texture !== currentTextureRef.current) {
        const oldTexture = currentTextureRef.current;
        previousTextureRef.current = oldTexture;
        setPreviousTexture(oldTexture);
        currentTextureRef.current = texture;
        setCurrentTexture(texture);
        transitionElapsedRef.current = 0;
        setIsTransitionActive(true);
        pendingUrlRef.current = null;
      }
    }
  }, [thumbnailUrl, texture]);

  // Watch for texture.image loading to catch when new texture is ready
  useEffect(() => {
    if (!texture?.image) {
      return;
    }

    const image = texture.image as HTMLImageElement;
    const imageSrc = image.src || image.currentSrc || "";

    // If we have a pending URL, check if this texture matches it
    if (pendingUrlRef.current) {
      if (imageSrc && imageSrc.includes(pendingUrlRef.current)) {
        const oldTexture = currentTextureRef.current;
        if (oldTexture && oldTexture !== texture) {
          setPreviousTexture(oldTexture);
        }

        currentTextureRef.current = texture;
        setCurrentTexture(texture);
        transitionElapsedRef.current = 0;
        setIsTransitionActive(true);
        pendingUrlRef.current = null;
        return;
      }
    }

    // Also check if texture reference changed (useTexture returned new texture)
    if (currentTextureRef.current !== texture && texture.image) {
      const currentImage = currentTextureRef.current?.image as HTMLImageElement | undefined;
      const currentImageSrc = currentImage?.src || currentImage?.currentSrc || "";

      // If image source is different, this is a new texture
      if (imageSrc && imageSrc !== currentImageSrc) {
        const oldTexture = currentTextureRef.current;
        if (oldTexture) {
          setPreviousTexture(oldTexture);
        }

        currentTextureRef.current = texture;
        setCurrentTexture(texture);
        transitionElapsedRef.current = 0;
        setIsTransitionActive(true);
      }
    }
  }, [texture]);

  // Frame dimensions (inner dimensions for the painting)
  // GLB model is 1m height, so inner painting should be slightly smaller
  // Adjust size to fit both mobile and PC screens
  const innerWidth = 0.7;
  const innerHeight = 0.7;

  // Calculate aspect ratio fit (contain) based on current texture
  const activeTexture = currentTexture || texture;
  const [planeWidth, planeHeight] = calculatePlaneDimensions(activeTexture, innerWidth, innerHeight);

  const pulseOutlineGeometry = React.useMemo(() => {
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

  // Cleanup textures on unmount
  useEffect(() => {
    return () => {
      if (previousTextureRef.current) {
        previousTextureRef.current.dispose();
      }
      if (currentTexture && currentTexture !== texture) {
        currentTexture.dispose();
      }
    };
  }, [currentTexture, texture]);

  useFrame(({ invalidate }, delta) => {
    let needsInvalidate = false;

    // Handle pulse animation
    if (isPulseActiveRef.current && pulseGroupRef.current) {
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

      needsInvalidate = true;
    }

    // Handle texture transition animation
    if (isTransitionActive && previousTextureRef.current) {
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
        setIsTransitionActive(false);
        const textureToDispose = previousTextureRef.current;
        previousTextureRef.current = null;
        setPreviousTexture(null);

        // Clean up previous texture
        if (textureToDispose) {
          textureToDispose.dispose();
        }

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

  const triggerPulse = () => {
    if (!pulseGroupRef.current) {
      return;
    }

    pulseElapsedRef.current = 0;
    isPulseActiveRef.current = true;
    pulseGroupRef.current.visible = true;
    pulseGroupRef.current.scale.set(1, 1, 1);

    if (pulseFillRef.current?.material instanceof MeshBasicMaterial) {
      pulseFillRef.current.material.opacity = INITIAL_PULSE_FILL_OPACITY;
    }

    if (pulseOutlineRef.current?.material instanceof LineBasicMaterial) {
      pulseOutlineRef.current.material.opacity = INITIAL_PULSE_OUTLINE_OPACITY;
    }
  };

  const triggerHaptics = () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.navigator.vibrate?.(40);
    } catch {
      // ignore haptics failures
    }
  };

  const handlePointerUpWithPulse = (event: ThreeEvent<PointerEvent>) => {
    const shouldTrigger = onPointerUp(event);
    if (shouldTrigger) {
      triggerPulse();
      triggerHaptics();
      if (paintingId) sendGAEvent(GA_EVENTS.GALLERY_PAINTING_CLICK, { painting_id: paintingId });
    }
  };

  // Calculate dimensions for previous texture if it exists
  const [previousPlaneWidth, previousPlaneHeight] = calculatePlaneDimensions(previousTexture, innerWidth, innerHeight);

  const displayTexture = currentTexture || texture;

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
