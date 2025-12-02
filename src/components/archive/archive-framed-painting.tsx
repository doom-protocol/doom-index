"use client";

import React from "react";
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
import { useEffect, useLayoutEffect, useRef, useState, type FC } from "react";
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

const PAINTING_MATERIAL_ROUGHNESS = 0.45;
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
  const pulseElapsedRef = useRef(0);
  const isPulseActiveRef = useRef(false);

  // Transform texture URL with Cloudflare Image Transformations for detail view (higher quality)
  const dpr = getDevicePixelRatio();
  const transformedTextureUrl = getTransformedTextureUrl(thumbnailUrl, "modalFull", dpr);

  const texture = useSafeTexture(
    transformedTextureUrl,
    loadedTexture => {
      loadedTexture.colorSpace = SRGBColorSpace;
      loadedTexture.anisotropy = 4;
      loadedTexture.needsUpdate = true;
    },
    {
      onError: error => {
        logger.error("Failed to load archive painting texture", {
          url: transformedTextureUrl,
          originalUrl: thumbnailUrl,
          error: error instanceof Error ? error.message : String(error),
          paintingId,
        });
      },
    },
  );

  const [currentTexture, setCurrentTexture] = useState<Texture | null>(texture);
  const [previousTexture, setPreviousTexture] = useState<Texture | null>(null);
  const [isTransitionActive, setIsTransitionActive] = useState(false);
  const previousThumbnailUrlRef = useRef<string | null>(thumbnailUrl);
  const transitionElapsedRef = useRef(0);
  const previousTextureRef = useRef<Texture | null>(null);
  const currentTextureRef = useRef<Texture | null>(texture);
  const pendingUrlRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (previousThumbnailUrlRef.current !== thumbnailUrl) {
      pendingUrlRef.current = thumbnailUrl;
      previousThumbnailUrlRef.current = thumbnailUrl;

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

  useEffect(() => {
    if (!texture?.image) {
      return;
    }

    const image = texture.image as HTMLImageElement;
    const imageSrc = image.src || image.currentSrc || "";

    if (pendingUrlRef.current) {
      if (imageSrc && imageSrc.includes(pendingUrlRef.current)) {
        const oldTexture = currentTextureRef.current;
        if (oldTexture && oldTexture !== texture) {
          previousTextureRef.current = oldTexture;
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

    if (currentTextureRef.current !== texture && texture.image) {
      const currentImage = currentTextureRef.current?.image as HTMLImageElement | undefined;
      const currentImageSrc = currentImage?.src || currentImage?.currentSrc || "";

      if (imageSrc && imageSrc !== currentImageSrc) {
        const oldTexture = currentTextureRef.current;
        if (oldTexture) {
          previousTextureRef.current = oldTexture;
          setPreviousTexture(oldTexture);
        }

        currentTextureRef.current = texture;
        setCurrentTexture(texture);
        transitionElapsedRef.current = 0;
        setIsTransitionActive(true);
      }
    }
  }, [texture]);

  const activeTexture = currentTexture || texture;
  const [planeWidth, planeHeight] = calculatePlaneDimensions(activeTexture, FRAME_INNER_WIDTH, FRAME_INNER_HEIGHT);
  const previousPlaneDimensions = previousTexture
    ? calculatePlaneDimensions(previousTexture, FRAME_INNER_WIDTH, FRAME_INNER_HEIGHT)
    : [planeWidth, planeHeight];
  const [previousPlaneWidth, previousPlaneHeight] = previousPlaneDimensions;

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
        setIsTransitionActive(false);
        setPreviousTexture(null);
        previousTextureRef.current = null;
      }

      needsInvalidate = true;
    }

    if (isPulseActiveRef.current) {
      pulseElapsedRef.current += delta;
      const progress = Math.min(pulseElapsedRef.current / PULSE_DURATION, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 2);

      if (pulseGroupRef.current) {
        const scale = 1 + (PULSE_MAX_SCALE - 1) * easedProgress;
        pulseGroupRef.current.scale.set(scale, scale, scale);
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
      pulseGroupRef.current.scale.set(1, 1, 1);
    }
    return result;
  };

  const displayTexture = currentTexture || texture;

  return (
    <>
      {previousTexture && (
        <mesh ref={previousPaintingMeshRef} position={[0, 0, -0.026]} castShadow={false} receiveShadow={false}>
          <planeGeometry args={[previousPlaneWidth, previousPlaneHeight]} />
          <meshStandardMaterial
            map={previousTexture}
            roughness={PAINTING_MATERIAL_ROUGHNESS}
            metalness={PAINTING_MATERIAL_METALNESS}
            emissive="#ffffff"
            emissiveIntensity={0.03}
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
          emissive="#ffffff"
          emissiveIntensity={0.03}
          transparent={isTransitionActive}
          opacity={isTransitionActive ? 0 : 1}
        />
      </mesh>

      <group ref={pulseGroupRef} position={[0, 0, -0.024]} visible={false}>
        {pulseOutlineGeometry && (
          <>
            <mesh ref={pulseFillRef} geometry={pulseOutlineGeometry}>
              <meshBasicMaterial
                color="#ffffff"
                transparent
                opacity={INITIAL_PULSE_FILL_OPACITY}
                blending={AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            <lineSegments ref={pulseOutlineRef} geometry={pulseOutlineGeometry}>
              <lineBasicMaterial
                color="#ffffff"
                transparent
                opacity={INITIAL_PULSE_OUTLINE_OPACITY}
                depthWrite={false}
              />
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
        paintingId={item.id}
      />
    </PaintingGroup>
  );
};
ArchiveFramedPainting.displayName = "ArchiveFramedPainting";
