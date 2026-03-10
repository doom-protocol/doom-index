"use client";

import { FrameModel, PaintingGroup } from "@/components/ui/framed-painting-base";
import type { PaintingContentProps } from "@/components/ui/framed-painting-base";
import { GA_EVENTS, sendGAEvent } from "@/lib/analytics";
import {
  calculatePlaneDimensions,
  handlePointerMoveForDrag,
  handlePointerUpForClick,
  isValidPointerEvent,
} from "@/utils/three";
import { openTweetIntent } from "@/utils/twitter";
import { useGLTF } from "@react-three/drei";
import { useSafeTexture } from "@/hooks/use-safe-texture";
import {
  getDevicePixelRatio,
  getTimestampMs,
  getTransformedTextureUrl,
  measureTextureLoadDuration,
} from "@/lib/cloudflare-image";
import { logger } from "@/utils/logger";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { forwardRef, useEffect, useMemo, useRef } from "react";
import type { FC, RefObject } from "react";
import {
  AdditiveBlending,
  EdgesGeometry,
  LineBasicMaterial,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";
import type { MeshStandardMaterial, Group, LineSegments, Mesh, Texture } from "three";
import { useHaptic } from "use-haptic";

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
const PAINTING_MATERIAL_ROUGHNESS = 0.3;
const PAINTING_MATERIAL_METALNESS = 0.0;

// Painting content component - handles texture transitions
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
  const pulseGroupRef = useRef<Group>(null);
  const pulseFillRef = useRef<Mesh>(null);
  const pulseOutlineRef = useRef<LineSegments>(null);
  const pulseElapsedRef = useRef(0);
  const isPulseActiveRef = useRef(false);
  const currentMaterialRef = useRef<MeshStandardMaterial>(null);
  const previousMaterialRef = useRef<MeshStandardMaterial>(null);

  // Per-instance texture load timing (not module-scope for accurate measurement)
  const textureLoadStartRef = useRef<number>(getTimestampMs());

  const { triggerHaptic } = useHaptic();

  const dpr = getDevicePixelRatio();
  const transformedTextureUrl = getTransformedTextureUrl(thumbnailUrl, "galleryTexture", dpr);

  // Reset start time when URL changes
  useEffect(() => {
    textureLoadStartRef.current = getTimestampMs();
    logger.debug("framed-painting.texture.request.start", {
      url: transformedTextureUrl,
      paintingId,
    });
  }, [transformedTextureUrl, paintingId]);

  const texture = useSafeTexture(
    transformedTextureUrl,
    (loadedTexture) => {
      const tex = loadedTexture as Texture;
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = 8;
      tex.needsUpdate = true;

      // Use pure function for timing measurement
      const timing = measureTextureLoadDuration(textureLoadStartRef.current, transformedTextureUrl, paintingId);
      logger.debug("framed-painting.texture.loaded", timing);

      return tex;
    },
    {
      onError: (error) => {
        logger.error("framed-painting.texture.failed", {
          url: transformedTextureUrl,
          originalUrl: thumbnailUrl,
          error: error instanceof Error ? error.message : String(error),
          paintingId,
        });
      },
    },
  );

  const currentTextureRef = useRef<Texture | null>(null);
  const previousTextureRef = useRef<Texture | null>(null);
  const transitionElapsedRef = useRef(0);
  const isTransitionActiveRef = useRef(false);
  const currentPlaneRef = useRef<{ width: number; height: number }>({ width: 1, height: 1 });
  const previousPlaneRef = useRef<{ width: number; height: number }>({ width: 1, height: 1 });

  // Frame dimensions (inner dimensions for the painting)
  // GLB model is 1m height, so inner painting should be slightly smaller
  // Adjust size to fit both mobile and PC screens
  const innerWidth = 0.7;
  const innerHeight = 0.7;

  const pulseOutlineGeometry = useMemo(() => {
    const plane = new PlaneGeometry(1, 1);
    const edges = new EdgesGeometry(plane, 1);
    plane.dispose();
    return edges;
  }, []);

  useEffect(() => {
    return () => {
      pulseOutlineGeometry.dispose();
      if (previousTextureRef.current) {
        previousTextureRef.current.dispose();
        previousTextureRef.current = null;
      }
    };
  }, [pulseOutlineGeometry]);

  useFrame(({ invalidate }, delta) => {
    let needsInvalidate = false;

    // Handle pulse animation
    if (isPulseActiveRef.current && pulseGroupRef.current) {
      pulseElapsedRef.current += delta;
      const progress = Math.min(pulseElapsedRef.current / PULSE_DURATION, 1);
      const { width, height } = currentPlaneRef.current;
      const scale = 1 + progress * (PULSE_MAX_SCALE - 1);
      pulseGroupRef.current.scale.set(width * scale, height * scale, 1);

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
    } else if (pulseGroupRef.current) {
      const { width, height } = currentPlaneRef.current;
      pulseGroupRef.current.scale.set(width, height, 1);
    }

    const nextTexture = texture as Texture | null;
    if (nextTexture?.image) {
      if (!currentTextureRef.current) {
        currentTextureRef.current = nextTexture;
        const [w, h] = calculatePlaneDimensions(nextTexture, innerWidth, innerHeight);
        currentPlaneRef.current = { width: w, height: h };

        if (paintingMeshRef.current) {
          paintingMeshRef.current.scale.set(w, h, 1);
        }

        const material = currentMaterialRef.current;
        if (material) {
          material.map = nextTexture;
          material.transparent = false;
          material.opacity = 1;
          material.needsUpdate = true;
        }

        if (previousPaintingMeshRef.current) {
          previousPaintingMeshRef.current.visible = false;
        }
      } else if (currentTextureRef.current !== nextTexture && !isTransitionActiveRef.current) {
        const oldTexture = currentTextureRef.current;
        previousTextureRef.current = oldTexture;
        currentTextureRef.current = nextTexture;

        const [currentW, currentH] = calculatePlaneDimensions(nextTexture, innerWidth, innerHeight);
        const [previousW, previousH] = calculatePlaneDimensions(oldTexture, innerWidth, innerHeight);
        currentPlaneRef.current = { width: currentW, height: currentH };
        previousPlaneRef.current = { width: previousW, height: previousH };

        if (paintingMeshRef.current) {
          paintingMeshRef.current.scale.set(currentW, currentH, 1);
        }
        if (previousPaintingMeshRef.current) {
          previousPaintingMeshRef.current.visible = true;
          previousPaintingMeshRef.current.scale.set(previousW, previousH, 1);
        }

        const currentMaterial = currentMaterialRef.current;
        const prevMaterial = previousMaterialRef.current;
        if (currentMaterial) {
          currentMaterial.map = nextTexture;
          currentMaterial.transparent = true;
          currentMaterial.opacity = 0;
          currentMaterial.needsUpdate = true;
        }
        if (prevMaterial) {
          prevMaterial.map = oldTexture;
          prevMaterial.transparent = true;
          prevMaterial.opacity = 1;
          prevMaterial.needsUpdate = true;
        }

        transitionElapsedRef.current = 0;
        isTransitionActiveRef.current = true;
        needsInvalidate = true;
      }
    }

    if (isTransitionActiveRef.current) {
      transitionElapsedRef.current += delta;
      const progress = Math.min(transitionElapsedRef.current / TRANSITION_DURATION, 1);
      const easedProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const currentMaterial = currentMaterialRef.current;
      const prevMaterial = previousMaterialRef.current;
      if (currentMaterial) {
        currentMaterial.opacity = easedProgress;
      }
      if (prevMaterial) {
        prevMaterial.opacity = 1 - easedProgress;
      }

      if (progress >= 1) {
        isTransitionActiveRef.current = false;
        transitionElapsedRef.current = 0;

        const textureToDispose = previousTextureRef.current;
        previousTextureRef.current = null;

        if (previousPaintingMeshRef.current) {
          previousPaintingMeshRef.current.visible = false;
        }
        if (prevMaterial) {
          prevMaterial.map = null;
          prevMaterial.opacity = 0;
        }
        if (currentMaterial) {
          currentMaterial.transparent = false;
          currentMaterial.opacity = 1;
        }

        if (textureToDispose) {
          textureToDispose.dispose();
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
    const { width, height } = currentPlaneRef.current;
    pulseGroupRef.current.scale.set(width, height, 1);

    if (pulseFillRef.current?.material instanceof MeshBasicMaterial) {
      pulseFillRef.current.material.opacity = INITIAL_PULSE_FILL_OPACITY;
    }

    if (pulseOutlineRef.current?.material instanceof LineBasicMaterial) {
      pulseOutlineRef.current.material.opacity = INITIAL_PULSE_OUTLINE_OPACITY;
    }
  };

  const handlePointerUpWithPulse = (event: ThreeEvent<PointerEvent>) => {
    const shouldTrigger = onPointerUp(event);
    if (shouldTrigger) {
      triggerPulse();
      triggerHaptic();
      if (paintingId)
        sendGAEvent(GA_EVENTS.GALLERY_PAINTING_CLICK, {
          painting_id: paintingId,
        });
    }
  };

  return (
    <>
      {/* Previous painting plane (shown during transition) */}
      <mesh
        ref={previousPaintingMeshRef}
        position={[0, 0, -0.026]}
        castShadow={false}
        receiveShadow={false}
        visible={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          ref={previousMaterialRef}
          map={null}
          roughness={PAINTING_MATERIAL_ROUGHNESS}
          metalness={PAINTING_MATERIAL_METALNESS}
          emissive="#ffffff"
          emissiveIntensity={0.015}
          transparent
          opacity={0}
        />
      </mesh>

      {/* Current painting plane */}
      <mesh
        ref={paintingMeshRef}
        position={[0, 0, -0.025]}
        castShadow
        receiveShadow={false}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={handlePointerUpWithPulse}
        onPointerLeave={onPointerCancel}
        onPointerOut={onPointerCancel}
        onPointerCancel={onPointerCancel}
      >
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          ref={currentMaterialRef}
          map={texture as Texture}
          roughness={PAINTING_MATERIAL_ROUGHNESS}
          metalness={PAINTING_MATERIAL_METALNESS}
          emissive="#ffffff"
          emissiveIntensity={0.015}
          transparent
          opacity={1}
        />
      </mesh>

      {/* Highlight pulse */}
      <group ref={pulseGroupRef} position={[0, 0, -0.024]} visible={false}>
        <mesh ref={pulseFillRef}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={texture as Texture}
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
    </>
  );
};
PaintingContent.displayName = "PaintingContent";

// Main component - separates frame from painting content
export const FramedPainting = ({
  ref,
  thumbnailUrl,
  framePosition = DEFAULT_FRAME_POSITION,
  paintingId,
}: FramedPaintingProps & { ref?: RefObject<Group | null> }) => {
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
};
FramedPainting.displayName = "FramedPainting";

// Preload the GLB model (outside component to avoid re-execution)
useGLTF.preload("/frame.glb");
