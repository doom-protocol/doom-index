"use client";

import { FrameModel, PaintingGroup, type PaintingContentProps } from "@/components/ui/framed-painting-base";
import type { Painting } from "@/types/paintings";
import {
  calculatePlaneDimensions,
  handlePointerMoveForDrag,
  handlePointerUpForClick,
  isValidPointerEvent,
} from "@/utils/three";
import { useSafeTexture } from "@/hooks/use-safe-texture";
import { getDevicePixelRatio, getTransformedTextureUrl } from "@/lib/cloudflare-image";
import { logger } from "@/utils/logger";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type FC } from "react";
import {
  AdditiveBlending,
  EdgesGeometry,
  PlaneGeometry,
  SRGBColorSpace,
  type Group,
  type LineBasicMaterial,
  type LineSegments,
  type Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
  type Texture,
} from "three";

interface ArchiveFramedPaintingProps {
  item: Painting;
  framePosition?: [number, number, number];
  onPointerClick?: (item: Painting, event: ThreeEvent<PointerEvent>) => void;
}

const PULSE_DURATION = 0.6;
const PULSE_MAX_SCALE = 1.45;
const INITIAL_PULSE_FILL_OPACITY = 0.45;
const INITIAL_PULSE_OUTLINE_OPACITY = 0.85;
const TRANSITION_DURATION = 0.8;
const DEFAULT_FRAME_POSITION: [number, number, number] = [0, 0.8, 4.0];
const FRAME_ROTATION: [number, number, number] = [0, Math.PI, 0];

const PAINTING_MATERIAL_ROUGHNESS = 0.3;
const PAINTING_MATERIAL_METALNESS = 0.0;

const FRAME_INNER_WIDTH = 0.6;
const FRAME_INNER_HEIGHT = 0.8;

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
  const currentMaterialRef = useRef<MeshStandardMaterial>(null);
  const previousMaterialRef = useRef<MeshStandardMaterial>(null);
  const pulseElapsedRef = useRef(0);
  const isPulseActiveRef = useRef(false);

  // Transform texture URL with Cloudflare Image Transformations for detail view (higher quality)
  const dpr = getDevicePixelRatio();
  const transformedTextureUrl = getTransformedTextureUrl(thumbnailUrl, "modalFull", dpr);

  const texture = useSafeTexture(
    transformedTextureUrl,
    (loadedTexture) => {
      loadedTexture.colorSpace = SRGBColorSpace;
      loadedTexture.anisotropy = 4;
      loadedTexture.needsUpdate = true;
    },
    {
      onError: (error) => {
        logger.error("Failed to load archive painting texture", {
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

    const nextTexture = texture as Texture | null;
    if (nextTexture?.image) {
      // Initialize or begin transition when the texture instance changes.
      if (!currentTextureRef.current) {
        currentTextureRef.current = nextTexture;

        const [w, h] = calculatePlaneDimensions(nextTexture, FRAME_INNER_WIDTH, FRAME_INNER_HEIGHT);
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

        const [currentW, currentH] = calculatePlaneDimensions(nextTexture, FRAME_INNER_WIDTH, FRAME_INNER_HEIGHT);
        const [previousW, previousH] = calculatePlaneDimensions(oldTexture, FRAME_INNER_WIDTH, FRAME_INNER_HEIGHT);
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
      const easedProgress = 1 - Math.pow(1 - progress, 3);

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

        // Preserve existing behavior: dispose the outgoing texture after transition completes.
        if (textureToDispose) {
          textureToDispose.dispose();
        }
      }

      needsInvalidate = true;
    }

    if (isPulseActiveRef.current) {
      pulseElapsedRef.current += delta;
      const progress = Math.min(pulseElapsedRef.current / PULSE_DURATION, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 2);

      if (pulseGroupRef.current) {
        const { width, height } = currentPlaneRef.current;
        const scaleFactor = 1 + (PULSE_MAX_SCALE - 1) * easedProgress;
        pulseGroupRef.current.scale.set(width * scaleFactor, height * scaleFactor, 1);
      }

      if (pulseFillRef.current) {
        const material = pulseFillRef.current.material as MeshBasicMaterial;
        if (material) {
          material.opacity = INITIAL_PULSE_FILL_OPACITY * (1 - easedProgress);
        }
      }

      if (pulseOutlineRef.current) {
        const material = pulseOutlineRef.current.material as LineBasicMaterial;
        if (material) {
          material.opacity = INITIAL_PULSE_OUTLINE_OPACITY * (1 - easedProgress);
        }
      }

      if (progress >= 1) {
        isPulseActiveRef.current = false;
        if (pulseGroupRef.current) {
          pulseGroupRef.current.visible = false;
        }
      }

      needsInvalidate = true;
    } else if (pulseGroupRef.current) {
      const { width, height } = currentPlaneRef.current;
      pulseGroupRef.current.scale.set(width, height, 1);
    }

    if (needsInvalidate) {
      invalidate();
    }
  });

  const handlePointerUpWithPulse = (event: ThreeEvent<PointerEvent>): boolean => {
    const result = onPointerUp(event);
    if (result && pulseGroupRef.current && pulseFillRef.current && pulseOutlineRef.current) {
      isPulseActiveRef.current = true;
      pulseElapsedRef.current = 0;
      pulseGroupRef.current.visible = true;
      const { width, height } = currentPlaneRef.current;
      pulseGroupRef.current.scale.set(width, height, 1);
    }
    return result;
  };

  return (
    <>
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

      <group ref={pulseGroupRef} position={[0, 0, -0.024]} visible={false}>
        <mesh ref={pulseFillRef}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={INITIAL_PULSE_FILL_OPACITY}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <lineSegments ref={pulseOutlineRef} geometry={pulseOutlineGeometry}>
          <lineBasicMaterial color="#ffffff" transparent opacity={INITIAL_PULSE_OUTLINE_OPACITY} depthWrite={false} />
        </lineSegments>
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
      (e) => {
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
        paintingId={item.id}
      />
    </PaintingGroup>
  );
};
ArchiveFramedPainting.displayName = "ArchiveFramedPainting";
