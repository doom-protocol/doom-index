"use client";

import { useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";

type CameraPreset = "dashboard" | "painting";

interface CameraRigProps {
  preset?: CameraPreset;
}

const PRESETS: Record<CameraPreset, { position: [number, number, number]; lookAt: [number, number, number] }> = {
  dashboard: {
    position: [2.5, 1.6, 0],
    lookAt: [2.5, 1.6, -1],
  },
  painting: {
    position: [0, 1.6, 1.0],
    lookAt: [0, 1.6, -4.5],
  },
};

const TRANSITION_DURATION = 800; // ms

const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export const CameraRig: React.FC<CameraRigProps> = ({ preset = "painting" }) => {
  const { camera } = useThree();
  const currentPreset = useRef<CameraPreset>(preset);
  const startPosition = useRef(new Vector3());
  const startLookAt = useRef(new Vector3());
  const targetPosition = useRef(new Vector3());
  const targetLookAt = useRef(new Vector3());
  const transitionStart = useRef(0);
  const isTransitioning = useRef(false);

  useFrame(({ clock }) => {
    // Check if preset has changed and start transition
    if (preset !== currentPreset.current && !isTransitioning.current) {
      currentPreset.current = preset;
      isTransitioning.current = true;
      startPosition.current.copy(camera.position);
      startLookAt.current.set(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
      targetPosition.current.set(...PRESETS[preset].position);
      targetLookAt.current.set(...PRESETS[preset].lookAt);
      transitionStart.current = clock.getElapsedTime() * 1000;
    }

    // Perform transition
    if (isTransitioning.current) {
      const elapsed = clock.getElapsedTime() * 1000 - transitionStart.current;
      const progress = Math.min(elapsed / TRANSITION_DURATION, 1);
      const easedProgress = easeInOutCubic(progress);

      // Interpolate position
      camera.position.lerpVectors(startPosition.current, targetPosition.current, easedProgress);

      // Interpolate lookAt
      const currentLookAt = new Vector3().lerpVectors(startLookAt.current, targetLookAt.current, easedProgress);
      camera.lookAt(currentLookAt);

      if (progress >= 1) {
        isTransitioning.current = false;
      }
    }
  });

  return null;
};

export const useCameraRig = () => {
  const [preset, setPreset] = useState<CameraPreset>("painting");

  const moveTo = (newPreset: CameraPreset) => {
    setPreset(newPreset);
  };

  return { preset, moveTo };
};
