/**
 * Three.js / React Three Fiber Utilities
 *
 * Provides common utilities for Three.js and React Three Fiber components.
 */

import type React from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Texture } from "three";

/**
 * Threshold for pointer drag detection (in pixels)
 */
export const POINTER_DRAG_THRESHOLD = 6;

/**
 * Validate pointer event for multi-touch handling
 *
 * @param event - Pointer event from React Three Fiber
 * @param activePointerId - Currently active pointer ID (null if none)
 * @returns true if event is valid for processing
 */
export function isValidPointerEvent(event: ThreeEvent<PointerEvent>, activePointerId: number | null): boolean {
  if (!event.isPrimary) {
    return false;
  }
  if (activePointerId !== null && event.pointerId !== activePointerId) {
    return false;
  }
  return true;
}

/**
 * Calculate plane dimensions from texture aspect ratio
 *
 * Calculates the width and height of a plane that fits within the given frame
 * dimensions while maintaining the texture's aspect ratio.
 *
 * @param texture - Three.js texture (can be null)
 * @param innerWidth - Inner width of the frame
 * @param innerHeight - Inner height of the frame
 * @returns Tuple of [planeWidth, planeHeight]
 */
export function calculatePlaneDimensions(
  texture: Texture | null,
  innerWidth: number,
  innerHeight: number,
): [number, number] {
  const image = texture?.image as HTMLImageElement | undefined;
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

  return [planeWidth, planeHeight];
}

/**
 * Handle pointer move event for drag detection
 *
 * Tracks pointer movement and sets a flag when movement exceeds threshold.
 * This is used to distinguish between clicks and drags.
 *
 * @param event - Pointer move event from React Three Fiber
 * @param pointerDownPositionRef - Ref containing starting pointer position
 * @param hasPointerMovedRef - Ref to track if pointer has moved
 * @param activePointerIdRef - Ref containing active pointer ID
 */
export function handlePointerMoveForDrag(
  event: ThreeEvent<PointerEvent>,
  pointerDownPositionRef: React.MutableRefObject<{ x: number; y: number } | null>,
  hasPointerMovedRef: React.MutableRefObject<boolean>,
  activePointerIdRef: React.MutableRefObject<number | null>,
): void {
  if (!isValidPointerEvent(event, activePointerIdRef.current)) {
    return;
  }

  const start = pointerDownPositionRef.current;
  if (!start) {
    return;
  }

  event.stopPropagation();

  const deltaX = event.clientX - start.x;
  const deltaY = event.clientY - start.y;
  if (Math.hypot(deltaX, deltaY) > POINTER_DRAG_THRESHOLD) {
    hasPointerMovedRef.current = true;
  }
}
