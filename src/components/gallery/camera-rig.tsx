"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef, type FC } from "react";
import { Vector3 } from "three";

type CameraPreset = "dashboard" | "painting";

interface CameraRigProps {
  preset?: CameraPreset;
}

// Dashboard position: [1.8, 0.5, 2.2]
// Coordinates for camera position in front of dashboard, confirmed by manual adjustment
const DASHBOARD_POSITION: [number, number, number] = [1.8, 0.5, 2.2];

const PRESETS: Record<CameraPreset, { position: [number, number, number]; lookAt: [number, number, number] }> = {
  dashboard: {
    // Camera position in front of dashboard, confirmed by manual adjustment
    position: [3.1, 0.53, 1.01],
    lookAt: DASHBOARD_POSITION,
  },
  painting: {
    position: [0, 0.8, 0.8],
    lookAt: [0, 0.8, 4.0],
  },
};

const TRANSITION_DURATION = 800; // ms

const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export const CameraRig: FC<CameraRigProps> = ({ preset = "painting" }) => {
  const { camera } = useThree();
  const currentPreset = useRef<CameraPreset>(preset);
  const startPosition = useRef(new Vector3());
  const startLookAt = useRef(new Vector3());
  const targetPosition = useRef(new Vector3());
  const targetLookAt = useRef(new Vector3());
  const transitionStart = useRef(0);
  const isTransitioning = useRef(false);

  const currentLookAtRef = useRef(new Vector3());

  useFrame(({ clock, invalidate }) => {
    // Check if preset has changed and start transition
    if (preset !== currentPreset.current && !isTransitioning.current) {
      currentPreset.current = preset;
      isTransitioning.current = true;
      startPosition.current.copy(camera.position);
      startLookAt.current.set(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
      targetPosition.current.set(...PRESETS[preset].position);
      targetLookAt.current.set(...PRESETS[preset].lookAt);
      transitionStart.current = clock.getElapsedTime() * 1000;
      invalidate();
    }

    // Perform transition
    if (isTransitioning.current) {
      const elapsed = clock.getElapsedTime() * 1000 - transitionStart.current;
      const progress = Math.min(elapsed / TRANSITION_DURATION, 1);
      const easedProgress = easeInOutCubic(progress);

      // Interpolate position
      camera.position.lerpVectors(startPosition.current, targetPosition.current, easedProgress);

      // Interpolate lookAt (reuse ref to avoid new allocation)
      currentLookAtRef.current.lerpVectors(startLookAt.current, targetLookAt.current, easedProgress);
      camera.lookAt(currentLookAtRef.current);

      if (progress >= 1) {
        isTransitioning.current = false;
      }

      invalidate();
    }
  });

  return null;
};
