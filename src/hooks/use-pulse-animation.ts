"use client";

import { useRef, useEffect, useMemo } from "react";
import {
  EdgesGeometry,
  LineBasicMaterial,
  MeshBasicMaterial,
  PlaneGeometry,
  type Group,
  type LineSegments,
  type Mesh,
} from "three";

// Animation constants
export const PULSE_DURATION = 0.6;
export const PULSE_MAX_SCALE = 1.45;
export const INITIAL_PULSE_FILL_OPACITY = 0.45;
export const INITIAL_PULSE_OUTLINE_OPACITY = 0.85;

export interface PulseAnimationRefs {
  pulseGroupRef: React.RefObject<Group | null>;
  pulseFillRef: React.RefObject<Mesh | null>;
  pulseOutlineRef: React.RefObject<LineSegments | null>;
}

export interface UsePulseAnimationReturn {
  /** Refs for pulse animation elements */
  refs: PulseAnimationRefs;
  /** Geometry for pulse outline */
  pulseOutlineGeometry: EdgesGeometry;
  /** Function to trigger pulse animation */
  triggerPulse: () => void;
  /** Function to update pulse animation (call in useFrame) */
  updatePulse: (delta: number) => boolean;
  /** Whether pulse animation is currently active */
  isPulseActive: () => boolean;
}

/**
 * Hook for managing pulse animation on painting click.
 * Returns refs, geometry, and animation control functions.
 */
export function usePulseAnimation(planeWidth: number, planeHeight: number): UsePulseAnimationReturn {
  // Refs for animation elements
  const pulseGroupRef = useRef<Group>(null);
  const pulseFillRef = useRef<Mesh>(null);
  const pulseOutlineRef = useRef<LineSegments>(null);

  // Animation state refs
  const pulseElapsedRef = useRef(0);
  const isPulseActiveRef = useRef(false);

  // Create pulse outline geometry
  const pulseOutlineGeometry = useMemo(() => {
    const plane = new PlaneGeometry(planeWidth, planeHeight);
    const edges = new EdgesGeometry(plane, 1);
    plane.dispose();
    return edges;
  }, [planeWidth, planeHeight]);

  // Cleanup geometry on unmount or when dimensions change
  useEffect(() => {
    return () => {
      pulseOutlineGeometry.dispose();
    };
  }, [pulseOutlineGeometry]);

  // Trigger pulse animation
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

  // Update pulse animation (returns true if animation is active)
  const updatePulse = (delta: number): boolean => {
    if (!isPulseActiveRef.current || !pulseGroupRef.current) {
      return false;
    }

    pulseElapsedRef.current += delta;
    const progress = Math.min(pulseElapsedRef.current / PULSE_DURATION, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 2);
    const scale = 1 + (PULSE_MAX_SCALE - 1) * easedProgress;

    pulseGroupRef.current.scale.set(scale, scale, 1);

    const fillMaterial = pulseFillRef.current?.material;
    if (fillMaterial instanceof MeshBasicMaterial) {
      fillMaterial.opacity = INITIAL_PULSE_FILL_OPACITY * (1 - easedProgress);
    }

    const outlineMaterial = pulseOutlineRef.current?.material;
    if (outlineMaterial instanceof LineBasicMaterial) {
      outlineMaterial.opacity = INITIAL_PULSE_OUTLINE_OPACITY * (1 - easedProgress);
    }

    if (progress >= 1) {
      pulseGroupRef.current.visible = false;
      isPulseActiveRef.current = false;
    }

    return true;
  };

  const isPulseActive = () => isPulseActiveRef.current;

  return {
    refs: {
      pulseGroupRef,
      pulseFillRef,
      pulseOutlineRef,
    },
    pulseOutlineGeometry,
    triggerPulse,
    updatePulse,
    isPulseActive,
  };
}
